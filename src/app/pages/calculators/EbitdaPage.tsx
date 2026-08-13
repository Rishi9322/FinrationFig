import { useState, useEffect } from "react"
import { CalculatorShell } from "../../components/calculators/CalculatorShell"
import { calculateEBITDA, CalculationResult } from "../../../lib/financialCalculations"
import { ResultCard } from "../../components/calculators/ResultCard"
import { CurrencyInput } from "../../components/ui/CurrencyInput"

export default function EbitdaPage() {
  const [profit, setProfit] = useState("")
  const [depreciation, setDepreciation] = useState("")
  const [financeCost, setFinanceCost] = useState("")
  const [sales, setSales] = useState("")
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const values = [profit, depreciation, financeCost, sales].map(parseFloat)

    if (values.every((v) => !isNaN(v))) {
      try {
        setResult(calculateEBITDA(values[0], values[1], values[2], values[3]))
        setError(null)
      } catch (e) {
        setError((e as Error).message)
        setResult(null)
      }
    } else {
      setResult(null)
      setError(null)
    }
  }, [profit, depreciation, financeCost, sales])

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
            inputs={{
              profit: parseFloat(profit),
              depreciation: parseFloat(depreciation),
              financeCost: parseFloat(financeCost),
              sales: parseFloat(sales),
            }}
          />
        ) : null
      }
    >
      <div className="space-y-4">
        <CurrencyInput
          label="Profit"
          value={profit}
          onChange={setProfit}
          placeholder="Enter profit for the period"
          helperText="Net profit before adding back depreciation and finance cost"
        />

        <CurrencyInput
          label="Depreciation"
          value={depreciation}
          onChange={setDepreciation}
          placeholder="Enter depreciation"
          helperText="Depreciation and amortisation charged for the period"
        />

        <CurrencyInput
          label="Finance / Interest Cost"
          value={financeCost}
          onChange={setFinanceCost}
          placeholder="Enter finance cost"
          helperText="Interest and other finance charges for the period"
        />

        <CurrencyInput
          label="Sales"
          value={sales}
          onChange={setSales}
          placeholder="Enter total sales"
          helperText="Used to express EBITDA as a percentage of sales"
          error={error || undefined}
        />
      </div>
    </CalculatorShell>
  )
}
