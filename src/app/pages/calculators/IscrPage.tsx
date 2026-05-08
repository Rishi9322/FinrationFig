import { useState, useEffect } from "react"
import { CalculatorShell } from "../../components/calculators/CalculatorShell"
import { calculateISCR, CalculationResult } from "../../../lib/financialCalculations"
import { ResultCard } from "../../components/calculators/ResultCard"
import { CurrencyInput } from "../../components/ui/CurrencyInput"

export default function IscrPage() {
  const [ebit, setEbit] = useState("")
  const [interestExpense, setInterestExpense] = useState("")
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ebitValue = parseFloat(ebit)
    const interest = parseFloat(interestExpense)

    if (!isNaN(ebitValue) && !isNaN(interest) && interest !== 0) {
      try {
        setResult(calculateISCR(ebitValue, interest))
        setError(null)
      } catch (e) {
        setError((e as Error).message)
        setResult(null)
      }
    } else {
      setResult(null)
      setError(null)
    }
  }, [ebit, interestExpense])

  return (
    <CalculatorShell
      title="Interest Service Coverage Ratio"
      description="Assesses the ability to meet interest payments from operating earnings."
      explainerText="The Interest Service Coverage Ratio (ISCR) measures how many times a business can cover its interest payments from its operating earnings (EBIT). Unlike DSCR, it focuses only on interest — not principal repayment — making it a useful early-warning indicator. A ratio above 1.5 is generally considered acceptable, while anything below 1.0 signals that the business cannot even meet its interest obligations, pointing to potential default risk."
      result={
        result ? (
          <ResultCard
            result={result}
            calculatorType="iscr"
            inputs={{ ebit: parseFloat(ebit), interestExpense: parseFloat(interestExpense) }}
          />
        ) : null
      }
    >
      <div className="space-y-4">
        <CurrencyInput
          label="EBIT"
          value={ebit}
          onChange={setEbit}
          placeholder="Enter EBIT"
          helperText="Earnings before interest and tax"
        />

        <CurrencyInput
          label="Interest Expense"
          value={interestExpense}
          onChange={setInterestExpense}
          placeholder="Enter interest expense"
          helperText="Total interest payments for the period"
          error={error || undefined}
        />
      </div>
    </CalculatorShell>
  )
}
