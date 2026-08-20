export type CalculatorType =
  | "debt-equity"
  | "quasi-debt-equity"
  | "current-ratio"
  | "dscr"
  | "ebitda"
  | "iscr"
  | "ageing"
  | "net-working-capital"
  | "drawing-power"
  | "pid"
  | "valuation"
  | "working-capital-cycle"
  | "cashflow-quality"
  | "macro-ratios"
  | "cma-document"

export type RiskLevel = "low" | "moderate" | "high" | "n/a"

export interface CalculationResult {
  value: number | null
  formatted: string
  interpretation: string
  risk: RiskLevel
  details?: string
}

export interface AgingBucket {
  label: string
  amount: number
  count: number
  percentage: number
}

export interface AgingResult {
  buckets: AgingBucket[]
  total: number
  interpretation: string
  risk: RiskLevel
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function calculateDebtEquity(totalDebt: number, totalEquity: number): CalculationResult {
  if (totalDebt < 0 || totalEquity < 0) {
    throw new Error("Values cannot be negative")
  }
  if (totalEquity === 0) {
    throw new Error("Equity cannot be zero")
  }

  const ratio = totalDebt / totalEquity
  let risk: RiskLevel
  let interpretation: string

  if (ratio < 1) {
    risk = "low"
    interpretation = "Low leverage — the business is conservatively financed with more equity than debt"
  } else if (ratio <= 2) {
    risk = "moderate"
    interpretation = "Moderate leverage — manageable debt levels relative to equity"
  } else {
    risk = "high"
    interpretation = "High leverage — elevated financial risk due to significant debt relative to equity"
  }

  return {
    value: ratio,
    formatted: ratio.toFixed(2),
    interpretation,
    risk,
  }
}

export function calculateQuasiDebtEquity(
  totalDebt: number,
  quasiDebt: number,
  equity: number
): CalculationResult {
  if (totalDebt < 0 || quasiDebt < 0 || equity < 0) {
    throw new Error("Values cannot be negative")
  }
  if (equity === 0) {
    throw new Error("Equity cannot be zero")
  }

  const ratio = (totalDebt + quasiDebt) / equity
  let risk: RiskLevel
  let interpretation: string

  if (ratio < 1) {
    risk = "low"
    interpretation = "Low leverage — the business is conservatively financed with more equity than debt"
  } else if (ratio <= 2) {
    risk = "moderate"
    interpretation = "Moderate leverage — manageable debt levels relative to equity"
  } else {
    risk = "high"
    interpretation = "High leverage — elevated financial risk due to significant debt relative to equity"
  }

  return {
    value: ratio,
    formatted: ratio.toFixed(2),
    interpretation,
    risk,
  }
}

export function calculateCurrentRatio(
  currentAssets: number,
  currentLiabilities: number
): CalculationResult {
  if (currentAssets < 0 || currentLiabilities < 0) {
    throw new Error("Values cannot be negative")
  }
  if (currentLiabilities === 0) {
    throw new Error("Current liabilities cannot be zero")
  }

  const ratio = currentAssets / currentLiabilities
  let risk: RiskLevel
  let interpretation: string

  if (ratio < 1) {
    risk = "high"
    interpretation = "Below 1 — the business may struggle to meet short-term obligations"
  } else if (ratio <= 1.5) {
    risk = "moderate"
    interpretation = "Adequate liquidity — current obligations are covered"
  } else {
    risk = "low"
    interpretation = "Strong liquidity position — comfortable short-term cushion"
  }

  return {
    value: ratio,
    formatted: ratio.toFixed(2),
    interpretation,
    risk,
  }
}

export function calculateDSCR(
  netOperatingIncome: number,
  totalDebtService: number
): CalculationResult {
  if (totalDebtService === 0) {
    throw new Error("Total debt service cannot be zero")
  }

  const ratio = netOperatingIncome / totalDebtService
  let risk: RiskLevel
  let interpretation: string

  if (ratio < 1) {
    risk = "high"
    interpretation = "Insufficient cash flow to cover debt obligations — high default risk"
  } else if (ratio <= 1.5) {
    risk = "moderate"
    interpretation = "Marginally adequate coverage — limited buffer for cash flow fluctuations"
  } else {
    risk = "low"
    interpretation = "Healthy debt service capacity — strong cash flow relative to obligations"
  }

  return {
    value: ratio,
    formatted: ratio.toFixed(2),
    interpretation,
    risk,
  }
}

export function calculateEBITDA(
  profit: number,
  depreciation: number,
  financeCost: number,
  sales: number
): CalculationResult {
  if (depreciation < 0 || financeCost < 0 || sales < 0) {
    throw new Error("Values cannot be negative")
  }

  const ebitda = profit + depreciation + financeCost
  const margin = sales > 0 ? ((ebitda * 100) / sales) : 0
  let risk: RiskLevel
  let interpretation: string

  if (ebitda < 0) {
    risk = "high"
    interpretation = "Negative EBITDA — the business is operating at a loss"
  } else if (margin <= 20) {
    risk = "moderate"
    interpretation = "Thin operating margin — limited profitability buffer"
  } else {
    risk = "low"
    interpretation = "Healthy operating margin — strong profitability"
  }

  return {
    value: ebitda,
    formatted: formatCurrency(ebitda),
    interpretation,
    risk,
    details: `EBITDA Margin: ${margin.toFixed(1)}%`,
  }
}

export function calculateISCR(ebit: number, interestExpense: number): CalculationResult {
  if (interestExpense === 0) {
    throw new Error("Interest expense cannot be zero")
  }

  const ratio = ebit / interestExpense
  let risk: RiskLevel
  let interpretation: string

  if (ratio < 1) {
    risk = "high"
    interpretation = "Cannot cover interest payments — critical financial distress signal"
  } else if (ratio <= 1.5) {
    risk = "moderate"
    interpretation = "Barely covering interest — vulnerable to earnings decline"
  } else {
    risk = "low"
    interpretation = "Comfortable interest coverage — earnings well above interest obligations"
  }

  return {
    value: ratio,
    formatted: ratio.toFixed(2),
    interpretation,
    risk,
  }
}

export function calculateNetWorkingCapital(
  currentAssets: number,
  currentLiabilities: number
): CalculationResult {
  const nwc = currentAssets - currentLiabilities
  let risk: RiskLevel
  let interpretation: string

  if (nwc < 0) {
    risk = "high"
    interpretation = "Negative NWC — short-term insolvency risk, liabilities exceed assets"
  } else if (nwc <= 500000) {
    risk = "moderate"
    interpretation = "Minimal working capital buffer — limited financial flexibility"
  } else {
    risk = "low"
    interpretation = "Strong working capital cushion — well-positioned for operations"
  }

  return {
    value: nwc,
    formatted: formatCurrency(nwc),
    interpretation,
    risk,
  }
}

export function calculateDrawingPower(
  eligibleStock: number,
  eligibleReceivables: number,
  marginPercent: number
): CalculationResult {
  if (eligibleStock < 0 || eligibleReceivables < 0) {
    throw new Error("Values cannot be negative")
  }
  if (marginPercent < 0 || marginPercent > 100) {
    throw new Error("Margin percent must be between 0 and 100")
  }

  const drawingPower = (eligibleStock + eligibleReceivables) * (1 - marginPercent / 100)
  const totalCollateral = eligibleStock + eligibleReceivables

  return {
    value: drawingPower,
    formatted: formatCurrency(drawingPower),
    interpretation: `Drawing power based on ${marginPercent}% margin on eligible stock and receivables. Eligible collateral: ${formatCurrency(totalCollateral)}`,
    risk: "n/a",
  }
}

export function calculateAgeing(
  receivables: { amount: number; daysOutstanding: number }[]
): AgingResult {
  const buckets: AgingBucket[] = [
    { label: "0–30 Days", amount: 0, count: 0, percentage: 0 },
    { label: "31–60 Days", amount: 0, count: 0, percentage: 0 },
    { label: "61–90 Days", amount: 0, count: 0, percentage: 0 },
    { label: "90+ Days", amount: 0, count: 0, percentage: 0 },
  ]

  let total = 0

  receivables.forEach((receivable) => {
    total += receivable.amount
    const days = receivable.daysOutstanding

    if (days <= 30) {
      buckets[0].amount += receivable.amount
      buckets[0].count++
    } else if (days <= 60) {
      buckets[1].amount += receivable.amount
      buckets[1].count++
    } else if (days <= 90) {
      buckets[2].amount += receivable.amount
      buckets[2].count++
    } else {
      buckets[3].amount += receivable.amount
      buckets[3].count++
    }
  })

  buckets.forEach((bucket) => {
    bucket.percentage = total > 0 ? (bucket.amount / total) * 100 : 0
  })

  const pctOver90 = buckets[3].percentage
  let risk: RiskLevel
  let interpretation: string

  if (pctOver90 < 10) {
    risk = "low"
    interpretation = "Low aging risk — most receivables are current and within terms"
  } else if (pctOver90 <= 30) {
    risk = "moderate"
    interpretation = "Moderate aging — a notable portion of receivables are overdue"
  } else {
    risk = "high"
    interpretation = "High aging risk — significant overdue receivables require immediate attention"
  }

  return {
    buckets,
    total,
    interpretation,
    risk,
  }
}

export interface PIDInputs {
  projectedAnnualSales: number
  annualPurchase: number
  marginPercent: number
  salesCreditDays: number
  purchaseCreditDays: number
  pidLimit: number
  pidCostPerMonthPercent: number
  cashDiscountPercent: number
}

export interface PIDResult {
  gapDays: number
  pidRotation: number
  purchaseSupported: number
  salesGenerated: number
  additionalProfit: number
  cashDiscountEarned: number
  pidCostAnnual: number
  netPidBenefit: number
  totalProfitIncrease: number
  interpretation: string
  risk: RiskLevel
}

export function calculatePID(inputs: PIDInputs): PIDResult {
  const gapDays = inputs.salesCreditDays - inputs.purchaseCreditDays
  const pidRotation = 365 / gapDays
  const purchaseSupported = inputs.pidLimit * pidRotation
  const salesGenerated = purchaseSupported / (1 - inputs.marginPercent / 100)
  const additionalProfit = salesGenerated * (inputs.marginPercent / 100)
  const cashDiscountEarned = purchaseSupported * (inputs.cashDiscountPercent / 100)
  const pidCostAnnual = inputs.pidLimit * (inputs.pidCostPerMonthPercent / 100) * 12
  const netPidBenefit = cashDiscountEarned - pidCostAnnual
  const totalProfitIncrease = additionalProfit + netPidBenefit

  let interpretation = `Total profit increase of ${formatCurrency(totalProfitIncrease)}. `
  if (totalProfitIncrease > 0) {
    interpretation += "The PID facility is beneficial and adds positive net value."
  } else {
    interpretation += "The PID facility results in a net loss. Reconsider the cost or limit."
  }

  return {
    gapDays,
    pidRotation,
    purchaseSupported,
    salesGenerated,
    additionalProfit,
    cashDiscountEarned,
    pidCostAnnual,
    netPidBenefit,
    totalProfitIncrease,
    interpretation,
    risk: totalProfitIncrease > 0 ? "low" : "high",
  }
}

export function calculateWorkingCapitalCycles(
  creditors: number,
  debtors: number,
  stock: number,
  sales: number,
  purchases: number
): CalculationResult {
  if (purchases === 0 || sales === 0) {
    throw new Error("Sales and purchases cannot be zero")
  }
  
  const creditorsPercent = (creditors * 100) / purchases
  const debtorsPercent = (debtors * 100) / sales
  const stockPercent = (stock * 100) / sales

  return {
    value: debtorsPercent + stockPercent - creditorsPercent,
    formatted: `Debtors: ${debtorsPercent.toFixed(2)}%, Stock: ${stockPercent.toFixed(2)}%, Creditors: ${creditorsPercent.toFixed(2)}%`,
    interpretation: "Working capital cycle percentages relative to sales and purchases.",
    risk: "n/a",
  }
}

// --- Quality-of-cashflow ratios (CFOdigital-style) ---
// Source: https://www.cfodigital.ai/faqs

export function calculateNCG(netCashflow: number, cash: number): CalculationResult {
  if (cash === 0) throw new Error("Cash cannot be zero")
  const ratio = netCashflow / cash
  return {
    value: ratio,
    formatted: ratio.toFixed(2),
    interpretation:
      ratio >= 1
        ? "Cash balance grew over the period through operating, investing, or financing activity"
        : "Cash balance did not grow over the period",
    risk: "n/a",
  }
}

export function calculateOCG(operatingCashflow: number, cash: number): CalculationResult {
  if (cash === 0) throw new Error("Cash cannot be zero")
  const ratio = operatingCashflow / cash
  let risk: RiskLevel
  let interpretation: string
  if (ratio > 1) {
    risk = "low"
    interpretation = "Strong cash-generating profile — operations produced multiple times the cash-on-hand"
  } else if (ratio >= 0) {
    risk = "moderate"
    interpretation = "Operations are cash-positive but only partly explain the cash balance"
  } else {
    risk = "high"
    interpretation = "Operations consumed cash — the cash balance relies on non-operating sources"
  }
  return { value: ratio, formatted: ratio.toFixed(2), interpretation, risk }
}

export function calculateCLCC(operatingCashflow: number, currentLiabilities: number): CalculationResult {
  if (currentLiabilities === 0) throw new Error("Current liabilities cannot be zero")
  const ratio = operatingCashflow / currentLiabilities
  let risk: RiskLevel
  let interpretation: string
  if (ratio > 1) {
    risk = "low"
    interpretation = "Operating cash flow more than covers current liabilities"
  } else if (ratio >= 0) {
    risk = "moderate"
    interpretation = "Operating cash flow only partly covers current liabilities"
  } else {
    risk = "high"
    interpretation = "Operations are cash-negative — short-term obligations depend on external funding"
  }
  return { value: ratio, formatted: ratio.toFixed(2), interpretation, risk }
}

export function calculateOCS(operatingCashflow: number, sales: number): CalculationResult {
  if (sales === 0) throw new Error("Sales cannot be zero")
  const ratio = operatingCashflow / sales
  return {
    value: ratio,
    formatted: ratio.toFixed(2),
    interpretation: `Every ₹1 of sales converted to ₹${ratio.toFixed(2)} of operating cash`,
    risk: "n/a",
  }
}

/** Quality of Payment Terms: +1 at DSO<=30, -1 at DSO>=90, linear between, 0 at 60 days. */
export function calculateQPT(daysSalesOutstanding: number): CalculationResult {
  const dso = daysSalesOutstanding
  let qpt: number
  if (dso <= 30) qpt = 1
  else if (dso >= 90) qpt = -1
  else qpt = 1 - (dso - 30) / 30

  let risk: RiskLevel
  let interpretation: string
  if (qpt > 0.3) {
    risk = "low"
    interpretation = "Strong collections — receivables turn over quickly"
  } else if (qpt >= -0.3) {
    risk = "moderate"
    interpretation = "Average collection performance"
  } else {
    risk = "high"
    interpretation = "Slow collections — receivables are aging past healthy terms"
  }
  return { value: qpt, formatted: qpt.toFixed(2), interpretation, risk }
}

/**
 * Quality of Operating-to-Financing Funds Use: -1..+1.
 * +1: CFop > 0 and CFfin < 0 (profitable, paying down debt/returning capital).
 * -1: CFop < 0 and CFfin < 0 (burning cash with no external support).
 * Blended in between based on the relative magnitude of each flow.
 */
export function calculateQOFFUR(operatingCashflow: number, financingCashflow: number): CalculationResult {
  const magnitude = Math.abs(operatingCashflow) + Math.abs(financingCashflow)
  const qoffur = magnitude === 0 ? 0 : (operatingCashflow - financingCashflow) / magnitude

  let risk: RiskLevel
  let interpretation: string
  if (operatingCashflow > 0 && financingCashflow < 0) {
    risk = "low"
    interpretation = "Healthy pattern — operations fund debt paydown or capital returns"
  } else if (operatingCashflow < 0 && financingCashflow < 0) {
    risk = "high"
    interpretation = "Cash is being burned with no external financing support — risk of a liquidity shortfall"
  } else {
    risk = "moderate"
    interpretation = "Mixed operating/financing cash flow pattern"
  }
  return { value: qoffur, formatted: qoffur.toFixed(2), interpretation, risk }
}

// --- Macro-context ratios (CFOdigital-style) ---
// These require externally supplied macro inputs (yield curve spread, inflation, bond yield).

/** Liabilities to Yield Curve Alignment. yieldCurveSpread = short-term rate − long-term rate (as a decimal, e.g. 0.01 = 1%). */
export function calculateLYCA(
  yieldCurveSpread: number,
  currentLiabilities: number,
  longTermLiabilities: number,
  totalLiabilities: number
): CalculationResult {
  if (totalLiabilities === 0) throw new Error("Total liabilities cannot be zero")
  const lyca = yieldCurveSpread * ((currentLiabilities - longTermLiabilities) / totalLiabilities)
  return {
    value: lyca,
    formatted: lyca.toFixed(4),
    interpretation:
      lyca >= 0
        ? "Debt structure is favorably aligned with the prevailing yield curve"
        : "Debt structure is misaligned with the prevailing yield curve — relying on relatively costlier maturities",
    risk: "n/a",
  }
}

/** Inflation-Adjusted Inventory Carry-on Cost. annualInflationRate and daysInInventory as decimals/days. */
export function calculateIAICOC(
  inventory: number,
  totalAssets: number,
  annualInflationRate: number,
  daysInInventory: number
): CalculationResult {
  if (totalAssets === 0) throw new Error("Total assets cannot be zero")
  const iaicoc = (inventory / totalAssets) * Math.pow(1 + annualInflationRate, daysInInventory / 365)
  return {
    value: iaicoc,
    formatted: iaicoc.toFixed(4),
    interpretation: "Higher values indicate more capital tied up in inventory that is losing real value under inflation",
    risk: "n/a",
  }
}

/** ROA relative to the cost of borrowing (e.g. Moody's BAA yield). roa and bondRate as decimals. */
export function calculateROA2Bond(roa: number, bondRate: number): CalculationResult {
  if (bondRate === 0) throw new Error("Bond rate cannot be zero")
  const annualizedRoa = Math.pow(1 + roa, 4) - 1
  const ratio = annualizedRoa / bondRate
  let risk: RiskLevel
  let interpretation: string
  if (ratio > 1) {
    risk = "low"
    interpretation = "Returns on assets exceed the cost of borrowing — capital is being deployed efficiently"
  } else if (ratio >= 0) {
    risk = "moderate"
    interpretation = "Returns on assets are positive but below the cost of borrowing"
  } else {
    risk = "high"
    interpretation = "Negative returns on assets relative to the cost of borrowing"
  }
  return { value: ratio, formatted: ratio.toFixed(2), interpretation, risk }
}

export function calculateValuation(ebitda: number, multiple: number): CalculationResult {
  const valuation = ebitda * multiple
  return {
    value: valuation,
    formatted: formatCurrency(valuation),
    interpretation: `Estimated business valuation based on an EBITDA multiple of ${multiple}x.`,
    risk: "n/a",
  }
}
