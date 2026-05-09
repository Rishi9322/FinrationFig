import { useEffect, useState } from "react"
import { CalculatorShell } from "../../components/calculators/CalculatorShell"
import { ResultCard } from "../../components/calculators/ResultCard"
import { CurrencyInput } from "../../components/ui/CurrencyInput"
import { CalculationResult, calculateWorkingCapitalCycles } from "../../../lib/financialCalculations"

export default function WorkingCapitalCyclePage() {
  const [creditors, setCreditors] = useState("")
  const [debtors, setDebtors] = useState("")
  const [stock, setStock] = useState("")
  const [sales, setSales] = useState("")
  const [purchases, setPurchases] = useState("")
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const parsedCreditors = parseFloat(creditors)
    const parsedDebtors = parseFloat(debtors)
    const parsedStock = parseFloat(stock)
    const parsedSales = parseFloat(sales)
    const parsedPurchases = parseFloat(purchases)

    if (
      [parsedCreditors, parsedDebtors, parsedStock, parsedSales, parsedPurchases].some((value) => Number.isNaN(value))
    ) {
      setResult(null)
      setError(null)
      return
    }

    try {
      setResult(calculateWorkingCapitalCycles(parsedCreditors, parsedDebtors, parsedStock, parsedSales, parsedPurchases))
      setError(null)
    } catch (e) {
      setResult(null)
      setError((e as Error).message)
    }
  }, [creditors, debtors, stock, sales, purchases])

  return (
    <CalculatorShell
      title="Working Capital Cycle"
      description="Analyze creditors, debtors, and stock as a percentage of purchases or sales."
      explainerText="Working capital cycle percentages show how long cash is tied up in receivables and inventory versus how much supplier credit offsets that funding need. The ratio helps lenders estimate peak funding gaps and whether the business is relying too heavily on external working capital support."
      result={
        result ? (
          <ResultCard
            result={result}
            calculatorType="working-capital-cycle"
            inputs={{
              creditors: parseFloat(creditors),
              debtors: parseFloat(debtors),
              stock: parseFloat(stock),
              sales: parseFloat(sales),
              purchases: parseFloat(purchases),
            }}
          />
        ) : null
      }
    >
      <div className="space-y-4">
        <CurrencyInput
          label="Creditors"
          value={creditors}
          onChange={setCreditors}
          placeholder="Enter creditors"
          helperText="Trade payables outstanding"
        />

        <CurrencyInput
          label="Debtors"
          value={debtors}
          onChange={setDebtors}
          placeholder="Enter debtors"
          helperText="Receivables outstanding"
        />

        <CurrencyInput
          label="Stock"
          value={stock}
          onChange={setStock}
          placeholder="Enter stock"
          helperText="Inventory value"
        />

        <CurrencyInput
          label="Sales"
          value={sales}
          onChange={setSales}
          placeholder="Enter sales"
          helperText="Annual or period sales used for the cycle analysis"
        />

        <CurrencyInput
          label="Purchases"
          value={purchases}
          onChange={setPurchases}
          placeholder="Enter purchases"
          helperText="Annual or period purchases used for the cycle analysis"
        />

        {error && <p className="text-xs text-[#ef4444]">{error}</p>}
      </div>
    </CalculatorShell>
  )
}