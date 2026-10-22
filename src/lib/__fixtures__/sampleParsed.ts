import type ParsedBalanceSheet from "../parsedBalanceSheet";

// Made-up figures for a small trading company (₹ lakhs), shaped like a parsed Schedule III statement.
// Used by the report's render test and the dev-only sample page - not real client data.
export const sampleParsed: ParsedBalanceSheet = {
  sourceFilename: "sample-traders-fy2025-26.pdf",
  originalFormat: "pdf",
  parsedAt: "2026-03-31",
  balanceSheet: {
    assets: [
      { name: "Property, Plant and Equipment", amount: 60, group: "noncurrent-asset" },
      { name: "Inventories", amount: 1620, group: "current-asset" },
      { name: "Trade Receivables", amount: 1500, group: "current-asset" },
      { name: "Cash and Cash Equivalents", amount: 120, group: "current-asset" },
      { name: "Short Term Loans and Advances", amount: 900, group: "current-asset" },
    ],
    liabilities: [
      { name: "Long Term Borrowings", amount: 800, group: "noncurrent-liability" },
      { name: "Short Term Borrowings", amount: 400, group: "current-liability" },
      { name: "Trade Payables", amount: 900, group: "current-liability" },
      { name: "Other Current Liabilities", amount: 500, group: "current-liability" },
    ],
    equity: [
      { name: "Share Capital", amount: 100, group: "equity" },
      { name: "Reserves and Surplus", amount: 1500, group: "equity" },
    ],
    totals: { totalAssets: 4200, totalLiabilities: 4200 },
  },
  incomeStatement: {
    revenue: 11000,
    depreciation: 40,
    interestExpense: 150,
    "profit before tax": 700,
    "net profit": 520,
    ebit: 850,
  },
  metadata: { confidence: 0.95, unit: "lakhs", notes: "Sample data for previewing the report." },
};
