export type SourceFormat = "csv" | "xlsx" | "json" | "pdf" | "other"

export interface LineItem {
  name: string
  value: number
}

export interface BalanceSection {
  name?: string
  amount: number
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
  metadata?: { confidence?: number; notes?: string }
}

export default ParsedBalanceSheet
