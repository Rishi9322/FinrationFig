import { useState, useEffect } from "react"
import { CalculatorShell } from "../../components/calculators/CalculatorShell"
import { calculateDSCR, CalculationResult } from "../../../lib/financialCalculations"
import { ResultCard } from "../../components/calculators/ResultCard"
import { CurrencyInput } from "../../components/ui/CurrencyInput"

export default function DscrPage() {
  const [netOperatingIncome, setNetOperatingIncome] = useState("")
  const [totalDebtService, setTotalDebtService] = useState("")
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const income = parseFloat(netOperatingIncome)
    const debtService = parseFloat(totalDebtService)

    if (!isNaN(income) && !isNaN(debtService) && debtService !== 0) {
      try {
        setResult(calculateDSCR(income, debtService))
        setError(null)
      } catch (e) {
        setError((e as Error).message)
        setResult(null)
      }
    } else {
      setResult(null)
      setError(null)
    }
  }, [netOperatingIncome, totalDebtService])

  return (
    <CalculatorShell
      title="Debt Service Coverage Ratio"
      description="Determines whether operating income is sufficient to service all debt obligations."
      explainerText="The Debt Service Coverage Ratio (DSCR) is the single most important ratio for term loan assessment. It answers the question: does the business generate enough cash to repay both the principal and interest on its borrowings? A DSCR above 1.25 is the minimum acceptable threshold for most Indian banks. Ratios below 1.0 indicate the business cannot service its debt from operations alone — a red flag for lenders and credit risk teams."
      result={
        result ? (
          <ResultCard
            result={result}
            calculatorType="dscr"
            inputs={{ netOperatingIncome: parseFloat(netOperatingIncome), totalDebtService: parseFloat(totalDebtService) }}
          />
        ) : null
      }
    >
      <div className="space-y-4">
        <CurrencyInput
          label="Net Operating Income"
          value={netOperatingIncome}
          onChange={setNetOperatingIncome}
          placeholder="Enter net operating income"
          helperText="Income available to service debt (EBITDA or similar)"
        />

        <CurrencyInput
          label="Total Debt Service"
          value={totalDebtService}
          onChange={setTotalDebtService}
          placeholder="Enter total debt service"
          helperText="Principal + interest payments for the period"
          error={error || undefined}
        />
      </div>
    </CalculatorShell>
  )
}
