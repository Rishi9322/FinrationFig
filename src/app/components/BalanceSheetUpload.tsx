import React, { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Upload, FileCheck2, AlertCircle, Loader2, RefreshCw, ChevronDown } from "lucide-react"
import parseFile from "../../lib/parsers"
import mapToCalculator from "../../lib/parsedToCalculatorMapper"
import { getCurrentUser } from "../../lib/auth"
import { CalculatorType } from "../../lib/financialCalculations"
import * as calc from "../../lib/financialCalculations"
import { CALCULATORS } from "../../lib/calculatorConfig"
import { saveCalculation } from "../../lib/calculationStorage"
import { uploadBalanceSheetFile, MAX_UPLOAD_BYTES } from "../../lib/uploadStorage"
import { ResultCard } from "./calculators/ResultCard"
import { BalanceSheetReport } from "./calculators/BalanceSheetReport"
import { RiskBadge } from "./ui/RiskBadge"
import "../../styles/balanceSheetReport.css"

type Props = {
  userId?: string
}

// Calculators this pipeline knows how to auto-map from a parsed balance sheet.
// (Ageing/PID return a different result shape than the rest - handled separately below.)
const SUPPORTED: CalculatorType[] = [
  "debt-equity",
  "quasi-debt-equity",
  "current-ratio",
  "dscr",
  "ebitda",
  "iscr",
  "ageing",
  "net-working-capital",
  "drawing-power",
  "pid",
]
const CALC_LABEL: Record<string, string> = Object.fromEntries(CALCULATORS.map((c) => [c.id, c.name]))
const IRREGULAR = new Set<CalculatorType>(["ageing", "pid"])

function runCalculator(calculator: CalculatorType, inputs: Record<string, any>): any {
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
    case "ageing":
      return calc.calculateAgeing(inputs.receivables || [])
    case "pid":
      return calc.calculatePID(inputs as any)
    default:
      return null
  }
}

