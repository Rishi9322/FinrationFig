import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Download, Loader2, BookmarkPlus } from "lucide-react"
import { CalculatorType, CalculationResult } from "../../../lib/financialCalculations"
import * as calc from "../../../lib/financialCalculations"
import { CALCULATORS } from "../../../lib/calculatorConfig"
import { RiskBadge } from "../ui/RiskBadge"
import { saveCalculation } from "../../../lib/calculationStorage"
import mapToCalculator from "../../../lib/parsedToCalculatorMapper"
import type ParsedBalanceSheet from "../../../lib/parsedBalanceSheet"

type Props = {
  parsed: ParsedBalanceSheet
  businessConstitution?: string
  userId?: string
}

// Grouped in the order a credit analyst reads them: can the business pay long-term
// debt, then short-term debt, then how profitable is it.
const SECTIONS: { title: string; calculators: CalculatorType[] }[] = [
  { title: "Leverage", calculators: ["debt-equity", "quasi-debt-equity"] },
  { title: "Liquidity", calculators: ["current-ratio", "net-working-capital", "drawing-power"] },
  { title: "Coverage", calculators: ["dscr", "iscr"] },
  { title: "Profitability", calculators: ["ebitda"] },
]

const CALC_LABEL: Record<string, string> = Object.fromEntries(CALCULATORS.map((c) => [c.id, c.name]))

function runCalculator(calculator: CalculatorType, inputs: Record<string, any>): CalculationResult {
  switch (calculator) {
    case "debt-equity":
      return calc.calculateDebtEquity(Number(inputs.totalDebt) || 0, Number(inputs.totalEquity) || 0)
    case "quasi-debt-equity":
      return calc.calculateQuasiDebtEquity(Number(inputs.totalDebt) || 0, Number(inputs.quasiDebt) || 0, Number(inputs.equity) || 0)
    case "current-ratio":
      return calc.calculateCurrentRatio(Number(inputs.currentAssets) || 0, Number(inputs.currentLiabilities) || 0)
    case "dscr":
      return calc.calculateDSCR(Number(inputs.netOperatingIncome) || 0, Number(inputs.totalDebtService) || 0)
    case "ebitda":
      return calc.calculateEBITDA(Number(inputs.profit) || 0, Number(inputs.depreciation) || 0, Number(inputs.financeCost) || 0, Number(inputs.sales) || 0)
    case "iscr":
      return calc.calculateISCR(Number(inputs.ebit) || 0, Number(inputs.interestExpense) || 0)
    case "net-working-capital":
      return calc.calculateNetWorkingCapital(Number(inputs.currentAssets) || 0, Number(inputs.currentLiabilities) || 0)
    case "drawing-power":
      return calc.calculateDrawingPower(Number(inputs.eligibleStock) || 0, Number(inputs.eligibleReceivables) || 0, Number(inputs.marginPercent) || 0)
    default:
      throw new Error("Not part of the report")
  }
}

type ReportRow = {
  calculator: CalculatorType
  result: CalculationResult | null
  confidence: number
  error: string | null
}

export function BalanceSheetReport({ parsed, businessConstitution, userId }: Props) {
  const [isSaving, setIsSaving] = useState(false)

  const rows = useMemo<ReportRow[]>(() => {
    return SECTIONS.flatMap((s) => s.calculators).map((calculator) => {
      const mapped = mapToCalculator(calculator, parsed, businessConstitution)
      try {
        return { calculator, result: runCalculator(calculator, mapped.inputs), confidence: mapped.confidence, error: null }
      } catch (err: any) {
        return { calculator, result: null, confidence: mapped.confidence, error: String(err?.message || err) }
      }
    })
  }, [parsed, businessConstitution])

  const rowsByCalculator = new Map(rows.map((r) => [r.calculator, r]))
  const avgConfidence = Math.round((rows.reduce((s, r) => s + r.confidence, 0) / rows.length) * 100)

  async function handleSaveAll() {
    if (!userId) return toast.error("Please sign in to save this report")
    setIsSaving(true)
    try {
      const savable = rows.filter((r) => r.result)
      await Promise.all(
        savable.map((r) =>
          saveCalculation(userId, r.calculator, mapToCalculator(r.calculator, parsed, businessConstitution).inputs, {
            value: r.result!.value,
            formatted: r.result!.formatted,
            interpretation: r.result!.interpretation,
            risk: r.result!.risk,
          })
        )
      )
      toast.success(`Saved ${savable.length} results to your account`)
    } catch (err: any) {
      toast.error(String(err?.message || err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bs-report bg-card rounded-xl border border-foreground/8 p-6 space-y-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-foreground/8">
        <div>
          <h3 className="text-sm font-medium text-foreground">Balance Sheet Report</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {parsed.sourceFilename ?? "Uploaded file"} · Overall extraction confidence {avgConfidence}%
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 no-print">
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="flex items-center gap-1.5 text-xs font-medium text-foreground bg-foreground/5 hover:bg-foreground/10 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
            Save all
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover px-3 py-2 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>
        </div>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className="space-y-3 bs-report-section">
          <h4 className="text-xs font-['Geist_Mono'] text-link uppercase tracking-widest">{section.title}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {section.calculators.map((c) => {
              const row = rowsByCalculator.get(c)
              return (
                <div key={c} className="p-4 rounded-lg bg-foreground/3 border border-foreground/5 space-y-2">
                  <p className="text-xs text-muted-foreground">{CALC_LABEL[c] ?? c}</p>
                  {row?.result ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-lg font-['Geist_Mono'] tabular-nums text-foreground">{row.result.formatted}</span>
                        <RiskBadge risk={row.result.risk} />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{row.result.interpretation}</p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Could not compute - {row?.error?.toLowerCase() ?? "missing data"}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <p className="text-xs text-muted-foreground no-print">
        Figures are auto-mapped from the uploaded file at ~{avgConfidence}% average confidence. Use the calculator below to review and correct individual inputs.
      </p>
    </div>
  )
}

export default BalanceSheetReport
