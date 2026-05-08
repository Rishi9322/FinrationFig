import { useState, useEffect } from "react"
import { CalculatorShell } from "../../components/calculators/CalculatorShell"
import { calculateEBITDA, CalculationResult } from "../../../lib/financialCalculations"
import { ResultCard } from "../../components/calculators/ResultCard"
import { CurrencyInput } from "../../components/ui/CurrencyInput"

export default function EbitdaPage() {
  const [revenue, setRevenue] = useState("")
  const [operatingExpenses, setOperatingExpenses] = useState("")
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const rev = parseFloat(revenue)
    const expenses = parseFloat(operatingExpenses)

    if (!isNaN(rev) && !isNaN(expenses) && rev >= 0 && expenses >= 0) {
      try {
        setResult(calculateEBITDA(rev, expenses))
        setError(null)
      } catch (e) {
        setError((e as Error).message)
        setResult(null)
      }
    } else {
      setResult(null)
      setError(null)
    }
  }, [revenue, operatingExpenses])

  return (
    <CalculatorShell
      title="EBITDA"
      description="Calculates earnings before interest, tax, depreciation, and amortisation as a proxy for operating cash flow."
      explainerText="EBITDA strips away the effects of financing decisions, accounting conventions, and tax environments to reveal pure operating profitability. It is the starting point for cash accrual calculations used in DSCR and ISCR computations. In credit appraisals, EBITDA margin is used to compare a company against industry peers and to assess whether the business generates adequate operational surplus to sustain debt obligations over the long term."
      result={
        result ? (
          <ResultCard
            result={result}
            calculatorType="ebitda"
            inputs={{ revenue: parseFloat(revenue), operatingExpenses: parseFloat(operatingExpenses) }}
          />
        ) : null
      }
    >
      <div className="space-y-4">
        <CurrencyInput
          label="Revenue"
          value={revenue}
          onChange={setRevenue}
          placeholder="Enter total revenue"
          helperText="Total sales or income for the period"
        />

        <CurrencyInput
          label="Operating Expenses"
          value={operatingExpenses}
          onChange={setOperatingExpenses}
          placeholder="Enter operating expenses"
          helperText="Costs before interest, tax, depreciation, and amortisation"
          error={error || undefined}
        />
      </div>
    </CalculatorShell>
  )
}
