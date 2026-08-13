import { useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router"
import { fetchCurrentUser, getCurrentUser, type Role } from "../../lib/auth"
import { RESTRICTED_FEATURES } from "../../lib/calculatorFeatures"
import ComingSoonPage from "../pages/ComingSoonPage"

const FEATURE_TITLES: Record<string, string> = Object.fromEntries(
  RESTRICTED_FEATURES.map((feature) => [feature.slug, feature.name]),
)

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

  if (!user.businessConstitution && location.pathname !== "/auth/onboarding") {
    return <Navigate to="/auth/onboarding" replace />
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/access-denied" replace />
  }

  // A missing feature grant is presented as "coming soon" rather than a refusal:
  // these are tools being rolled out, not sections the user was denied. Role
  // failures above still read as restricted, because those really are.
  if (requiredFeature && !user.calculatorAccess?.includes(requiredFeature) && user.role === "USER") {
    return <ComingSoonPage title={FEATURE_TITLES[requiredFeature]} />
  }

  return <>{children}</>
}
