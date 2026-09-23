import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { getCurrentUser, hasAllCalculatorAccess, isGoogleLinked } from "../../lib/auth"
import { getUserCalculations, SavedCalculation } from "../../lib/calculationStorage"
import { CALCULATORS } from "../../lib/calculatorConfig"
import { RiskBadge } from "../components/ui/RiskBadge"
import * as Icons from "lucide-react"
import { RiskLevel } from "../../lib/financialCalculations"
import { ArrowRight, BarChart3, TrendingUp, Sparkles, Loader2, X } from "lucide-react"
import { fetchAIAnalysis } from "../../lib/ai"
import { toast } from "sonner"

export default function DashboardPage() {
  const [calculations, setCalculations] = useState<SavedCalculation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const user = getCurrentUser()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showWelcome, setShowWelcome] = useState(searchParams.get("welcome") === "1" && !isGoogleLinked())

  function dismissWelcome() {
    setShowWelcome(false)
    searchParams.delete("welcome")
    setSearchParams(searchParams, { replace: true })
  }

  useEffect(() => {
    async function loadCalculations() {
      if (user) {
        try {
          const calcs = await getUserCalculations(user.id)
          setCalculations(calcs)
        } catch (error) {
          console.error("Failed to load calculations:", error)
          toast.error("Could not load your calculations. Please refresh.")
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
  const topCalculators = CALCULATORS.filter((calc) => {
    if (!user) return false
    if (hasAllCalculatorAccess(user)) return true
    return user.calculatorAccess?.includes(calc.id)
  }).slice(0, 3)

  const handleOverallAnalysis = async () => {
    if (recentCalcs.length === 0) {
      toast.error("Not enough data. Please perform some calculations first.")
      return
    }
    
    setIsAnalyzing(true)
    try {
      const summaryData = recentCalcs.map(calc => ({
        calculator: calc.calculatorType,
        result: (calc.results as any).formatted,
        risk: (calc.results as any).risk
      }))
      
      const prompt = `Here are the recent financial calculations for this business:
${JSON.stringify(summaryData, null, 2)}

Provide a cohesive overall summary of the company's financial health based on these metrics. Keep it concise, actionable, and professional. Highlight major red flags or strong points.`

      const analysis = await fetchAIAnalysis(prompt)
      setAiAnalysis(analysis)
    } catch (error) {
      toast.error((error as Error).message || "Failed to generate AI analysis")
    } finally {
      setIsAnalyzing(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Please sign in to view your dashboard.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {showWelcome && (
          <div className="mb-6 flex items-start justify-between gap-4 bg-primary/8 border border-primary/20 rounded-xl px-4 py-3">
            <p className="text-sm text-foreground">
              Add a backup sign-in so you never get locked out.{" "}
              <Link to="/profile" className="text-link hover:text-foreground font-medium transition-colors">
                Link your Google account
              </Link>
            </p>
            <button
              type="button"
              onClick={dismissWelcome}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-['Geist_Mono'] text-link uppercase tracking-widest mb-2">Dashboard</p>
          <h1
            className="text-3xl font-normal text-foreground"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Welcome back, {user.name || user.email.split("@")[0]}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Your financial analysis overview</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
          <div className="bg-card border border-foreground/8 rounded-xl p-6 flex items-start gap-4">
            <div className="w-11 h-11 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-link" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Analyses</p>
              <p className="text-4xl font-['Geist_Mono'] font-medium text-foreground">{totalCount}</p>
            </div>
          </div>

          <div className="bg-card border border-foreground/8 rounded-xl p-6 flex items-start gap-4">
            <div className="w-11 h-11 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Most Used</p>
              <p className="text-lg font-medium text-foreground">{mostUsedType ? mostUsedType.name : "-"}</p>
            </div>
          </div>
        </div>

        {/* Quick Access */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-foreground">Quick Access</h2>
            <Link
              to="/calculators"
              className="text-xs text-link hover:text-foreground transition-colors flex items-center gap-1"
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
                  className="group bg-card border border-foreground/8 hover:border-primary/35 rounded-xl p-5 transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between mb-3">
                    {Icon && (
                      <div className="p-2 bg-primary/10 border border-primary/20 rounded-lg text-link">
                        <Icon className="h-4 w-4" />
                      </div>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-link transition-colors opacity-0 group-hover:opacity-100" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{calc.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{calc.shortDescription}</p>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Overall AI Analysis */}
        {recentCalcs.length > 0 && (
          <div className="mb-8 bg-card border border-foreground/8 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-5 rounded-full bg-primary" />
                <h2 className="text-base font-medium text-foreground">Overall Financial Health</h2>
              </div>
              <button
                onClick={handleOverallAnalysis}
                disabled={isAnalyzing}
                className="flex items-center gap-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover px-4 py-2 rounded-lg transition-all disabled:opacity-50"
              >
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate AI Summary
              </button>
            </div>
            
            {aiAnalysis ? (
              <div className="p-5 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 text-link mb-3">
                  <Sparkles className="w-4 h-4" />
                  <h3 className="text-xs font-medium uppercase tracking-wider">AI Executive Summary</h3>
                </div>
                <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {aiAnalysis}
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-foreground/10 text-center">
                <p className="text-sm text-muted-foreground">Click the button above to generate an AI summary based on your {recentCalcs.length} recent calculations.</p>
              </div>
            )}
          </div>
        )}

        {/* Calculation history */}
        {isLoading ? (
          <div className="bg-card border border-foreground/8 rounded-xl p-12 text-center">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
          </div>
        ) : totalCount === 0 ? (
          <div className="bg-card border border-foreground/8 rounded-xl p-14 text-center">
            <div className="w-16 h-16 bg-foreground/3 border border-foreground/8 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icons.Calculator className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-2">No analyses yet</h3>
            <p className="text-sm text-muted-foreground mb-6">Start with a calculator to begin your financial analysis</p>
            <Link
              to="/calculators"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Browse Calculators
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div>
            <h2 className="text-base font-medium text-foreground mb-4">Recent Calculations</h2>
            <div className="bg-card border border-foreground/8 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-foreground/8">
                      <th className="text-left py-3.5 px-5 text-xs font-['Geist_Mono'] text-muted-foreground uppercase tracking-wider">Calculator</th>
                      <th className="text-left py-3.5 px-5 text-xs font-['Geist_Mono'] text-muted-foreground uppercase tracking-wider">Result</th>
                      <th className="text-left py-3.5 px-5 text-xs font-['Geist_Mono'] text-muted-foreground uppercase tracking-wider">Risk</th>
                      <th className="text-left py-3.5 px-5 text-xs font-['Geist_Mono'] text-muted-foreground uppercase tracking-wider">Date</th>
                      <th className="text-right py-3.5 px-5 text-xs font-['Geist_Mono'] text-muted-foreground uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCalcs.map((calc, i) => {
                      const calculator = CALCULATORS.find((c) => c.id === calc.calculatorType)
                      const result = calc.results as { formatted?: string; risk?: RiskLevel }
                      return (
                        <tr
                          key={calc.id}
                          className={`border-b border-foreground/5 hover:bg-foreground/3 transition-colors ${
                            i === recentCalcs.length - 1 ? "border-b-0" : ""
                          }`}
                        >
                          <td className="py-3.5 px-5 text-foreground font-medium">{calculator?.name || calc.calculatorType}</td>
                          <td className="py-3.5 px-5 font-['Geist_Mono'] text-accent">{result.formatted}</td>
                          <td className="py-3.5 px-5">
                            {result.risk && <RiskBadge risk={result.risk} />}
                          </td>
                          <td className="py-3.5 px-5 text-muted-foreground font-['Geist_Mono'] text-xs">
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
                              state={{ calculation: calc }}
                              className="inline-flex items-center gap-1.5 text-xs text-link hover:text-white border border-primary/30 hover:border-primary hover:bg-primary px-3 py-1.5 rounded-lg transition-all"
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
