export type SourceFormat = "csv" | "xlsx" | "json" | "pdf" | "other"

/** The section a line sits under in the source ("Current Assets", "Equity and Liabilities", ...). */
export type Group =
  | "asset" | "current-asset" | "noncurrent-asset"
  | "liability" | "current-liability" | "noncurrent-liability" | "borrowing"
  | "equity" | "income" | "expense"

export interface LineItem {
  name: string
  value: number
  heading?: Group
}

export interface BalanceSection {
  name?: string
  amount: number
  group?: Group
}

export interface IncomeStatement {
  revenue?: number
  operatingExpenses?: number
  ebit?: number
  interestExpense?: number
  netOperatingIncome?: number
  totalDebtService?: number
  [k: string]: number | undefined
}

export interface ReceivableItem {
  amount: number
  daysOutstanding: number
  debtorName?: string
}

export interface ParsedBalanceSheet {
  sourceFilename?: string
  originalFormat: SourceFormat
  parsedAt: string // ISO
  accounts?: LineItem[]
  balanceSheet: {
    assets: BalanceSection[]
    liabilities: BalanceSection[]
    equity: BalanceSection[]
    totals?: { totalAssets?: number; totalLiabilities?: number; totalEquity?: number }
  }
  incomeStatement?: IncomeStatement
  receivables?: ReceivableItem[]
  metadata?: { confidence?: number; notes?: string; /** "lakhs", "crore"... as printed on the statement; amounts are not rupees. */ unit?: string; /** Consolidated and standalone statements both present; which one was read. */ bases?: Array<"consolidated" | "standalone">; basis?: "consolidated" | "standalone" }
}

export default ParsedBalanceSheet
