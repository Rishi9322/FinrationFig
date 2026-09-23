// Some ratios use a different formula base (and input labels) depending on
// the user's business constitution - e.g. an LLP has no share capital, so
// "equity" is partners' capital + current account balance instead. Pvt Ltd /
// Ltd / OPC share a different base (share capital + reserves) but the same
// formula shape. Constitutions not listed here use the generic labels/formula.
export type EquityVariant = "llp" | "company"

const LLP_CONSTITUTIONS = ["Limited Liability Partnership (LLP)"]
const COMPANY_CONSTITUTIONS = ["Private Limited Company", "Public Limited Company", "One Person Company (OPC)"]

export function getEquityVariant(businessConstitution: string | undefined): EquityVariant | null {
  if (!businessConstitution) return null
  if (LLP_CONSTITUTIONS.includes(businessConstitution)) return "llp"
  if (COMPANY_CONSTITUTIONS.includes(businessConstitution)) return "company"
  return null
}

// Profit % has only been confirmed for LLP and Pvt Ltd/Ltd/OPC so far - same
// set of constitutions as the equity-variant ratios above.
export function isProfitPercentEligible(businessConstitution: string | undefined): boolean {
  return getEquityVariant(businessConstitution) !== null
}

export const EQUITY_VARIANT_LABELS: Record<EquityVariant, { base: string; baseHelper: string; addOn: string; addOnHelper: string }> = {
  llp: {
    base: "Capital + Partners' Account Balance",
    baseHelper: "Partners' capital and current account balance",
    addOn: "Unsecured Loan from Partners",
    addOnHelper: "Unsecured loans brought in by partners",
  },
  company: {
    base: "Share Capital + Reserves & Surplus",
    baseHelper: "Paid-up share capital plus reserves and surplus",
    addOn: "Unsecured Loan from Directors",
    addOnHelper: "Unsecured loans brought in by directors",
  },
}
