import { useState, useEffect } from "react"
import { CalculatorShell } from "../../components/calculators/CalculatorShell"
import { calculateDebtEquity, CalculationResult } from "../../../lib/financialCalculations"
import { ResultCard } from "../../components/calculators/ResultCard"
import { CurrencyInput } from "../../components/ui/CurrencyInput"

export default function DebtEquityPage() {
  const [totalDebt, setTotalDebt] = useState("")
  const [totalEquity, setTotalEquity] = useState("")
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const debt = parseFloat(totalDebt)
    const equity = parseFloat(totalEquity)

    if (!isNaN(debt) && !isNaN(equity) && debt >= 0 && equity > 0) {
      try {
        setResult(calculateDebtEquity(debt, equity))
        setError(null)
      } catch (e) {
        setError((e as Error).message)
        setResult(null)
      }
    } else {
      setResult(null)
      setError(null)
    }
  }, [totalDebt, totalEquity])

  return (
    <CalculatorShell
      title="Debt-to-Equity Ratio"
      description="Measures financial leverage by comparing total debt to shareholders' equity."
      explainerText="The Debt-to-Equity (D/E) Ratio reveals how much of your business is funded by borrowed money versus owner capital. A higher ratio signals greater financial risk — lenders and credit analysts use it as a primary indicator of a company's leverage and repayment capacity. For Indian SMEs seeking bank credit, a D/E below 2:1 is generally considered healthy, while ratios above 3:1 may attract higher scrutiny from credit committees."
      result={
        result ? (
          <ResultCard
            result={result}
            calculatorType="debt-equity"
            inputs={{ totalDebt: parseFloat(totalDebt), totalEquity: parseFloat(totalEquity) }}
          />
        ) : null
      }
    >
      <div className="space-y-4">
        <CurrencyInput
          label="Total Debt"
          value={totalDebt}
          onChange={setTotalDebt}
          placeholder="Enter total debt"
          helperText="All borrowed funds and liabilities"
        />

        <CurrencyInput
          label="Total Equity"
          value={totalEquity}
          onChange={setTotalEquity}
          placeholder="Enter total equity"
          helperText="Shareholders' equity or net worth"
          error={error || undefined}
        />
      </div>
    </CalculatorShell>
  )
}
