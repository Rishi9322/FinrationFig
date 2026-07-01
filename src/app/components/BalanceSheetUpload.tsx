import React, { useState } from "react"
import parseFile from "../../lib/parsers"
import mapToCalculator from "../../lib/parsedToCalculatorMapper"
import { CalculatorType } from "../../lib/financialCalculations"
import * as calc from "../../lib/financialCalculations"
import { saveCalculation } from "../../lib/calculationStorage"
import { uploadBalanceSheetFile } from "../../lib/uploadStorage"
import "../../styles/balance-sheet-upload.css"

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
    setLoading(true)
    try {
      // Parse locally first so users can preview even when not signed in
      const p = await parseFile(file)
      setParsed(p)

      if (userId) {
        try {
          await uploadBalanceSheetFile(file)
          setMessage("Parsed and uploaded successfully; review and map to calculator")
        } catch (uploadErr: any) {
          setMessage("Parsed successfully; upload failed: " + String(uploadErr?.message || uploadErr))
        }
      } else {
        setMessage("Parsed successfully; sign in to save uploads")
      }
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
    <div className="bs-upload">
      <h3>Upload Balance Sheet</h3>
      <div className="form-row">
        <label htmlFor="bs-file">File</label>
        <input id="bs-file" type="file" aria-label="Upload balance sheet file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <div className="form-row">
        <label htmlFor="calc-select">Calculator</label>
        <select
          id="calc-select"
          aria-label="Select calculator"
          value={selectedCalculator}
          onChange={(e) => setSelectedCalculator(e.target.value as CalculatorType)}
          className="calc-select"
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

      <div className="actions">
        <button onClick={handleParse} disabled={loading || !file} className="btn">
          Parse
        </button>
        <button onClick={handleMap} disabled={!parsed} className="btn">
          Map
        </button>
        <button onClick={runCalc} disabled={!mapped} className="btn">
          Run Calculation
        </button>
        <button onClick={handleSave} disabled={!result || !userId} className="btn primary">
          Save
        </button>
      </div>

      <div className="preview">
        {message && <div className="message">{message}</div>}
        {parsed && (
          <details>
            <summary>Parsed Preview</summary>
            <pre className="pre-box">{JSON.stringify(parsed, null, 2)}</pre>
          </details>
        )}
        {mapped && (
          <details>
            <summary>Mapped Inputs</summary>
            <pre className="pre-box">{JSON.stringify(mapped, null, 2)}</pre>
          </details>
        )}
        {result && (
          <details open>
            <summary>Result</summary>
            <pre className="pre-box">{JSON.stringify(result, null, 2)}</pre>
          </details>
        )}
      </div>
    </div>
  )
}
