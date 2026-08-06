import { useState, useEffect } from "react"
import { useLocation } from "react-router"
import { CalculatorShell } from "../../components/calculators/CalculatorShell"
import { calculateDrawingPower, CalculationResult } from "../../../lib/financialCalculations"
import { ResultCard } from "../../components/calculators/ResultCard"
import { CurrencyInput } from "../../components/ui/CurrencyInput"

type SavedDrawingPowerCalculation = {
  calculatorType?: string
  inputs?: {
    eligibleStock?: number
    eligibleReceivables?: number
    marginPercent?: number
  }
  results?: CalculationResult & Record<string, unknown>
}

export default function DrawingPowerPage() {
  const location = useLocation()
  const savedCalculation = (location.state as { calculation?: SavedDrawingPowerCalculation } | null)?.calculation
  const [eligibleStock, setEligibleStock] = useState("")
  const [eligibleReceivables, setEligibleReceivables] = useState("")
  const [marginPercent, setMarginPercent] = useState("25")
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!savedCalculation || savedCalculation.calculatorType !== "drawing-power") {
      return
    }

    const inputs = savedCalculation.inputs
    if (inputs?.eligibleStock !== undefined) {
      setEligibleStock(String(inputs.eligibleStock))
    }
    if (inputs?.eligibleReceivables !== undefined) {
      setEligibleReceivables(String(inputs.eligibleReceivables))
    }
    if (inputs?.marginPercent !== undefined) {
      setMarginPercent(String(inputs.marginPercent))
    }

    if (savedCalculation.results) {
      setResult(savedCalculation.results as CalculationResult)
    }
  }, [savedCalculation])

  useEffect(() => {
    if (savedCalculation?.results && savedCalculation.calculatorType === "drawing-power") {
      return
    }

    const stock = parseFloat(eligibleStock)
    const receivables = parseFloat(eligibleReceivables)
    const margin = parseFloat(marginPercent)

    if (!isNaN(stock) && !isNaN(receivables) && !isNaN(margin) && stock >= 0 && receivables >= 0 && margin >= 0 && margin <= 100) {
      try {
        setResult(calculateDrawingPower(stock, receivables, margin))
        setError(null)
      } catch (e) {
        setError((e as Error).message)
        setResult(null)
      }
    } else {
      setResult(null)
      setError(null)
    }
  }, [eligibleStock, eligibleReceivables, marginPercent, savedCalculation])

  return (
    <CalculatorShell
      title="Drawing Power"
      description="Calculates the maximum working capital limit a business can draw against pledged collateral."
      explainerText="Drawing Power (DP) is the maximum amount a business can withdraw from its cash credit or overdraft account at any given time, calculated against the value of pledged stock and debtors after applying the bank's prescribed margin. Banks recalculate DP every month based on the latest stock and debtor statements submitted by the borrower. Staying within DP limits is a key compliance requirement — exceeding them triggers irregular account flags in credit monitoring reports."
      result={
        result ? (
          <ResultCard
            result={result}
            calculatorType="drawing-power"
            inputs={{ eligibleStock: parseFloat(eligibleStock), eligibleReceivables: parseFloat(eligibleReceivables), marginPercent: parseFloat(marginPercent) }}
          />
        ) : null
      }
    >
      <div className="space-y-4">
        <CurrencyInput
          label="Eligible Stock"
          value={eligibleStock}
          onChange={setEligibleStock}
          placeholder="Enter eligible stock value"
          helperText="Value of inventory eligible as collateral"
        />

        <CurrencyInput
          label="Eligible Receivables"
          value={eligibleReceivables}
          onChange={setEligibleReceivables}
          placeholder="Enter eligible receivables"
          helperText="Value of receivables eligible as collateral"
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#F1F5F9]">Margin Percentage</label>
          <div className="relative">
            <input
              type="number"
              value={marginPercent}
              onChange={(e) => setMarginPercent(e.target.value)}
              placeholder="25"
              min="0"
              max="100"
              step="0.1"
              className="w-full px-4 py-2.5 pr-10 bg-[#050A14] border border-white/10 rounded-lg text-[#F1F5F9] text-sm font-['Geist_Mono'] placeholder:text-[#94A3B8]/50 focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm font-['Geist_Mono']">%</span>
          </div>
          <p className="text-xs text-[#94A3B8]">Bank's margin requirement (typically 20–25%)</p>
          {error && <p className="text-xs text-[#ef4444]">{error}</p>}
        </div>
      </div>
    </CalculatorShell>
  )
}
