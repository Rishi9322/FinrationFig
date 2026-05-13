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
      {children}
    </ProtectedRoute>
  )
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
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
    path: "/auth/verify-otp",
    element: <VerifyOtpPage />,
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
    path: "/calculator",
    element: <Navigate to="/calculators" replace />,
  },
  {
    path: "/calculators/debt-equity",
    element: (
      <ProtectedLayout requiredFeature="debt-equity">
        <DebtEquityPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/quasi-debt-equity",
    element: (
      <ProtectedLayout requiredFeature="quasi-debt-equity">
        <QuasiDebtEquityPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/current-ratio",
    element: (
      <ProtectedLayout requiredFeature="current-ratio">
        <CurrentRatioPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/dscr",
    element: (
      <ProtectedLayout requiredFeature="dscr">
        <DscrPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/ebitda",
    element: (
      <ProtectedLayout requiredFeature="ebitda">
        <EbitdaPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/iscr",
    element: (
      <ProtectedLayout requiredFeature="iscr">
        <IscrPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/net-working-capital",
    element: (
      <ProtectedLayout requiredFeature="net-working-capital">
        <NetWorkingCapitalPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/drawing-power",
    element: (
      <ProtectedLayout requiredFeature="drawing-power">
        <DrawingPowerPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/ageing",
    element: (
      <ProtectedLayout requiredFeature="ageing">
        <AgeingPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/pid",
    element: (
      <ProtectedLayout requiredFeature="pid">
        <PidPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/valuation",
    element: (
      <ProtectedLayout requiredFeature="valuation">
        <BusinessValuationPage />
      </ProtectedLayout>
    ),
  },
  {
    path: "/calculators/working-capital-cycle",
    element: (
      <ProtectedLayout requiredFeature="working-capital-cycle">
        <WorkingCapitalCyclePage />
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
    path: "/admin/users",
    element: <Navigate to="/admin" replace />,
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
])
