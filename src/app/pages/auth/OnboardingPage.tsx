import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { Building2, Loader2 } from "lucide-react"
import { getCurrentUser, submitOnboarding } from "../../../lib/auth"
import { toast } from "sonner"

const CONSTITUTIONS = [
  "Sole Proprietorship",
  "Partnership Firm",
  "Limited Liability Partnership (LLP)",
  "Private Limited Company",
  "Public Limited Company",
  "One Person Company (OPC)",
  "Section 8 Company (Non-Profit)",
  "Trust",
  "Society",
  "Hindu Undivided Family (HUF)",
  "Cooperative Society",
  "Government Entity / PSU",
  "Other"
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [constitution, setConstitution] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const user = getCurrentUser()

  useEffect(() => {
    if (!user) {
      navigate("/auth/signin")
    } else if (user.businessConstitution) {
      navigate("/dashboard")
    }
  }, [user, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!constitution) {
      setError("Please select a business constitution")
      return
    }

    if (!user?.email) return

    setIsLoading(true)
    setError("")

    try {
      await submitOnboarding(user.email, constitution)
      toast.success("Welcome to FinRatio!")
      navigate("/dashboard")
    } catch (err: any) {
      setError(err.message || "Failed to save details. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) return null

  return (
    <div
      className="min-h-screen bg-[#050A14] flex items-center justify-center px-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.09) 0%, transparent 65%)" }}
      />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logoo.png" alt="FinRatio" className="h-14 w-auto mx-auto sm:h-16" />
          <span className="ml-2 text-[10px] font-['Geist_Mono'] bg-[#2563EB]/20 text-[#2563EB] border border-[#2563EB]/30 rounded px-1.5 py-0.5 leading-none">β</span>
        </div>

        <div className="bg-[#0D1726] border border-white/8 rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-[#2563EB]/10 border border-[#2563EB]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-[#2563EB]" />
            </div>
            <h2 className="text-lg font-medium text-white mb-1">Business Details</h2>
            <p className="text-xs text-[#64748B] leading-relaxed">
              What is the constitution of your business?
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#F1F5F9]">Constitution</label>
              <select
                value={constitution}
                onChange={(e) => setConstitution(e.target.value)}
                className="w-full px-4 py-3 bg-[#050A14] border border-white/10 rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors appearance-none"
                style={{
                  backgroundImage: "url(\"data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748B%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E\")",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 1rem top 50%",
                  backgroundSize: "0.65rem auto"
                }}
              >
                <option value="" disabled>Select your business type</option>
                {CONSTITUTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="bg-[#ef4444]/8 border border-[#ef4444]/25 text-[#ef4444] px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Continue to Dashboard"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