export default function BalanceSheetUpload({ userId }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<"idle" | "parsing" | "parsed" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [parsed, setParsed] = useState<any | null>(null)
  const [selectedCalculator, setSelectedCalculator] = useState<CalculatorType>("debt-equity")
  const [mapped, setMapped] = useState<any | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Re-map from the parsed statement whenever the file or calculator choice changes.
  useEffect(() => {
    if (!parsed) {
      setMapped(null)
      return
    }
    setMapped(mapToCalculator(selectedCalculator, parsed, getCurrentUser()?.businessConstitution))
  }, [parsed, selectedCalculator])

  // Calculators throw on invalid inputs (e.g. zero equity) - a bad guess from the
  // auto-mapper must not crash the page, just show a message so the user can fix the input.
  let result: any = null
  let calcError: string | null = null
  if (mapped) {
    try {
      result = runCalculator(selectedCalculator, mapped.inputs)
    } catch (err: any) {
      calcError = String(err?.message || err)
    }
  }

  async function handleFile(f: File | null) {
    if (!f) return
    if (f.size > MAX_UPLOAD_BYTES) {
      setStatus("error")
      setErrorMsg(`File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit`)
      return
    }
    setFile(f)
    setStatus("parsing")
    setErrorMsg(null)
    try {
      const p = await parseFile(f)
      setParsed(p)
      setStatus("parsed")
      if (userId) {
        uploadBalanceSheetFile(f)
          .then(() => toast.success("Saved to your uploads"))
          .catch((err) => toast.error("Upload failed: " + String(err?.message || err)))
      }
    } catch (err: any) {
      setStatus("error")
      setErrorMsg(String(err?.message || err))
      setParsed(null)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files?.[0] ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateMappedInput(key: string, value: string) {
    setMapped((prev: any) => ({ ...prev, inputs: { ...prev.inputs, [key]: value === "" ? "" : Number(value) } }))
  }

  async function handleSaveIrregular() {
    if (!userId) return toast.error("Please sign in to save calculations")
    if (!mapped || !result) return
    try {
      const saved = await saveCalculation(userId, selectedCalculator, mapped.inputs, result)
      toast.success("Saved calculation: " + saved.id)
    } catch (err: any) {
      toast.error(String(err?.message || err))
    }
  }

  const confidencePct = mapped ? Math.round((mapped.confidence ?? 0) * 100) : null
  const confidenceColor = confidencePct === null ? "" : confidencePct >= 70 ? "#10B981" : confidencePct >= 40 ? "#f59e0b" : "#ef4444"

  return (
    <div className="bg-card rounded-xl border border-foreground/8 p-6 space-y-5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-foreground/8">
        <div className="w-1.5 h-5 rounded-full bg-primary" />
        <h3 className="text-sm font-medium text-foreground">Upload Balance Sheet</h3>
      </div>

      {/* Dropzone */}
      <label
        htmlFor="bs-file"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="flex flex-col items-center justify-center gap-2 text-center px-6 py-10 rounded-xl border border-dashed border-foreground/15 hover:border-primary/50 bg-foreground/3 cursor-pointer transition-colors"
      >
        <input
          ref={inputRef}
          id="bs-file"
          type="file"
          aria-label="Upload balance sheet file"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {status === "parsing" ? (
          <>
            <Loader2 className="w-6 h-6 text-link animate-spin" />
            <p className="text-sm text-foreground">Parsing {file?.name}…</p>
          </>
        ) : status === "error" ? (
          <>
            <AlertCircle className="w-6 h-6 text-destructive" />
            <p className="text-sm text-destructive">{errorMsg}</p>
            <p className="text-xs text-muted-foreground">Click to try another file</p>
          </>
        ) : status === "parsed" ? (
          <>
            <FileCheck2 className="w-6 h-6 text-accent" />
            <p className="text-sm text-foreground font-medium">{file?.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> click or drop to replace
            </p>
          </>
        ) : (
          <>
            <Upload className="w-6 h-6 text-link" />
            <p className="text-sm text-foreground">Drop your balance sheet here, or click to browse</p>
            <p className="text-xs text-muted-foreground">CSV, JSON, Excel, PDF, DOCX or an image</p>
          </>
        )}
      </label>

      {parsed && (
        <BalanceSheetReport parsed={parsed} businessConstitution={getCurrentUser()?.businessConstitution} userId={userId} />
      )}

      {/* Calculator picker - fine-tune one ratio at a time below the report */}
      <div className="space-y-1.5">
        <label htmlFor="calc-select" className="text-xs font-['Geist_Mono'] text-muted-foreground uppercase tracking-wider">
          Fine-tune a single calculator
        </label>
        <div className="relative">
          <select
            id="calc-select"
            aria-label="Select calculator"
            value={selectedCalculator}
            onChange={(e) => setSelectedCalculator(e.target.value as CalculatorType)}
            className="w-full appearance-none bg-background border border-foreground/10 rounded-lg pl-3 pr-9 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
          >
            {SUPPORTED.map((c) => (
              <option key={c} value={c}>
                {CALC_LABEL[c] ?? c}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Mapped inputs - editable, with the parser's own confidence read-out */}
      {mapped && (
        <div className="space-y-3 p-4 rounded-lg bg-foreground/3 border border-foreground/5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-['Geist_Mono'] text-muted-foreground uppercase tracking-wider">
              Mapped inputs - override anything the parser guessed wrong
            </p>
            {confidencePct !== null && (
              <span className="text-xs font-['Geist_Mono']" style={{ color: confidenceColor }}>
                {confidencePct}% confidence
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(mapped.inputs || {}).map(([key, value]) =>
              typeof value === "number" ? (
                <div key={key} className="space-y-1">
                  <label htmlFor={`mapped-${key}`} className="text-xs text-muted-foreground">
                    {key}
                  </label>
                  <input
                    id={`mapped-${key}`}
                    type="number"
                    value={value}
                    onChange={(e) => updateMappedInput(key, e.target.value)}
                    className="w-full bg-background border border-foreground/10 rounded-lg px-3 py-2 text-foreground text-sm font-['Geist_Mono'] focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                  />
                </div>
              ) : null
            )}
          </div>
          {mapped.notes && <p className="text-xs text-muted-foreground leading-relaxed">{mapped.notes}</p>}
        </div>
      )}

      {calcError && (
        <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Can't calculate yet - {calcError.toLowerCase()}. Adjust the inputs above.</span>
        </div>
      )}

      {/* Result */}
      {result && !IRREGULAR.has(selectedCalculator) && (
        <ResultCard result={result} calculatorType={selectedCalculator} inputs={mapped.inputs} />
      )}
      {result && selectedCalculator === "ageing" && (
        <div className="bg-foreground/3 border border-foreground/5 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground font-medium">{calc.formatCurrency(result.total)}</p>
            <RiskBadge risk={result.risk} />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{result.interpretation}</p>
          <button
            onClick={handleSaveIrregular}
            disabled={!userId}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover disabled:opacity-40 text-white transition-colors"
          >
            Save Result
          </button>
        </div>
      )}
      {result && selectedCalculator === "pid" && (
        <div className="bg-foreground/3 border border-foreground/5 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground font-medium">Net PID benefit: {calc.formatCurrency(result.netPidBenefit)}</p>
            <RiskBadge risk={result.risk} />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{result.interpretation}</p>
          <button
            onClick={handleSaveIrregular}
            disabled={!userId}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover disabled:opacity-40 text-white transition-colors"
          >
            Save Result
          </button>
        </div>
      )}

      {!userId && parsed && (
        <p className="text-xs text-muted-foreground">Sign in to save this upload and its results to your account.</p>
      )}

      {/* Debug - raw parser/mapper output, collapsed by default */}
      {parsed && (
        <details className="text-xs" open={showDebug} onToggle={(e) => setShowDebug((e.target as HTMLDetailsElement).open)}>
          <summary className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            Debug - raw parsed &amp; mapped data
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto bg-background text-muted-foreground p-3 rounded-lg border border-foreground/8">
            {JSON.stringify({ parsed, mapped }, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}
