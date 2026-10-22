import { CalculatorType } from "./financialCalculations"
import type ParsedBalanceSheet from "./parsedBalanceSheet"
import { isCurrentAsset, isCurrentLiability } from "./statementParsing"

export type MapperResult = {
  inputs: Record<string, unknown>
  confidence: number // 0-1
  notes?: string
  /** No automatic mapping exists for this calculator (says nothing about the extraction itself). */
  unmapped?: true
}

// Sole proprietorships and partnerships report a single "net profit" (there's
// no tax-before/after split meaningful to the owner's return); every other
// constitution (Pvt Ltd, Public Ltd, OPC, LLP, ...) reports PBT, and quasi-debt
// takes the form of a director's/designated-partner's loan rather than a
// proprietor's-relative or partner's loan. Unknown/missing constitution falls
// back to the company-style treatment (the more common CMA case).
type ConstitutionCategory = "individual" | "company"

function categorizeConstitution(businessConstitution?: string): ConstitutionCategory {
  const c = (businessConstitution || "").toLowerCase()
  if (c.includes("proprietorship") || (c.includes("partnership") && !c.includes("limited liability"))) {
    return "individual"
  }
  return "company"
}

/** Case-insensitive search across an income statement's own keys and its nested `profitability`/`profit` block. */
function findIncomeValue(income: Record<string, any>, patterns: RegExp[]): number | undefined {
  const profitability = (income.profitability || income.profit || {}) as Record<string, any>
  for (const bag of [income, profitability]) {
    for (const [key, value] of Object.entries(bag)) {
      if (typeof value === "number" && patterns.some((p) => p.test(key.toLowerCase()))) return value
    }
  }
  return undefined
}

// Bank borrowings under any of their Indian names - missing cash credit made a
// leveraged firm look debt-free.
const DEBT_PATTERNS = [/loan/, /borrow/, /debt/, /overdraft/, /\bod\b/, /\bcc\b/, /\bwcdl\b/, /bond/, /debenture/, /cash\s*credit/, /working\s*capital/, /bills?\s*(?:payable|discounted)/, /acceptances?/, /hire\s*purchase/, /finance\s+lease/, /lease\s+liabilit/, /deferred\s+payment/, /\bncd\b/]

/**
 * Liabilities excluding equity, for when no debt line matched. Indian balance
 * sheets give "Total Liabilities" as capital + liabilities (= total assets), so
 * using it as debt would count the owners' funds as borrowings.
 */
function liabilitiesExcludingEquity(parsed: ParsedBalanceSheet): number {
  const t = parsed.balanceSheet.totals
  if (
    typeof t?.totalLiabilities === "number" && typeof t.totalAssets === "number" && typeof t.totalEquity === "number" &&
    Math.abs(t.totalLiabilities - t.totalAssets) <= 0.01 * Math.max(Math.abs(t.totalAssets), 1)
  ) {
    return t.totalLiabilities - t.totalEquity
  }
  return getTotalLiabilities(parsed).value
}

function sumSections(items: { amount: number }[] | undefined) {
  if (!items) return 0
  return items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
}

/** Debt by the line's own words, or by sitting under a "Secured/Unsecured Loans" heading ("Bajaj Finance", "Axis Bank P/L"). */
const isDebt = (s: { name?: string; group?: string }) => s.group === "borrowing" || DEBT_PATTERNS.some((p) => p.test((s.name || "").toLowerCase()))

function findAndSumByName(sections: { name?: string; amount: number }[] | undefined, patterns: RegExp[]) {
  if (!sections) return { sum: 0, matched: 0 }
  let sum = 0
  let matched = 0
  for (const s of sections) {
    const name = (s.name || "").toLowerCase()
    if (patterns.some((p) => p.test(name))) {
      sum += Number(s.amount) || 0
      matched++
    }
  }
  return { sum, matched }
}

function sumWhere<T extends { amount: number }>(items: T[] | undefined, pick: (s: T) => boolean) {
  let sum = 0
  let matched = 0
  for (const s of items ?? []) if (pick(s)) { sum += Number(s.amount) || 0; matched++ }
  return { sum, matched }
}

