import { useState, useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { CALCULATORS } from "../../lib/calculatorConfig"
import { getCurrentUser, signout } from "../../lib/auth"
import { Menu, X, ChevronDown, LogOut } from "lucide-react"
import * as Icons from "lucide-react"
import { toast } from "sonner"

export function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = getCurrentUser()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [calcOpen, setCalcOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", fn, { passive: true })
    return () => window.removeEventListener("scroll", fn)
  }, [])

  async function handleSignOut() {
    try {
      await signout()
    } catch {
      // Ignore logout API failures and force local logout UX.
    }
    toast.success("Signed out successfully")
    navigate("/auth/signin")
  }

  const visibleCalculators = CALCULATORS.filter((calc) => {
    if (!user) return false
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true
    return user.calculatorAccess?.includes(calc.id)
  })

  const isActive = (path: string) => location.pathname === path
  const calcActive = location.pathname.startsWith("/calculators")
  const adminActive = location.pathname.startsWith("/admin")

  return (
    <>
      <nav
        className={`sticky top-0 z-50 h-16 flex items-center transition-all duration-300 ${
          scrolled ? "bg-[#050A14]/95 backdrop-blur-md border-b border-white/8 shadow-lg" : "bg-[#050A14] border-b border-white/8"
        } font-['DM_Sans',sans-serif]`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex items-center justify-between">
          {/* Wordmark */}
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src="/logoo.png" alt="FinRatio" className="h-20 w-auto sm:h-11" />
            <span className="text-[10px] font-['Geist_Mono'] bg-[#2563EB]/20 text-[#2563EB] border border-[#2563EB]/30 rounded px-1.5 py-0.5 leading-none">
              β
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              to="/dashboard"
              className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                isActive("/dashboard")
                  ? "text-white bg-white/8"
                  : "text-[#64748B] hover:text-white hover:bg-white/5"
              }`}
            >
              Dashboard
            </Link>

            <Link
              to="/dashboard/cma-generator"
              className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                isActive("/dashboard/cma-generator")
                  ? "text-white bg-white/8"
                  : "text-[#64748B] hover:text-white hover:bg-white/5"
              }`}
            >
              CMA Engine
            </Link>

            <Link
              to="/doc-parser"
              className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                isActive("/doc-parser") ? "text-white bg-white/8" : "text-[#64748B] hover:text-white hover:bg-white/5"
              }`}
            >
              Doc Parser
            </Link>

            {/* Calculators dropdown */}
            <div className="relative">
              <button
                onClick={() => setCalcOpen(!calcOpen)}
                onBlur={() => setTimeout(() => setCalcOpen(false), 200)}
                className={`text-sm px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors ${
                  calcActive ? "text-white bg-white/8" : "text-[#64748B] hover:text-white hover:bg-white/5"
                }`}
              >
                Calculators
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${calcOpen ? "rotate-180" : ""}`} />
              </button>

              {calcOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-[#0D1726] border border-white/10 rounded-xl shadow-2xl py-2 max-h-[480px] overflow-y-auto">
                  {visibleCalculators.map((calc) => {
                    const Icon = Icons[calc.icon as keyof typeof Icons] as React.ComponentType<{ className?: string }>
                    return (
                      <Link
                        key={calc.id}
                        to={calc.path}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-[#2563EB]"
                        onClick={() => setCalcOpen(false)}
                      >
                        {Icon && (
                          <div className="p-1.5 bg-[#2563EB]/10 border border-[#2563EB]/20 rounded-lg text-[#2563EB] mt-0.5 shrink-0">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-white">{calc.name}</div>
                          <div className="text-xs text-[#64748B] mt-0.5 leading-relaxed">{calc.shortDescription}</div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {user && (
              <>
                {user.role === "SUPER_ADMIN" && (
                  <Link
                    to="/admin"
                    className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                      adminActive
                        ? "text-white bg-white/8"
                        : "text-[#64748B] hover:text-white hover:bg-white/5"
                    }`}
                  >
                    Admin
                  </Link>
                )}
                <div className="h-4 w-px bg-white/10 mx-2" />
                <span className="text-sm text-[#64748B]">{user.name || user.email}</span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors ml-1"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-[#64748B] hover:text-white transition-colors"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 bg-[#0D1726] border-b border-white/8 max-h-[80vh] overflow-y-auto z-50">
            <div className="px-4 py-4 space-y-1">
              <Link
                to="/dashboard"
                className="block text-sm text-[#F1F5F9] px-3 py-2.5 rounded-lg hover:bg-white/5"
                onClick={() => setMobileOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                to="/doc-parser"
                className="block text-sm text-[#F1F5F9] px-3 py-2.5 rounded-lg hover:bg-white/5"
                onClick={() => setMobileOpen(false)}
              >
                Doc Parser
              </Link>
              <div className="pt-2 pb-1">
                <p className="text-xs font-['Geist_Mono'] text-[#64748B] uppercase tracking-widest px-3 mb-2">Calculators</p>
                {visibleCalculators.map((calc) => {
                  const Icon = Icons[calc.icon as keyof typeof Icons] as React.ComponentType<{ className?: string }>
                  return (
                    <Link
                      key={calc.id}
                      to={calc.path}
                      className="flex items-center gap-2 pl-3 pr-3 py-2.5 text-sm text-[#64748B] hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                      onClick={() => setMobileOpen(false)}
                    >
                      {Icon && <Icon className="h-4 w-4 shrink-0" />}
                      {calc.name}
                    </Link>
                  )
                })}
              </div>
              {user && (
                <div className="pt-3 border-t border-white/8 mt-2">
                  {user.role === "SUPER_ADMIN" && (
                    <Link
                      to="/admin"
                      className="block text-sm text-[#F1F5F9] px-3 py-2.5 rounded-lg hover:bg-white/5"
                      onClick={() => setMobileOpen(false)}
                    >
                      Admin
                    </Link>
                  )}
                  <p className="text-sm text-[#64748B] px-3 py-1.5">{user.name || user.email}</p>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-sm text-[#64748B] hover:text-white px-3 py-2.5 rounded-lg hover:bg-white/5 w-full transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  )
}
