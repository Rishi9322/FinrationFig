// Single source of truth for the operator details and commitments quoted across
// the legal pages. Edit here, not in the page text.
export const LEGAL = {
  product: "FinRatio",
  siteUrl: "https://finratio.site",
  entity: "Balaji Credit Services Pvt. Ltd.",
  entityWebsite: "https://balajicredits.com",
  // Registered street address and CIN were not published on the company website;
  // add them here when available and they will appear on every page.
  location: "Mumbai, Maharashtra, India",
  email: "info@balajicredits.com",
  phone: "+91 97024 00500",
  courts: "Mumbai, Maharashtra",
  // Commitments made to users in the grievance policy. Change only if the
  // business can actually meet the new numbers.
  grievanceAckHours: 48,
  grievanceResolveDays: 30,
  lastUpdated: "1 October 2026",
} as const

export const LEGAL_PAGES = [
  { path: "/privacy", label: "Privacy Policy" },
  { path: "/terms", label: "Terms of Use" },
  { path: "/disclaimer", label: "Disclaimer" },
  { path: "/cookies", label: "Cookie Policy" },
  { path: "/grievance", label: "Grievance Redressal" },
] as const
