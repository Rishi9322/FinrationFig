import { useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router"
import { fetchCurrentUser, getCurrentUser, type Role } from "../../lib/auth"

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: Role
  requiredFeature?: string
}

export function ProtectedRoute({ children, requiredRole, requiredFeature }: ProtectedRouteProps) {
  const location = useLocation()
  const [user, setUser] = useState(getCurrentUser())
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    let mounted = true
    async function validateSession() {
      try {
        const sessionUser = await fetchCurrentUser()
        if (mounted) {
          setUser(sessionUser)
        }
      } catch {
        if (mounted) {
          setUser(null)
        }
      } finally {
        if (mounted) {
          setIsChecking(false)
        }
      }
    }

    validateSession()
    return () => {
      mounted = false
    }
  }, [location.pathname, location.search])

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#050A14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/auth/signin?redirect=${redirect}`} replace />
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/access-denied" replace />
  }

  if (requiredFeature && !user.calculatorAccess?.includes(requiredFeature) && user.role === "USER") {
    return <Navigate to="/access-denied" replace />
  }

  return <>{children}</>
}
