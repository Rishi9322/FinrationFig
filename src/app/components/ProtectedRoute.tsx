import { Navigate, useLocation } from "react-router"
import { getCurrentUser } from "../../lib/auth"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const user = getCurrentUser()

  if (!user) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/auth/signin?redirect=${redirect}`} replace />
  }

  return <>{children}</>
}
