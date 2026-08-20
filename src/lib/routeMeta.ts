import { CALCULATORS } from "./calculatorConfig"

export interface RouteMeta {
  title: string
  description: string
}

const SITE_NAME = "FinRatio"
const DEFAULT_META: RouteMeta = {
  title: `${SITE_NAME} — Financial Ratio Analysis for Indian SMEs`,
  description:
    "FinRatio — financial intelligence for Indian business. Upload a balance sheet and run 12+ ratio calculators, CMA reports and risk assessments.",
}

// Static entries for non-calculator routes, keyed by exact pathname.
const STATIC_ROUTES: Record<string, RouteMeta> = {
  "/": DEFAULT_META,
  "/dashboard": { title: `Dashboard — ${SITE_NAME}`, description: "Your FinRatio dashboard — calculation history, saved reports, and quick access to every calculator." },
  "/calculators": { title: `Calculators — ${SITE_NAME}`, description: "12+ financial ratio calculators for Indian SMEs and credit teams: D/E, DSCR, ISCR, EBITDA, Current Ratio, and more." },
  "/dashboard/cma-generator": { title: `CMA Report Generator — ${SITE_NAME}`, description: "Generate RBI-format Credit Monitoring Arrangement (CMA) reports from a balance sheet upload, with AI-assisted analysis." },
  "/doc-parser": { title: `Document Parser — ${SITE_NAME}`, description: "Upload and parse balance sheets and financial statements for automated ratio extraction." },
  "/profile": { title: `Your Profile — ${SITE_NAME}`, description: "Manage your FinRatio account details." },
  "/feedback": { title: `Feedback — ${SITE_NAME}`, description: "Share a review, feature request, or bug report with the FinRatio team." },
  "/auth/signup": { title: `Sign Up — ${SITE_NAME}`, description: "Create a free FinRatio account to start analyzing your business's financial ratios." },
  "/auth/signin": { title: `Sign In — ${SITE_NAME}`, description: "Sign in to your FinRatio account." },
}

// Calculator routes reuse the name/description already maintained in
// calculatorConfig.ts, so there's one source of truth instead of two.
const CALCULATOR_ROUTES: Record<string, RouteMeta> = Object.fromEntries(
  CALCULATORS.map((calc) => [calc.path, { title: `${calc.name} Calculator — ${SITE_NAME}`, description: calc.description }])
)

const ROUTES: Record<string, RouteMeta> = { ...STATIC_ROUTES, ...CALCULATOR_ROUTES }

export function getRouteMeta(pathname: string): RouteMeta {
  return ROUTES[pathname] ?? DEFAULT_META
}
