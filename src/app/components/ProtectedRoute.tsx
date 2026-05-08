import { Navigate } from "react-router"
import { getCurrentUser } from "../../lib/auth"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const user = getCurrentUser()

  if (!user) {
    return <Navigate to="/auth/signin" replace />
  }

  return <>{children}</>
}
