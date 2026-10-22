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
import { rateFinancials, keyFigures, type Grade } from "../../../lib/financialRating"
import { PeerComparison } from "./PeerComparison"

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

const GRADE_STYLE: Record<Grade, string> = {
  A: "bg-accent/12 text-accent border-accent/30",
  B: "bg-primary/10 text-primary border-primary/30",
  C: "bg-warning/12 text-warning border-warning/30",
  D: "bg-destructive/12 text-destructive border-destructive/30",
}
const RISK_WORD = { low: "Low risk", moderate: "Moderate risk", high: "High risk", "n/a": "n/a" } as const

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
      return calc.calculateDrawingPower(Number(inputs.eligibleStock) || 0, Number(inputs.eligibleReceivables) || 0, Number(inputs.creditors) || 0)
    default:
      throw new Error("Not part of the report")
  }
}

/** A statement in lakhs/crore gives amounts in that unit; the calculators format them as plain rupees. */
function withUnit(result: CalculationResult, unit?: string): CalculationResult {
  if (!unit) return result
  const tag = (t: string) => t.replace(/₹\s?(-?[\d,]+(?:\.\d+)?)/g, `₹$1 ${unit}`)
  return { ...result, formatted: tag(result.formatted), interpretation: tag(result.interpretation) }
}

type ReportRow = {
  calculator: CalculatorType
  result: CalculationResult | null
  confidence: number
  /** No automatic mapping for this calculator - left out of the overall extraction score. */
  unmapped: boolean
  error: string | null
}

