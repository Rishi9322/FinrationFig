import { useState } from "react"
import { CalculationResult, CalculatorType } from "../../../lib/financialCalculations"
import { RiskBadge } from "../ui/RiskBadge"
import { Loader2, BookmarkPlus, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { saveCalculation } from "../../../lib/calculationStorage"
import { getCurrentUser } from "../../../lib/auth"

interface ResultCardProps {
  result: CalculationResult
  calculatorType: CalculatorType
  inputs: Record<string, unknown>
}

export function ResultCard({ result, calculatorType, inputs }: ResultCardProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    const user = getCurrentUser()
    if (!user) {
      toast.error("Please sign in to save results")
      return
    }
    setIsSaving(true)
    try {
      await saveCalculation(user.id, calculatorType, inputs, {
        value: result.value,
        formatted: result.formatted,
        interpretation: result.interpretation,
        risk: result.risk,
        details: result.details,
      })
      toast.success("Result saved successfully")
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      toast.error("Failed to save result")
    } finally {
      setIsSaving(false)
    }
  }

  const accentColor =
    result.risk === "low" ? "#10B981" : result.risk === "moderate" ? "#f59e0b" : result.risk === "high" ? "#ef4444" : "#64748B"

  return (
    <div
      className="bg-[#0D1726] rounded-xl border border-white/8 p-6 space-y-5"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-white/8">
        <div className="w-1.5 h-5 rounded-full" style={{ background: accentColor }} />
        <h3 className="text-sm font-medium text-white">Result</h3>
      </div>

      {/* Main value */}
      <div className="space-y-3">
        <div
          className="text-5xl font-normal tabular-nums leading-none"
          style={{ fontFamily: "'Geist Mono', monospace", color: accentColor }}
        >
          {result.formatted}
        </div>
        <RiskBadge risk={result.risk} />
      </div>

      {/* Interpretation */}
      <div className="space-y-2 p-4 rounded-lg bg-white/3 border border-white/5">
        <p className="text-sm text-[#F1F5F9] leading-relaxed">{result.interpretation}</p>
        {result.details && (
          <p className="text-xs text-[#64748B] leading-relaxed border-t border-white/8 pt-2 mt-2">{result.details}</p>
        )}
      </div>

      {/* Save button */}
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
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : saved ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Saved
          </>
        ) : (
          <>
            <BookmarkPlus className="h-4 w-4" />
            Save Result
          </>
        )}
      </button>
    </div>
  )
}
