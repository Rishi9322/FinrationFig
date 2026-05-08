import { useEffect, useState } from "react"
import { Link } from "react-router"
import { getCurrentUser } from "../../lib/auth"
import { getUserCalculations, SavedCalculation } from "../../lib/calculationStorage"
import { CALCULATORS } from "../../lib/calculatorConfig"
import { RiskBadge } from "../components/ui/RiskBadge"
import * as Icons from "lucide-react"
import { RiskLevel } from "../../lib/financialCalculations"
import { ArrowRight, BarChart3, TrendingUp } from "lucide-react"

export default function DashboardPage() {
  const [calculations, setCalculations] = useState<SavedCalculation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const user = getCurrentUser()

  useEffect(() => {
    async function loadCalculations() {
      if (user) {
        try {
          const calcs = await getUserCalculations(user.id)
          setCalculations(calcs)
        } catch (error) {
          console.error("Failed to load calculations:", error)
        } finally {
          setIsLoading(false)
        }
      }
    }
    loadCalculations()
  }, [user])

  const totalCount = calculations.length
  const recentCalcs = calculations.slice(0, 10)

  function getMostUsedCalculator() {
    if (calculations.length === 0) return null
    const counts: Record<string, number> = {}
    calculations.forEach((calc) => { counts[calc.calculatorType] = (counts[calc.calculatorType] || 0) + 1 })
    const mostUsed = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    return CALCULATORS.find((c) => c.id === mostUsed[0])
  }

  const mostUsedType = getMostUsedCalculator()
  const topCalculators = CALCULATORS.slice(0, 3)

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050A14] flex items-center justify-center">
        <p className="text-[#64748B]">Please sign in to view your dashboard.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050A14] py-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-['Geist_Mono'] text-[#2563EB] uppercase tracking-widest mb-2">Dashboard</p>
          <h1
            className="text-3xl font-normal text-white"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Welcome back, {user.name || user.email.split("@")[0]}
          </h1>
          <p className="text-sm text-[#64748B] mt-1">Your financial analysis overview</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
          <div className="bg-[#0D1726] border border-white/8 rounded-xl p-6 flex items-start gap-4">
            <div className="w-11 h-11 bg-[#2563EB]/10 border border-[#2563EB]/20 rounded-xl flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-[#2563EB]" />
            </div>
            <div>
              <p className="text-xs text-[#64748B] mb-1">Total Analyses</p>
              <p className="text-4xl font-['Geist_Mono'] font-medium text-white">{totalCount}</p>
            </div>
          </div>

          <div className="bg-[#0D1726] border border-white/8 rounded-xl p-6 flex items-start gap-4">
            <div className="w-11 h-11 bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-[#10B981]" />
            </div>
            <div>
              <p className="text-xs text-[#64748B] mb-1">Most Used</p>
              <p className="text-lg font-medium text-white">{mostUsedType ? mostUsedType.name : "—"}</p>
            </div>
          </div>
        </div>

        {/* Quick Access */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-white">Quick Access</h2>
            <Link
              to="/calculators"
              className="text-xs text-[#2563EB] hover:text-white transition-colors flex items-center gap-1"
            >
              All calculators
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {topCalculators.map((calc) => {
              const Icon = Icons[calc.icon as keyof typeof Icons] as React.ComponentType<{ className?: string }>
              return (
                <Link
                  key={calc.id}
                  to={calc.path}
                  className="group bg-[#0D1726] border border-white/8 hover:border-[#2563EB]/35 rounded-xl p-5 transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between mb-3">
                    {Icon && (
                      <div className="p-2 bg-[#2563EB]/10 border border-[#2563EB]/20 rounded-lg text-[#2563EB]">
                        <Icon className="h-4 w-4" />
                      </div>
                    )}
                    <ArrowRight className="h-4 w-4 text-[#64748B] group-hover:text-[#2563EB] transition-colors opacity-0 group-hover:opacity-100" />
                  </div>
                  <p className="text-sm font-medium text-white">{calc.name}</p>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">{calc.shortDescription}</p>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Calculation history */}
        {isLoading ? (
          <div className="bg-[#0D1726] border border-white/8 rounded-xl p-12 text-center">
            <div className="w-8 h-8 border-2 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin mx-auto" />
          </div>
        ) : totalCount === 0 ? (
          <div className="bg-[#0D1726] border border-white/8 rounded-xl p-14 text-center">
            <div className="w-16 h-16 bg-white/3 border border-white/8 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icons.Calculator className="h-8 w-8 text-[#64748B]" />
            </div>
            <h3 className="text-base font-medium text-white mb-2">No analyses yet</h3>
            <p className="text-sm text-[#64748B] mb-6">Start with a calculator to begin your financial analysis</p>
            <Link
              to="/calculators"
              className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Browse Calculators
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div>
            <h2 className="text-base font-medium text-white mb-4">Recent Calculations</h2>
            <div className="bg-[#0D1726] border border-white/8 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-left py-3.5 px-5 text-xs font-['Geist_Mono'] text-[#64748B] uppercase tracking-wider">Calculator</th>
                      <th className="text-left py-3.5 px-5 text-xs font-['Geist_Mono'] text-[#64748B] uppercase tracking-wider">Result</th>
                      <th className="text-left py-3.5 px-5 text-xs font-['Geist_Mono'] text-[#64748B] uppercase tracking-wider">Risk</th>
                      <th className="text-left py-3.5 px-5 text-xs font-['Geist_Mono'] text-[#64748B] uppercase tracking-wider">Date</th>
                      <th className="text-right py-3.5 px-5 text-xs font-['Geist_Mono'] text-[#64748B] uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCalcs.map((calc, i) => {
                      const calculator = CALCULATORS.find((c) => c.id === calc.calculatorType)
                      const result = calc.results as { formatted?: string; risk?: RiskLevel }
                      return (
                        <tr
                          key={calc.id}
                          className={`border-b border-white/5 hover:bg-white/3 transition-colors ${
                            i === recentCalcs.length - 1 ? "border-b-0" : ""
                          }`}
                        >
                          <td className="py-3.5 px-5 text-[#F1F5F9] font-medium">{calculator?.name || calc.calculatorType}</td>
                          <td className="py-3.5 px-5 font-['Geist_Mono'] text-[#10B981]">{result.formatted}</td>
                          <td className="py-3.5 px-5">
                            {result.risk && <RiskBadge risk={result.risk} />}
                          </td>
                          <td className="py-3.5 px-5 text-[#64748B] font-['Geist_Mono'] text-xs">
                            {new Date(calc.createdAt).toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <Link
                              to={calculator?.path || "/calculators"}
                              className="inline-flex items-center gap-1.5 text-xs text-[#2563EB] hover:text-white border border-[#2563EB]/30 hover:border-[#2563EB] hover:bg-[#2563EB] px-3 py-1.5 rounded-lg transition-all"
                            >
                              Open
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
