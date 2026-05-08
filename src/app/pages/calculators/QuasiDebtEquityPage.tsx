import { useState, useEffect } from "react"
import { CalculatorShell } from "../../components/calculators/CalculatorShell"
import { calculateQuasiDebtEquity, CalculationResult } from "../../../lib/financialCalculations"
import { ResultCard } from "../../components/calculators/ResultCard"
import { CurrencyInput } from "../../components/ui/CurrencyInput"

export default function QuasiDebtEquityPage() {
  const [totalDebt, setTotalDebt] = useState("")
  const [quasiDebt, setQuasiDebt] = useState("")
  const [equity, setEquity] = useState("")
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const debt = parseFloat(totalDebt)
    const quasi = parseFloat(quasiDebt)
    const eq = parseFloat(equity)

    if (!isNaN(debt) && !isNaN(quasi) && !isNaN(eq) && debt >= 0 && quasi >= 0 && eq > 0) {
      try {
        setResult(calculateQuasiDebtEquity(debt, quasi, eq))
        setError(null)
      } catch (e) {
        setError((e as Error).message)
        setResult(null)
      }
    } else {
      setResult(null)
      setError(null)
    }
  }, [totalDebt, quasiDebt, equity])

  return (
    <CalculatorShell
      title="Quasi Debt-to-Equity Ratio"
      description="Includes hybrid instruments like preference shares alongside standard debt in the leverage calculation."
      explainerText="The Quasi D/E Ratio extends the standard D/E calculation by treating hybrid instruments — such as preference shares, compulsorily convertible debentures (CCDs), and subordinated loans — as quasi-debt. Banks and financial institutions use this adjusted ratio during credit appraisal to get a truer picture of a borrower's leverage when hybrid financing is present. It prevents understatement of debt risk in businesses that use structured finance."
      result={
        result ? (
          <ResultCard
            result={result}
            calculatorType="quasi-debt-equity"
            inputs={{ totalDebt: parseFloat(totalDebt), quasiDebt: parseFloat(quasiDebt), equity: parseFloat(equity) }}
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
          label="Quasi Debt"
          value={quasiDebt}
          onChange={setQuasiDebt}
          placeholder="Enter quasi debt"
          helperText="Hybrid instruments like preference shares"
        />

        <CurrencyInput
          label="Equity"
          value={equity}
          onChange={setEquity}
          placeholder="Enter equity"
          helperText="Shareholders' equity or net worth"
          error={error || undefined}
        />
      </div>
    </CalculatorShell>
  )
}