export function BalanceSheetReport({ parsed, businessConstitution, userId }: Props) {
  const [isSaving, setIsSaving] = useState(false)

  const rows = useMemo<ReportRow[]>(() => {
    return SECTIONS.flatMap((s) => s.calculators).map((calculator) => {
      const mapped = mapToCalculator(calculator, parsed, businessConstitution)
      try {
        return { calculator, result: withUnit(runCalculator(calculator, mapped.inputs), parsed.metadata?.unit), confidence: mapped.confidence, unmapped: !!mapped.unmapped, error: null }
      } catch (err: any) {
        return { calculator, result: null, confidence: mapped.confidence, unmapped: !!mapped.unmapped, error: String(err?.message || err) }
      }
    })
  }, [parsed, businessConstitution])

  const rowsByCalculator = new Map(rows.map((r) => [r.calculator, r]))
  // Extraction confidence is about how well the file was read, so calculators with
  // no automatic mapping at all must not drag it down.
  const mappedRows = rows.filter((r) => !r.unmapped)
  const mappedAvg = mappedRows.length ? mappedRows.reduce((s, r) => s + r.confidence, 0) / mappedRows.length : 0
  // The per-calculator figures say how well each input matched; the file-level score says
  // how well the file was read at all (do the totals tie, were the lines classified...). The
  // headline can't be more confident than the file itself.
  const avgConfidence = Math.round(Math.min(mappedAvg, parsed.metadata?.confidence ?? 1) * 100)

  // Our view: one grade from the results above, with the reasons and the headline figures.
  const rating = useMemo(() => rateFinancials(rows, CALC_LABEL, parsed.metadata?.confidence), [rows, parsed])
  const figures = useMemo(() => keyFigures(parsed, businessConstitution), [parsed, businessConstitution])
  const unit = parsed.metadata?.unit
  // The business's own ratios, for the peer comparison (operating margin = EBITDA / sales).
  const ebitdaIn = mapToCalculator("ebitda", parsed, businessConstitution).inputs
  const sales = Number(ebitdaIn.sales) || 0
  const valueOf = (c: CalculatorType) => rowsByCalculator.get(c)?.result?.value ?? null
  const peerValues = {
    de: valueOf("debt-equity"),
    cr: valueOf("current-ratio"),
    icr: valueOf("iscr"),
    opm: sales > 0 ? ((Number(ebitdaIn.profit) + Number(ebitdaIn.depreciation) + Number(ebitdaIn.financeCost)) / sales) * 100 : null,
  }
  const amount = (n: number) => `${unit ? "" : "₹ "}${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })

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
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-foreground/8">
        <div className="min-w-0 flex-1 basis-56">
          <h3 className="text-sm font-medium text-foreground no-print">Balance Sheet Report</h3>
          <p className="text-xs text-muted-foreground mt-1 break-words">
            {parsed.sourceFilename ?? "Uploaded file"} · File read at {Math.round((parsed.metadata?.confidence ?? mappedAvg) * 100)}% confidence
          </p>
          {parsed.metadata?.notes && <p className="text-xs text-muted-foreground mt-1 break-words">{parsed.metadata.notes}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print">
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

      <div className="print-only">
        <img src="/logo-mark.png" alt="FinRatio" width={31} height={36} className="print-logo" />
        <div>
          <h2 className="text-lg font-semibold">Financial Assessment Report</h2>
          <p className="text-xs">FinRatio · Prepared {today}</p>
        </div>
      </div>

      <div className="bs-report-section flex flex-wrap items-stretch gap-4">
        <div className={`flex flex-col items-center justify-center rounded-xl border px-8 py-5 min-w-36 ${rating.grade ? GRADE_STYLE[rating.grade] : "bg-foreground/5 text-muted-foreground border-foreground/10"}`}>
          <span className="text-xs font-['Geist_Mono'] uppercase tracking-widest">Our rating</span>
          <span className="text-5xl font-semibold leading-none my-1">{rating.grade ?? "-"}</span>
          <span className="text-sm font-medium">{rating.label}</span>
          {rating.score !== null && <span className="text-xs font-['Geist_Mono'] mt-1">{rating.score} / 100</span>}
        </div>
        <div className="flex-1 basis-64 space-y-2 text-sm text-foreground">
          <p>
            {rating.grade
              ? `We rate these financials ${rating.grade} (${rating.label.toLowerCase()}), from ${rating.measures.length} measures of leverage, liquidity, coverage and profitability.`
              : "Too few measures could be calculated from this file to give a grade. Check the figures below and complete the missing inputs."}
          </p>
          {rating.cappedBecause && <p className="text-xs text-muted-foreground">The grade is held down because {rating.cappedBecause}, whatever the average says.</p>}
          {rating.provisional && (
            <p className="text-xs text-destructive">
              Provisional: the file was read with low confidence ({Math.round((parsed.metadata?.confidence ?? 0) * 100)}%). Verify every figure before relying on this grade.
            </p>
          )}
        </div>
      </div>

      {figures.length > 0 && (
        <div className="bs-report-section space-y-3">
          <h4 className="text-xs font-['Geist_Mono'] text-link uppercase tracking-widest">
            Key financials · {unit ? `₹ ${unit}, as stated in the file` : "₹"}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {figures.map((f) => (
              <div key={f.label} className="p-3 rounded-lg bg-foreground/3 border border-foreground/5">
                <p className="text-xs text-muted-foreground">{f.label}</p>
                <p className={`text-base font-['Geist_Mono'] tabular-nums ${f.value < 0 ? "text-destructive" : "text-foreground"}`}>{amount(f.value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

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

      <PeerComparison values={peerValues} />

      {rating.measures.length > 0 && (
        <div className="bs-report-section space-y-4">
          <h4 className="text-xs font-['Geist_Mono'] text-link uppercase tracking-widest">Our view</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-accent">What supports the rating</p>
              {rating.strengths.length ? (
                <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground leading-relaxed">{rating.strengths.map((t) => <li key={t}>{t}</li>)}</ul>
              ) : <p className="text-xs text-muted-foreground italic">No measure came out low risk.</p>}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-destructive">What holds it back</p>
              {rating.concerns.length ? (
                <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground leading-relaxed">{rating.concerns.map((t) => <li key={t}>{t}</li>)}</ul>
              ) : <p className="text-xs text-muted-foreground italic">No measure raised a concern.</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">How the rating is built</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-foreground/10">
                  <th className="py-1.5 font-normal">Measure</th><th className="font-normal">Result</th><th className="font-normal">Weight</th><th className="font-normal text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {rating.measures.map((m) => (
                  <tr key={m.calculator} className="border-b border-foreground/5">
                    <td className="py-1.5">{CALC_LABEL[m.calculator] ?? m.calculator}</td>
                    <td>{RISK_WORD[m.risk]}</td>
                    <td className="font-['Geist_Mono']">×{m.weight}</td>
                    <td className="font-['Geist_Mono'] text-right">{m.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Low risk scores 100, moderate 55, high 15; the grade is the weighted average (A 75+, B 55+, C 35+, otherwise D). Coverage and liquidity weigh most because they decide whether debt can be serviced.
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        This is an automated assessment of the figures in the uploaded file, not a credit rating or a lending decision. Figures are read from the document and
        should be verified against the signed statements. Debt service uses interest only unless principal repayments are provided.
      </p>

      <p className="text-xs text-muted-foreground no-print">
        Figures are auto-mapped from the uploaded file at ~{avgConfidence}% average confidence. Use the calculator below to review and correct individual inputs.
      </p>
    </div>
  )
}

export default BalanceSheetReport
