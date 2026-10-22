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
    creditors?: number
  }
  results?: CalculationResult & Record<string, unknown>
}

export default function DrawingPowerPage() {
  const location = useLocation()
  const savedCalculation = (location.state as { calculation?: SavedDrawingPowerCalculation } | null)?.calculation
  const [eligibleStock, setEligibleStock] = useState("")
  const [eligibleReceivables, setEligibleReceivables] = useState("")
  const [creditors, setCreditors] = useState("")
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
    if (inputs?.creditors !== undefined) {
      setCreditors(String(inputs.creditors))
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
    const creditorsValue = parseFloat(creditors)

    if (!isNaN(stock) && !isNaN(receivables) && !isNaN(creditorsValue)) {
      try {
        setResult(calculateDrawingPower(stock, receivables, creditorsValue))
        setError(null)
      } catch (e) {
        setError((e as Error).message)
        setResult(null)
      }
    } else {
      setResult(null)
      setError(null)
    }
  }, [eligibleStock, eligibleReceivables, creditors, savedCalculation])

  return (
    <CalculatorShell
      title="Drawing Power"
      description="Calculates the maximum working capital limit a business can draw against pledged collateral."
      explainerText="Drawing Power (DP) is the maximum amount a business can withdraw from its cash credit or overdraft account at any given time, calculated against the value of pledged stock and debtors after deducting creditors and applying 75%. Banks recalculate DP every month based on the latest stock and debtor statements submitted by the borrower. Staying within DP limits is a key compliance requirement - exceeding them triggers irregular account flags in credit monitoring reports."
      result={
        result ? (
          <ResultCard
            result={result}
            calculatorType="drawing-power"
            inputs={{ eligibleStock: parseFloat(eligibleStock), eligibleReceivables: parseFloat(eligibleReceivables), creditors: parseFloat(creditors) }}
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

        <CurrencyInput
          label="Creditors"
          value={creditors}
          onChange={setCreditors}
          placeholder="Enter creditors"
          helperText="Trade creditors, deducted before applying 75%"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">Drawing Power = (Stock + Debtors − Creditors) × 75%</p>
      </div>
    </CalculatorShell>
  )
}
