// Single source of truth for the calculator catalog, shared by the client and
// the seed/admin tooling. Slugs must match the requiredFeature values in routes.
export type CalculatorFeature = {
  slug: string
  name: string
}

export const CALCULATOR_FEATURES: CalculatorFeature[] = [
  { slug: "debt-equity", name: "Debt-to-Equity Ratio" },
  { slug: "quasi-debt-equity", name: "Quasi Debt-to-Equity Ratio" },
  { slug: "current-ratio", name: "Current Ratio" },
  { slug: "dscr", name: "Debt Service Coverage Ratio" },
  { slug: "ebitda", name: "EBITDA" },
  { slug: "iscr", name: "Interest Service Coverage Ratio" },
  { slug: "net-working-capital", name: "Net Working Capital" },
  { slug: "drawing-power", name: "Drawing Power" },
  { slug: "ageing", name: "Receivables Ageing Analysis" },
  { slug: "pid", name: "Purchase Invoice Discounting" },
  { slug: "valuation", name: "Business Valuation" },
  { slug: "working-capital-cycle", name: "Working Capital Cycle" },
]

export const CALCULATOR_SLUGS = CALCULATOR_FEATURES.map((f) => f.slug)
export const DEFAULT_FEATURE_SLUG = "pid"