function getTotalAssets(parsed: ParsedBalanceSheet) {
  const t = parsed.balanceSheet.totals?.totalAssets
  if (typeof t === "number") return { value: t, confidence: 0.9 }
  const sum = sumSections(parsed.balanceSheet.assets)
  return { value: sum, confidence: parsed.metadata?.confidence ?? 0.6 }
}

function getTotalLiabilities(parsed: ParsedBalanceSheet) {
  const t = parsed.balanceSheet.totals?.totalLiabilities
  if (typeof t === "number") return { value: t, confidence: 0.9 }
  const sum = sumSections(parsed.balanceSheet.liabilities)
  return { value: sum, confidence: parsed.metadata?.confidence ?? 0.6 }
}

function getTotalEquity(parsed: ParsedBalanceSheet) {
  const t = parsed.balanceSheet.totals?.totalEquity
  if (typeof t === "number") return { value: t, confidence: 0.9 }
  const sum = sumSections(parsed.balanceSheet.equity)
  return { value: sum, confidence: parsed.metadata?.confidence ?? 0.6 }
}

export function mapToCalculator(
  calculatorType: CalculatorType,
  parsed: ParsedBalanceSheet,
  businessConstitution?: string
): MapperResult {
  const notes: string[] = []
  const income = parsed.incomeStatement || {}
  const category = categorizeConstitution(businessConstitution)
  switch (calculatorType) {
    case "debt-equity": {
      // Try to pick only debt-like liabilities first
      const { sum: debtSum, matched } = sumWhere(parsed.balanceSheet.liabilities, isDebt)
            const totalEquity = getTotalEquity(parsed)

      const totalDebt = matched > 0 ? debtSum : liabilitiesExcludingEquity(parsed)
      if (matched === 0) notes.push("No explicit debt line matched; using total liabilities as debt")

      return {
        inputs: { totalDebt, totalEquity: totalEquity.value },
        confidence: matched > 0 ? 0.85 : 0.5,
        notes: notes.join("; "),
      }
    }

    case "quasi-debt-equity": {
      // Quasi-capital is constitution-specific: a director's/designated-partner's
      // unsecured loan to a company/LLP; a partner's unsecured loan to a
      // partnership firm; an unsecured loan from a same-surname relative to a
      // proprietorship. The parser can't match surnames, so "relative"/"partner"
      // lines are matched by label instead - these are quasi-debt, not standard
      // debt, and must be excluded from totalDebt below to avoid double-counting.
      const quasiNames =
        category === "individual"
          ? [/partner/, /proprietor/, /relative/, /unsecured/, /subordinated/, /quasi/]
          : [/director/, /preference/, /convertible/, /quasi/, /subordinated/, /unsecured/]
      const { sum: quasiSum, matched: quasiMatched } = findAndSumByName(parsed.balanceSheet.liabilities, quasiNames)
      const nonQuasiLiabilities = (parsed.balanceSheet.liabilities || []).filter(
        (s) => !quasiNames.some((p) => p.test((s.name || "").toLowerCase()))
      )
      const { sum: debtSum, matched: debtMatched } = sumWhere(nonQuasiLiabilities, isDebt)
      const totalDebt = debtMatched > 0 ? debtSum : liabilitiesExcludingEquity(parsed) - quasiSum

      const equity = getTotalEquity(parsed)

      return {
        inputs: { totalDebt, quasiDebt: quasiSum, equity: equity.value },
        confidence: quasiMatched > 0 ? 0.7 : 0.45,
        notes: quasiMatched > 0 ? undefined : "No quasi-debt line found; quasiDebt=0",
      }
    }

    case "current-ratio":
    case "net-working-capital": {
      // A "Current Assets" heading in the file decides; otherwise the line's own words do.
      const currentAssets = sumWhere(parsed.balanceSheet.assets, isCurrentAsset)
      const currentLiabilities = sumWhere(parsed.balanceSheet.liabilities, isCurrentLiability)

      // fallback to totals
      const ca = currentAssets.matched > 0 ? currentAssets.sum : getTotalAssets(parsed).value
      const cl = currentLiabilities.matched > 0 ? currentLiabilities.sum : getTotalLiabilities(parsed).value

      return {
        inputs: { currentAssets: ca, currentLiabilities: cl },
        confidence: Math.min(1, (currentAssets.matched + currentLiabilities.matched) / 4) || 0.5,
      }
    }

    case "ebitda": {
      // Derive EBITDA using available fields in order of reliability:
      // 0) Constitution-appropriate profit figure - Net Profit for Proprietorship/
      //    Partnership, Profit Before Tax for everyone else (Pvt Ltd, Ltd, OPC, LLP...)
      // 1) If operating profit before interest available, add back depreciation/amortisation to get EBITDA
      // 2) Else if balanceSheet/equity contains gross profit, use that (some CMA reports report EBITDA as gross profit)
      // 3) Else fallback to revenue - costOfSales
      const revenue = income.revenue ?? income.sales ?? 0

      let ebitda: number | undefined
      const constitutionProfit = findIncomeValue(
        income,
        category === "individual" ? [/net\s*profit/, /profit\s*after\s*tax/, /^pat$/] : [/profit\s*before\s*tax/, /^pbt$/]
      )
      let addBacks = { depreciation: 0, financeCost: 0 }
      if (typeof constitutionProfit === "number") {
        ebitda = constitutionProfit
        // profit is after depreciation and interest: add back the ones the file shows
        addBacks = { depreciation: Math.max(0, Number(income.depreciation) || 0), financeCost: Math.max(0, Number(income.interestExpense) || 0) }
        notes.push(
          category === "individual"
            ? "EBITDA base taken from Net Profit (Proprietorship/Partnership)"
            : "EBITDA base taken from Profit Before Tax"
        )
      }

      if (ebitda === undefined && typeof income.ebitda === "number") {
        ebitda = income.ebitda
        notes.push("EBITDA read directly from the file")
      }

      // Prefer explicit gross profit from balance sheet equity if present (some CMA reports use this as EBITDA)
      const bsGrossDirect = parsed.balanceSheet?.equity && (typeof (parsed.balanceSheet?.equity as any)?.["gross profit/loss"] === "number" ? (parsed.balanceSheet as any).equity["gross profit/loss"] : undefined)
      const bsGrossList = parsed.balanceSheet?.equity && (parsed.balanceSheet.equity.find?.((s: any) => (s.name || "").toLowerCase().includes("gross profit"))?.amount)
      if (ebitda === undefined && typeof bsGrossDirect === "number") {
        ebitda = Number(bsGrossDirect)
        notes.push("EBITDA taken from balanceSheet.equity['gross profit/loss'] (preferred)")
      } else if (ebitda === undefined && typeof bsGrossList === "number") {
        ebitda = Number(bsGrossList)
        notes.push("EBITDA taken from balanceSheet.equity gross profit entry (preferred)")
      }

      // try profitability block next (operating profit before interest + depreciation)
      const profitability = (income.profitability || income.profit || {}) as Record<string, any>
      if (ebitda === undefined && typeof profitability["operating profit before interest"] === "number") {
        const opBeforeInterest = Number(profitability["operating profit before interest"])
        const depreciation = Number(income.expenses?.["vi) depreciation (on assets for mfg.)"] ?? income.depreciation ?? 0) || 0
        ebitda = opBeforeInterest + depreciation
        notes.push("EBITDA derived from operating profit before interest + depreciation")
      }

      // fallback: revenue - cost of sales (if cost present under income.revenue)
      if (ebitda === undefined) {
        const costOfSales = Number((income.revenue && (income.revenue["xiii) sub total (total cost of sales)" ])) ?? (income.costOfSales ?? income.cogs ?? 0)) || 0
        if (revenue && costOfSales) {
          ebitda = revenue - costOfSales
          notes.push("EBITDA computed as revenue - costOfSales")
        }
      }

      // final fallback: try using operatingExpenses if present
      if (ebitda === undefined) {
        const operatingExpenses = income.operatingExpenses ?? income["operating expenses"] ?? 0
        if (revenue || operatingExpenses) {
          ebitda = revenue - (Number(operatingExpenses) || 0)
          notes.push("EBITDA fallback: revenue - operatingExpenses")
        }
      }

      const conf = ebitda !== undefined ? 0.95 : 0.25
      if (ebitda === undefined) notes.push("Unable to derive EBITDA from parsed income statement; check parsing")
      // the derived figure is already an add-back total, so it maps onto `profit`
      // with the other add-backs at zero
      return {
        inputs: { profit: ebitda ?? 0, ...addBacks, sales: revenue || 0 },
        confidence: conf,
        notes: notes.join("; "),
      }
    }

    case "dscr": {
      // cash available for debt service ~ EBIT + depreciation
      const netOperatingIncome =
        income.netOperatingIncome ??
        (typeof income.ebit === "number" ? income.ebit + (Number(income.depreciation) || 0) : undefined) ??
        ((income.revenue && income.operatingExpenses) ? (income.revenue - (income.operatingExpenses || 0)) : undefined)
      // Debt service = interest + principal repaid. The principal comes from the cash flow statement when the
      // file has one; a balance sheet alone shows interest only.
      const principal = Number(income.principalRepayment) || 0
      const explicit = income.totalDebtService ?? income["debt service"]
      const totalDebtService = explicit ?? ((Number(income.interestExpense) || 0) + principal)
      const conf = netOperatingIncome && totalDebtService ? (explicit !== undefined ? 0.85 : principal ? 0.75 : 0.5) : 0.45
      return {
        inputs: { netOperatingIncome: netOperatingIncome ?? 0, totalDebtService },
        confidence: conf,
        notes:
          explicit !== undefined || !totalDebtService
            ? undefined
            : principal
              ? "Debt service = interest + principal repayments read from the cash flow statement"
              : "Debt service is interest only - add principal repayments for a true DSCR",
      }
    }

    case "iscr": {
      // Same constitution split as EBITDA: Net Profit for Proprietorship/Partnership,
      // Profit Before Tax for everyone else, before falling back to EBIT-style fields.
      const constitutionProfit = findIncomeValue(
        income,
        category === "individual" ? [/net\s*profit/, /profit\s*after\s*tax/, /^pat$/] : [/profit\s*before\s*tax/, /^pbt$/]
      )
      const ebit = income.ebit ?? constitutionProfit ?? income["operating profit"] ?? 0
      const interestExpense = income.interestExpense ?? income.interest ?? 0
      const conf = ebit && interestExpense ? 0.8 : 0.45
      return { inputs: { ebit, interestExpense }, confidence: conf }
    }

    case "drawing-power": {
      // inventory/stock + eligible receivables
      const inventoryMatch = findAndSumByName(parsed.balanceSheet.assets, [/inventor/, /stock/, /stores/, /spares/, /raw\s*material/, /finished\s*goods/, /work[-\s]in/, /consumable/])
      const eligibleStock = inventoryMatch.matched > 0 ? inventoryMatch.sum : 0
      // Uploaded statements carry no ageing list, so take the debtors line when there is no receivables list.
      const eligibleReceivables = parsed.receivables
        ? parsed.receivables.reduce((s, r) => s + (Number(r.amount) || 0), 0)
        : findAndSumByName(parsed.balanceSheet.assets, [/debtor/, /receivable/]).sum
      const creditors = findAndSumByName(parsed.balanceSheet.liabilities, [/creditor/, /trade\s*payable/, /accounts?\s*payable/, /suppliers?/, /bills?\s*payable/, /acceptances?/]).sum
      return { inputs: { eligibleStock, eligibleReceivables, creditors }, confidence: 0.6 }
    }

    case "ageing": {
      const receivables = parsed.receivables ?? []
      return { inputs: { receivables }, confidence: receivables.length > 0 ? 0.95 : 0.25 }
    }

    case "pid": {
      const ptr = income.projectedAnnualSales as number | undefined
      const inputs = {
        projectedAnnualSales: ptr ?? 0,
        annualPurchase: income.annualPurchase ?? 0,
        marginPercent: income.marginPercent ?? 0,
        salesCreditDays: income.salesCreditDays ?? 0,
        purchaseCreditDays: income.purchaseCreditDays ?? 0,
        pidLimit: parsed.metadata?.confidence ? Math.round(getTotalAssets(parsed).value * 0.1) : 0,
        pidCostPerMonthPercent: income.pidCostPerMonthPercent ?? 1,
        cashDiscountPercent: income.cashDiscountPercent ?? 0,
      }
      return { inputs, confidence: 0.35, notes: "PID inputs require manual confirmation; many defaults applied" }
    }

    case "valuation":
    case "working-capital-cycle":
    default: {
      return { inputs: {}, confidence: 0.2, unmapped: true, notes: "No automatic mapping available for this calculator; manual input recommended" }
    }
  }
}

export type { MapperResult }

export default mapToCalculator
