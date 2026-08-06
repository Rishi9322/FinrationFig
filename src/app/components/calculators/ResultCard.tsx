import { useState } from "react"
import { CalculationResult, CalculatorType } from "../../../lib/financialCalculations"
import { RiskBadge } from "../ui/RiskBadge"
import { Loader2, BookmarkPlus, CheckCircle2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { saveCalculation } from "../../../lib/calculationStorage"
import { getCurrentUser } from "../../../lib/auth"
import { fetchAIAnalysis } from "../../../lib/ai"

interface ResultCardProps {
  result: CalculationResult
  calculatorType: CalculatorType
  inputs: Record<string, unknown>
}

export function ResultCard({ result, calculatorType, inputs }: ResultCardProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)

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

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    try {
      const prompt = `Analyze this ${calculatorType} calculation.
Inputs: ${JSON.stringify(inputs)}
Result: ${result.formatted}
Risk Level: ${result.risk}

Provide a short, actionable paragraph explaining what this means for the business and 1-2 bullet points on how to improve or maintain this metric.`

      const analysis = await fetchAIAnalysis(prompt)
      setAiAnalysis(analysis)
    } catch (error) {
      toast.error((error as Error).message || "Failed to generate AI analysis")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const accentColor =
    result.risk === "low" ? "#10B981" : result.risk === "moderate" ? "#f59e0b" : result.risk === "high" ? "#ef4444" : "#94A3B8"

  return (
    <div
      className="bg-[#0D1726] rounded-xl border border-white/8 p-6 space-y-5"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/8">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-5 rounded-full" style={{ background: accentColor }} />
          <h3 className="text-sm font-medium text-white">Result</h3>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-white bg-[#2563EB]/10 hover:bg-[#2563EB] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
        >
          {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Analyze
        </button>
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
          <p className="text-xs text-[#94A3B8] leading-relaxed border-t border-white/8 pt-2 mt-2">{result.details}</p>
        )}
      </div>

      {/* AI Analysis */}
      {aiAnalysis && (
        <div className="space-y-2 p-4 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20">
          <div className="flex items-center gap-1.5 text-[#2563EB] mb-2">
            <Sparkles className="w-4 h-4" />
            <h4 className="text-xs font-medium uppercase tracking-wider">AI Insights</h4>
          </div>
          <div className="text-sm text-[#F1F5F9] leading-relaxed whitespace-pre-wrap">
            {aiAnalysis}
          </div>
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={isSaving || saved}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
          saved
            ? "bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981]"
            : "bg-white/5 hover:bg-white/10 text-white disabled:opacity-60"
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
