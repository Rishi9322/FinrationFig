import { createBrowserRouter, Navigate } from "react-router"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { Navbar } from "./components/Navbar"
import HomePage from "./pages/HomePage"
import SignupPage from "./pages/auth/SignupPage"
import SigninPage from "./pages/auth/SigninPage"
import VerifyOtpPage from "./pages/auth/VerifyOtpPage"
import DashboardPage from "./pages/DashboardPage"
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

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
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
    path: "*",
    element: <Navigate to="/" replace />,
  },
])
