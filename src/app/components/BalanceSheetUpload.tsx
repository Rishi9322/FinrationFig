import React, { useState } from "react"
import parseFile from "../../lib/parsers"
import mapToCalculator from "../../lib/parsedToCalculatorMapper"
import { CalculatorType } from "../../lib/financialCalculations"
import * as calc from "../../lib/financialCalculations"
import { saveCalculation } from "../../lib/calculationStorage"
import { uploadBalanceSheetFile } from "../../lib/uploadStorage"

type Props = {
  userId?: string
}

export default function BalanceSheetUpload({ userId }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<any | null>(null)
  const [selectedCalculator, setSelectedCalculator] = useState<CalculatorType>("debt-equity")
  const [mapped, setMapped] = useState<any | null>(null)
  const [result, setResult] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleParse() {
    if (!file) return setMessage("Choose a file first")
    if (!userId) return setMessage("Sign in required to store uploads")
    setLoading(true)
    try {
      await uploadBalanceSheetFile(file)
      const p = await parseFile(file)
      setParsed(p)
      setMessage("Uploaded and parsed successfully; review and map to calculator")
    } catch (err: any) {
      setMessage(String(err?.message || err))
    } finally {
      setLoading(false)
    }
  }

  function handleMap() {
    if (!parsed) return setMessage("Parse a file first")
    const m = mapToCalculator(selectedCalculator, parsed)
    setMapped(m)
    setMessage("Mapped — review inputs before running calculation")
  }

  function runCalc() {
    if (!mapped) return setMessage("Map inputs first")
    try {
      const inputs = mapped.inputs || {}
      let res: any = null
      switch (selectedCalculator) {
        case "debt-equity":
          res = calc.calculateDebtEquity(Number(inputs.totalDebt) || 0, Number(inputs.totalEquity) || 0)
          break
        case "quasi-debt-equity":
          res = calc.calculateQuasiDebtEquity(Number(inputs.totalDebt) || 0, Number(inputs.quasiDebt) || 0, Number(inputs.equity) || 0)
          break
        case "current-ratio":
          res = calc.calculateCurrentRatio(Number(inputs.currentAssets) || 0, Number(inputs.currentLiabilities) || 0)
          break
        case "dscr":
          res = calc.calculateDSCR(Number(inputs.netOperatingIncome) || 0, Number(inputs.totalDebtService) || 0)
          break
        case "ebitda":
          res = calc.calculateEBITDA(Number(inputs.revenue) || 0, Number(inputs.operatingExpenses) || 0)
          break
        case "iscr":
          res = calc.calculateISCR(Number(inputs.ebit) || 0, Number(inputs.interestExpense) || 0)
          break
        case "net-working-capital":
          res = calc.calculateNetWorkingCapital(Number(inputs.currentAssets) || 0, Number(inputs.currentLiabilities) || 0)
          break
        case "drawing-power":
          res = calc.calculateDrawingPower(Number(inputs.eligibleStock) || 0, Number(inputs.eligibleReceivables) || 0, Number(inputs.marginPercent) || 0)
          break
        case "ageing":
          res = calc.calculateAgeing(inputs.receivables || [])
          break
        case "pid":
          res = calc.calculatePID(inputs as any)
          break
        default:
          res = { message: "Calculator not supported in UI" }
      }

      setResult(res)
      setMessage("Calculation complete — preview results")
    } catch (err: any) {
      setMessage(String(err?.message || err))
    }
  }

  async function handleSave() {
    if (!userId) return setMessage("No userId provided; cannot save")
    if (!mapped || !result) return setMessage("Map and run calculation before saving")
    setLoading(true)
    try {
      const saved = await saveCalculation(userId, selectedCalculator, mapped.inputs, result)
      setMessage("Saved calculation: " + saved.id)
    } catch (err: any) {
      setMessage(String(err?.message || err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
      <h3>Upload Balance Sheet</h3>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <div style={{ marginTop: 8 }}>
        <label>Calculator: </label>
        <select
          value={selectedCalculator}
          onChange={(e) => setSelectedCalculator(e.target.value as CalculatorType)}
          style={{ color: "#0f172a", backgroundColor: "#ffffff", border: "1px solid #cbd5f5" }}
        >
          {(
            [
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
            ] as CalculatorType[]
          ).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 8 }}>
        <button onClick={handleParse} disabled={loading || !file} style={{ marginRight: 8 }}>
          Parse
        </button>
        <button onClick={handleMap} disabled={!parsed} style={{ marginRight: 8 }}>
          Map
        </button>
        <button onClick={runCalc} disabled={!mapped} style={{ marginRight: 8 }}>
          Run Calculation
        </button>
        <button onClick={handleSave} disabled={!result || !userId}>
          Save
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        {message && <div style={{ color: "#333" }}>{message}</div>}
        {parsed && (
          <details>
            <summary>Parsed Preview</summary>
            <pre style={{ maxHeight: 200, overflow: "auto" }}>{JSON.stringify(parsed, null, 2)}</pre>
          </details>
        )}
        {mapped && (
          <details>
            <summary>Mapped Inputs</summary>
            <pre style={{ maxHeight: 200, overflow: "auto" }}>{JSON.stringify(mapped, null, 2)}</pre>
          </details>
        )}
        {result && (
          <details open>
            <summary>Result</summary>
            <pre style={{ maxHeight: 300, overflow: "auto" }}>{JSON.stringify(result, null, 2)}</pre>
          </details>
        )}
      </div>
    </div>
  )
}
