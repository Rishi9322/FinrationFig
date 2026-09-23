import { useState, useEffect } from "react"
import { CalculatorShell } from "../../components/calculators/CalculatorShell"
import { calculateProfitPercent, CalculationResult } from "../../../lib/financialCalculations"
import { ResultCard } from "../../components/calculators/ResultCard"
import { CurrencyInput } from "../../components/ui/CurrencyInput"
import { getCurrentUser } from "../../../lib/auth"
import { isProfitPercentEligible } from "../../../lib/constitutionFormulas"

export default function ProfitPercentPage() {
  const eligible = isProfitPercentEligible(getCurrentUser()?.businessConstitution)
  const [profitBeforeTax, setProfitBeforeTax] = useState("")
  const [sales, setSales] = useState("")
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const pbt = parseFloat(profitBeforeTax)
    const salesValue = parseFloat(sales)

    if (!isNaN(pbt) && !isNaN(salesValue) && salesValue !== 0) {
      try {
        setResult(calculateProfitPercent(pbt, salesValue))
        setError(null)
      } catch (e) {
        setError((e as Error).message)
        setResult(null)
      }
    } else {
      setResult(null)
      setError(null)
    }
  }, [profitBeforeTax, sales])

  if (!eligible) {
    return (
      <CalculatorShell
        title="Profit %"
        description="Profit before tax as a percentage of sales."
        result={null}
      >
        <p className="text-sm text-muted-foreground">
          Profit % is currently available for LLP, Private Limited, Public Limited, and OPC constitutions.
          Update your business constitution in your profile to use this calculator.
        </p>
      </CalculatorShell>
    )
  }

  return (
    <CalculatorShell
      title="Profit %"
      description="Profit before tax as a percentage of sales."
      explainerText="Profit % measures how much of every rupee of sales converts into profit before tax. It's a quick read on operating efficiency and pricing power, and is used alongside leverage ratios to judge whether a business generates enough margin to comfortably service its obligations."
      result={
        result ? (
          <ResultCard
            result={result}
            calculatorType="profit-percent"
            inputs={{ profitBeforeTax: parseFloat(profitBeforeTax), sales: parseFloat(sales) }}
          />
        ) : null
      }
    >
      <div className="space-y-4">
        <CurrencyInput
          label="Profit Before Tax"
          value={profitBeforeTax}
          onChange={setProfitBeforeTax}
          placeholder="Enter profit before tax"
          helperText="Profit before tax for the period"
        />

        <CurrencyInput
          label="Sales"
          value={sales}
          onChange={setSales}
          placeholder="Enter total sales"
          helperText="Total sales for the period"
          error={error || undefined}
        />
      </div>
    </CalculatorShell>
  )
}
