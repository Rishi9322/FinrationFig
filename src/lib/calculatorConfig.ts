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
  {
    id: "pid",
    name: "Purchase Invoice Discounting",
    description: "Calculate the net benefit of purchase invoice discounting facility.",
    shortDescription: "Assess the benefit of PID facility",
    path: "/calculators/pid",
    icon: "BadgePercent",
  },
  {
    id: "valuation",
    name: "Business Valuation",
    description: "Estimate the value of your business based on EBITDA multiples.",
    shortDescription: "Estimate business valuation using EBITDA",
    path: "/calculators/valuation",
    icon: "BarChart",
  },
  {
    id: "working-capital-cycle",
    name: "Working Capital Cycle %",
    description: "Analyze creditors, debtors, and stock as a percentage of purchases or sales.",
    shortDescription: "Analyze working capital components",
    path: "/calculators/working-capital-cycle",
    icon: "RefreshCw",
  },
  {
    id: "cashflow-quality",
    name: "Quality of Cashflow Ratios",
    description:
      "NCG, OCG, CLCC, OCS, QPT and QOFFUR — assess how effectively a business manages its sources and uses of cash.",
    shortDescription: "Assess the quality behind reported cashflows",
    path: "/calculators/cashflow-quality",
    icon: "Waves",
  },
  {
    id: "macro-ratios",
    name: "Macro-Context Ratios",
    description:
      "LYCA, IAICOC and ROA2Bond — read debt structure, inventory cost, and returns against the macroeconomic environment.",
    shortDescription: "Benchmark ratios against macro conditions",
    path: "/calculators/macro-ratios",
    icon: "Globe",
  },
]
