import { CalculatorType } from "./financialCalculations"
import type ParsedBalanceSheet from "./parsedBalanceSheet"

type MapperResult = {
  inputs: Record<string, unknown>
  confidence: number // 0-1
  notes?: string
}

function sumSections(items: { amount: number }[] | undefined) {
  if (!items) return 0
  return items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
}

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

export function mapToCalculator(calculatorType: CalculatorType, parsed: ParsedBalanceSheet): MapperResult {
  const notes: string[] = []
  const income = parsed.incomeStatement || {}
  switch (calculatorType) {
    case "debt-equity": {
      // Try to pick only debt-like liabilities first
      const debtNames = [/loan/, /borrow/, /debt/, /overdraft/, /bond/] 
      const { sum: debtSum, matched } = findAndSumByName(parsed.balanceSheet.liabilities, debtNames)
      const totalLiabilities = getTotalLiabilities(parsed)
      const totalEquity = getTotalEquity(parsed)

      const totalDebt = matched > 0 ? debtSum : totalLiabilities.value
      if (matched === 0) notes.push("No explicit debt line matched; using total liabilities as debt")

      return {
        inputs: { totalDebt, totalEquity: totalEquity.value },
        confidence: matched > 0 ? 0.85 : 0.5,
        notes: notes.join("; "),
      }
    }

    case "quasi-debt-equity": {
      const quasiNames = [/preference/, /convertible/, /quasi/, /subordinated/]
      const { sum: quasiSum, matched: quasiMatched } = findAndSumByName(parsed.balanceSheet.liabilities, quasiNames)
      const debt = mapToCalculator("debt-equity", parsed)
      const equity = getTotalEquity(parsed)

      return {
        inputs: { totalDebt: debt.inputs.totalDebt, quasiDebt: quasiSum, equity: equity.value },
        confidence: quasiMatched > 0 ? 0.7 : 0.45,
        notes: quasiMatched > 0 ? undefined : "No quasi-debt line found; quasiDebt=0",
      }
    }

    case "current-ratio":
    case "net-working-capital": {
      // heuristic: look for 'current' in section names
      const currentAssets = findAndSumByName(parsed.balanceSheet.assets, [/current/, /cash/, /bank/, /receivable/, /inventory/])
      const currentLiabilities = findAndSumByName(parsed.balanceSheet.liabilities, [/current/, /payable/, /creditors/, /overdraft/])

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
      // 1) If operating profit before interest available, add back depreciation/amortisation to get EBITDA
      // 2) Else if balanceSheet/equity contains gross profit, use that (some CMA reports report EBITDA as gross profit)
      // 3) Else fallback to revenue - costOfSales
      const revenue = income.revenue ?? income.sales ?? 0

      // Prefer explicit gross profit from balance sheet equity if present (some CMA reports use this as EBITDA)
      let ebitda: number | undefined
      const bsGrossDirect = parsed.balanceSheet?.equity && (typeof (parsed.balanceSheet?.equity as any)?.["gross profit/loss"] === "number" ? (parsed.balanceSheet as any).equity["gross profit/loss"] : undefined)
      const bsGrossList = parsed.balanceSheet?.equity && (parsed.balanceSheet.equity.find?.((s: any) => (s.name || "").toLowerCase().includes("gross profit"))?.amount)
      if (typeof bsGrossDirect === "number") {
        ebitda = Number(bsGrossDirect)
        notes.push("EBITDA taken from balanceSheet.equity['gross profit/loss'] (preferred)")
      } else if (typeof bsGrossList === "number") {
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
      return { inputs: { revenue: revenue || 0, ebitda: ebitda ?? 0 }, confidence: conf, notes: notes.join("; ") }
    }

    case "dscr": {
      const netOperatingIncome =
        income.netOperatingIncome ??
        income.ebit ??
        ((income.revenue && income.operatingExpenses) ? (income.revenue - (income.operatingExpenses || 0)) : undefined)
      const totalDebtService = income.totalDebtService ?? income["debt service"] ?? 0
      const conf = netOperatingIncome && totalDebtService ? 0.85 : 0.45
      return { inputs: { netOperatingIncome: netOperatingIncome ?? 0, totalDebtService }, confidence: conf }
    }

    case "iscr": {
      const ebit = income.ebit ?? income["operating profit"] ?? 0
      const interestExpense = income.interestExpense ?? income.interest ?? 0
      const conf = ebit && interestExpense ? 0.8 : 0.45
      return { inputs: { ebit, interestExpense }, confidence: conf }
    }

    case "drawing-power": {
      // inventory/stock + eligible receivables
      const inventoryMatch = findAndSumByName(parsed.balanceSheet.assets, [/inventory/, /stock/, /stores/])
      const eligibleStock = inventoryMatch.matched > 0 ? inventoryMatch.sum : 0
      const eligibleReceivables = parsed.receivables ? parsed.receivables.reduce((s, r) => s + (Number(r.amount) || 0), 0) : 0
      // marginPercent should be collected from user; set placeholder 25
      const marginPercent = 25
      return { inputs: { eligibleStock, eligibleReceivables, marginPercent }, confidence: 0.6, notes: "marginPercent defaulted to 25%" }
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
      return { inputs: {}, confidence: 0.2, notes: "No automatic mapping available for this calculator; manual input recommended" }
    }
  }
}

export type { MapperResult }

export default mapToCalculator
