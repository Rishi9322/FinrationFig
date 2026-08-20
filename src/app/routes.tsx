import { createBrowserRouter, Navigate } from "react-router"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { Navbar } from "./components/Navbar"
import HomePage from "./pages/HomePage"
import SignupPage from "./pages/auth/SignupPage"
import SigninPage from "./pages/auth/SigninPage"
import VerifyOtpPage from "./pages/auth/VerifyOtpPage"
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage"
import ResetPasswordPage from "./pages/auth/ResetPasswordPage"
import OnboardingPage from "./pages/auth/OnboardingPage"
import DashboardPage from "./pages/DashboardPage"
import AccessDeniedPage from "./pages/AccessDeniedPage"
import UsersAdminPage from "./pages/admin/UsersAdminPage"
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage"
import { AdminUsersPage } from "./pages/admin/AdminUsersPage"
import { AdminCalculatorsPage } from "./pages/admin/AdminCalculatorsPage"
import { AdminCalculationsPage } from "./pages/admin/AdminCalculationsPage"
import { AdminPermissionsPage } from "./pages/admin/AdminPermissionsPage"
import { AdminSettingsPage } from "./pages/admin/AdminSettingsPage"
import CalculatorsIndexPage from "./pages/calculators/CalculatorsIndexPage"
import DebtEquityPage from "./pages/calculators/DebtEquityPage"
import QuasiDebtEquityPage from "./pages/calculators/QuasiDebtEquityPage"
import CurrentRatioPage from "./pages/calculators/CurrentRatioPage"
import DscrPage from "./pages/calculators/DscrPage"
import EbitdaPage from "./pages/calculators/EbitdaPage"
import IscrPage from "./pages/calculators/IscrPage"
import NetWorkingCapitalPage from "./pages/calculators/NetWorkingCapitalPage"
import DrawingPowerPage from "./pages/calculators/DrawingPowerPage"
import AgeingPage from "./pages/calculators/AgeingPage"
import PidPage from "./pages/calculators/PidPage"
import BusinessValuationPage from "./pages/calculators/BusinessValuationPage"
import WorkingCapitalCyclePage from "./pages/calculators/WorkingCapitalCyclePage"
import CashflowQualityPage from "./pages/calculators/CashflowQualityPage"
import MacroRatiosPage from "./pages/calculators/MacroRatiosPage"
import BalanceSheetAnalysisPage from "./pages/BalanceSheetAnalysisPage"
import CmaGeneratorPage from "../modules/cma/pages/CmaGeneratorPage"
import TestPdfPage from "./pages/TestPdfPage"
import ProfilePage from "./pages/ProfilePage"
import FeedbackPage from "./pages/FeedbackPage"
import AdminFeedbackPage from "./pages/admin/AdminFeedbackPage"
import AdminBlogPage from "./pages/admin/AdminBlogPage"
import BlogIndexPage from "./pages/BlogIndexPage"
import BlogPostPage from "./pages/BlogPostPage"

function ProtectedLayout({
  children,
  requiredRole,
  requiredFeature,
}: {
  children: React.ReactNode
  requiredRole?: "SUPER_ADMIN" | "ADMIN" | "USER"
  requiredFeature?: string
}) {
  return (
    <ProtectedRoute requiredRole={requiredRole} requiredFeature={requiredFeature}>
      <Navbar />
      <main>{children}</main>
    </ProtectedRoute>
  )
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  {
    path: "/test-pdf",
    element: (
      <ProtectedLayout requiredRole="SUPER_ADMIN">
        <TestPdfPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/auth/signup",
    element: <SignupPage />,
  },
  {
    path: "/auth/signin",
    element: <SigninPage />,
  },
  {
    // Firebase verifies email via a link, not a code — this page is obsolete.
    path: "/auth/verify-otp",
    element: <Navigate to="/auth/signin" replace />,
  },
  {
    path: "/auth/forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/auth/reset-password",
    element: <ResetPasswordPage />,
  },
  {
    path: "/auth/onboarding",
    element: <OnboardingPage />,
  },
  {
    path: "/access-denied",
    element: <AccessDeniedPage />,
  },
  {
    path: "/blog",
    element: (<><Navbar /><BlogIndexPage /></>),
  },
  {
    path: "/blog/:slug",
    element: (<><Navbar /><BlogPostPage /></>),
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedLayout>
        <DashboardPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators",
    element: (
      <ProtectedLayout>
        <CalculatorsIndexPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/dashboard/cma-generator",
    element: (
      <ProtectedLayout requiredFeature="cma-generator">
        <CmaGeneratorPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/doc-parser",
    element: (
      <ProtectedLayout requiredFeature="doc-parser">
        <BalanceSheetAnalysisPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculator",
    element: <Navigate to="/calculators" replace />,
  },
  {
    path: "/calculators/debt-equity",
    element: (
      <ProtectedLayout>
        <DebtEquityPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/quasi-debt-equity",
    element: (
      <ProtectedLayout>
        <QuasiDebtEquityPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/current-ratio",
    element: (
      <ProtectedLayout>
        <CurrentRatioPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/dscr",
    element: (
      <ProtectedLayout>
        <DscrPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/ebitda",
    element: (
      <ProtectedLayout>
        <EbitdaPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/iscr",
    element: (
      <ProtectedLayout>
        <IscrPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/net-working-capital",
    element: (
      <ProtectedLayout>
        <NetWorkingCapitalPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/drawing-power",
    element: (
      <ProtectedLayout>
        <DrawingPowerPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/ageing",
    element: (
      <ProtectedLayout>
        <AgeingPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/pid",
    element: (
      <ProtectedLayout>
        <PidPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/valuation",
    element: (
      <ProtectedLayout>
        <BusinessValuationPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/working-capital-cycle",
    element: (
      <ProtectedLayout>
        <WorkingCapitalCyclePage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/cashflow-quality",
    element: (
      <ProtectedLayout>
        <CashflowQualityPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/macro-ratios",
    element: (
      <ProtectedLayout>
        <MacroRatiosPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/profile",
    element: (
      <ProtectedLayout>
        <ProfilePage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/feedback",
    element: (
      <ProtectedLayout>
        <FeedbackPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/admin/feedback",
    element: (
      <ProtectedLayout requiredRole="SUPER_ADMIN">
        <AdminFeedbackPage />
      </ProtectedLayout>
    ),
  },
  {
    // ADMIN or SUPER_ADMIN may edit the blog (enforced server-side); the route
    // itself only requires being signed in, same as other non-role-gated pages.
    path: "/admin/blog",
    element: (
      <ProtectedLayout>
        <AdminBlogPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/admin",
    element: (
      <ProtectedLayout requiredRole="SUPER_ADMIN">
        <UsersAdminPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/admin/dashboard",
    element: (
      <ProtectedLayout requiredRole="SUPER_ADMIN">
        <AdminDashboardPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/admin/users",
    element: (
      <ProtectedLayout requiredRole="SUPER_ADMIN">
        <AdminUsersPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/admin/calculators",
    element: (
      <ProtectedLayout requiredRole="SUPER_ADMIN">
        <AdminCalculatorsPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/admin/calculations",
    element: (
      <ProtectedLayout requiredRole="SUPER_ADMIN">
        <AdminCalculationsPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/admin/permissions",
    element: (
      <ProtectedLayout requiredRole="SUPER_ADMIN">
        <AdminPermissionsPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/admin/settings",
    element: (
      <ProtectedLayout requiredRole="SUPER_ADMIN">
        <AdminSettingsPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
])
