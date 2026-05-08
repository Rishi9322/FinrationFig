import { CalculatorType } from "./financialCalculations"

export interface CalculatorConfig {
  id: CalculatorType
  name: string
  description: string
  path: string
  icon: string
  shortDescription: string
}

export const CALCULATORS: CalculatorConfig[] = [
  {
    id: "debt-equity",
    name: "Debt-to-Equity Ratio",
    description: "Measures financial leverage by comparing total debt to shareholders' equity.",
    shortDescription: "Assess financial leverage and capital structure",
    path: "/calculators/debt-equity",
    icon: "Scale",
  },
  {
    id: "quasi-debt-equity",
    name: "Quasi Debt-to-Equity Ratio",
    description:
      "Includes hybrid instruments like preference shares alongside standard debt in the leverage calculation.",
    shortDescription: "Leverage ratio including hybrid debt instruments",
    path: "/calculators/quasi-debt-equity",
    icon: "GitMerge",
  },
  {
    id: "current-ratio",
    name: "Current Ratio",
    description: "Evaluates short-term liquidity by comparing current assets to current liabilities.",
    shortDescription: "Measure short-term liquidity position",
    path: "/calculators/current-ratio",
    icon: "Droplets",
  },
  {
    id: "dscr",
    name: "Debt Service Coverage Ratio",
    description: "Determines whether operating income is sufficient to service all debt obligations.",
    shortDescription: "Check debt repayment capacity from operations",
    path: "/calculators/dscr",
    icon: "ShieldCheck",
  },
  {
    id: "ebitda",
    name: "EBITDA",
    description:
      "Calculates earnings before interest, tax, depreciation, and amortisation as a proxy for operating cash flow.",
    shortDescription: "Compute core operating profitability",
    path: "/calculators/ebitda",
    icon: "TrendingUp",
  },
  {
    id: "iscr",
    name: "Interest Service Coverage Ratio",
    description: "Assesses the ability to meet interest payments from operating earnings.",
    shortDescription: "Evaluate ability to service interest payments",
    path: "/calculators/iscr",
    icon: "Percent",
  },
  {
    id: "net-working-capital",
    name: "Net Working Capital",
    description:
      "Measures the surplus of current assets over current liabilities as a liquidity buffer.",
    shortDescription: "Quantify short-term operational liquidity buffer",
    path: "/calculators/net-working-capital",
    icon: "Wallet",
  },
  {
    id: "drawing-power",
    name: "Drawing Power",
    description:
      "Calculates the maximum working capital limit a business can draw against pledged collateral.",
    shortDescription: "Compute maximum cash credit drawing limit",
    path: "/calculators/drawing-power",
    icon: "CreditCard",
  },
  {
    id: "ageing",
    name: "Receivables Ageing Analysis",
    description: "Analyses the age profile of outstanding receivables to identify collection risk.",
    shortDescription: "Identify overdue receivables and collection risk",
    path: "/calculators/ageing",
    icon: "Clock",
  },
]
