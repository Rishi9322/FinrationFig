import { useState, useEffect } from "react"
import { CalculatorShell } from "../../components/calculators/CalculatorShell"
import { calculateAgeing, AgingResult, formatCurrency } from "../../../lib/financialCalculations"
import { RiskBadge } from "../../components/ui/RiskBadge"
import { Trash2, Plus, Loader2, BookmarkPlus, CheckCircle2 } from "lucide-react"
import { getCurrentUser } from "../../../lib/auth"
import { saveCalculation } from "../../../lib/calculationStorage"
import { toast } from "sonner"

interface Receivable {
  id: string
  amount: string
  daysOutstanding: string
}

export default function AgeingPage() {
  const [receivables, setReceivables] = useState<Receivable[]>([
    { id: crypto.randomUUID(), amount: "", daysOutstanding: "" },
  ])
  const [result, setResult] = useState<AgingResult | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const valid = receivables
      .filter((r) => r.amount && r.daysOutstanding)
      .map((r) => ({ amount: parseFloat(r.amount), daysOutstanding: parseFloat(r.daysOutstanding) }))
      .filter((r) => !isNaN(r.amount) && !isNaN(r.daysOutstanding) && r.amount > 0 && r.daysOutstanding >= 0)
    if (valid.length > 0) {
      try { setResult(calculateAgeing(valid)) } catch { setResult(null) }
    } else {
      setResult(null)
    }
  }, [receivables])

  const addReceivable = () =>
    setReceivables([...receivables, { id: crypto.randomUUID(), amount: "", daysOutstanding: "" }])

  const removeReceivable = (id: string) => {
    if (receivables.length > 1) setReceivables(receivables.filter((r) => r.id !== id))
  }

  const updateReceivable = (id: string, field: "amount" | "daysOutstanding", value: string) =>
    setReceivables(receivables.map((r) => (r.id === id ? { ...r, [field]: value } : r)))

  const handleSave = async () => {
    if (!result) return
    const user = getCurrentUser()
    if (!user) { toast.error("Please sign in to save calculations"); return }
    setIsSaving(true)
    try {
      const valid = receivables
        .filter((r) => r.amount && r.daysOutstanding)
        .map((r) => ({ amount: parseFloat(r.amount), daysOutstanding: parseFloat(r.daysOutstanding) }))
      await saveCalculation(user.id, "ageing", { receivables: valid }, {
        buckets: result.buckets, total: result.total, interpretation: result.interpretation, risk: result.risk,
      })
      toast.success("Calculation saved successfully")
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      toast.error("Failed to save calculation")
    } finally {
      setIsSaving(false)
    }
  }

  const accentColor =
    result?.risk === "low" ? "#10B981" : result?.risk === "moderate" ? "#f59e0b" : result?.risk === "high" ? "#ef4444" : "#64748B"

  return (
    <CalculatorShell
      title="Receivables Ageing Analysis"
      description="Analyses the age profile of outstanding receivables to identify collection risk."
      explainerText="Receivables Ageing Analysis categorises outstanding invoices into time buckets — current, 30–60 days, 60–90 days, and over 90 days — to identify concentration risk in older, harder-to-collect balances. Banks review ageing statements monthly as part of working capital monitoring. A high proportion of receivables beyond 90 days is a serious red flag, as it can indicate customer defaults, inflated book debts, or diversion of funds — all of which affect Drawing Power calculations and credit limit renewals."
      result={
        result ? (
          <div className="bg-[#0D1726] rounded-xl border border-white/8 p-6 space-y-5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {/* Header */}
            <div className="flex items-center gap-2 pb-4 border-b border-white/8">
              <div className="w-1.5 h-5 rounded-full" style={{ background: accentColor }} />
              <h3 className="text-sm font-medium text-white">Ageing Analysis</h3>
            </div>

            {/* Total + risk */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#64748B] mb-1">Total Receivables</p>
                <p className="text-2xl font-['Geist_Mono'] font-medium" style={{ color: accentColor }}>
                  {formatCurrency(result.total)}
                </p>
              </div>
              <RiskBadge risk={result.risk} />
            </div>

            {/* Buckets */}
            <div className="space-y-2.5">
              {result.buckets.map((bucket) => (
                <div key={bucket.label} className="bg-white/3 border border-white/5 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-white">{bucket.label}</p>
                    <p className="text-xs text-[#64748B]">{bucket.count} invoice{bucket.count !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="h-1.5 flex-1 mr-4 bg-white/8 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${bucket.percentage}%`, background: accentColor }}
                      />
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-['Geist_Mono'] text-[#F1F5F9]">{formatCurrency(bucket.amount)}</p>
                      <p className="text-xs text-[#64748B]">{bucket.percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Interpretation */}
            <div className="p-4 rounded-lg bg-white/3 border border-white/5">
              <p className="text-sm text-[#F1F5F9] leading-relaxed">{result.interpretation}</p>
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={isSaving || saved}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                saved
                  ? "bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981]"
                  : "bg-[#2563EB] hover:bg-[#1d4ed8] text-white disabled:opacity-60"
              }`}
            >
              {isSaving ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
              ) : saved ? (
                <><CheckCircle2 className="h-4 w-4" />Saved</>
              ) : (
                <><BookmarkPlus className="h-4 w-4" />Save Result</>
              )}
            </button>
          </div>
        ) : null
      }
    >
      <div className="space-y-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#64748B]">Enter each outstanding receivable below</p>
          <button
            onClick={addReceivable}
            className="flex items-center gap-1.5 text-xs text-[#2563EB] hover:text-white border border-[#2563EB]/30 hover:border-[#2563EB] hover:bg-[#2563EB] px-3 py-1.5 rounded-lg transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Row
          </button>
        </div>

        <div className="border border-white/8 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                <th className="px-4 py-3 text-left text-xs font-['Geist_Mono'] text-[#64748B] uppercase tracking-wider">Amount (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-['Geist_Mono'] text-[#64748B] uppercase tracking-wider">Days Outstanding</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {receivables.map((r, i) => (
                <tr
                  key={r.id}
                  className={`${i !== receivables.length - 1 ? "border-b border-white/5" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      value={r.amount}
                      onChange={(e) => updateReceivable(r.id, "amount", e.target.value)}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      className="w-full bg-[#050A14] border border-white/10 rounded-lg px-3 py-2 text-[#F1F5F9] text-sm font-['Geist_Mono'] placeholder:text-[#64748B]/50 focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      value={r.daysOutstanding}
                      onChange={(e) => updateReceivable(r.id, "daysOutstanding", e.target.value)}
                      placeholder="0"
                      min="0"
                      step="1"
                      className="w-full bg-[#050A14] border border-white/10 rounded-lg px-3 py-2 text-[#F1F5F9] text-sm font-['Geist_Mono'] placeholder:text-[#64748B]/50 focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {receivables.length > 1 && (
                      <button
                        onClick={() => removeReceivable(r.id)}
                        className="text-[#64748B] hover:text-[#ef4444] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-[#64748B] leading-relaxed">
          Each row is one outstanding invoice. Enter the amount and the number of days since it was due.
        </p>
      </div>
    </CalculatorShell>
  )
}
