import { useState, useEffect } from "react"
import { CalculatorShell } from "../../components/calculators/CalculatorShell"
import { calculateCurrentRatio, CalculationResult } from "../../../lib/financialCalculations"
import { ResultCard } from "../../components/calculators/ResultCard"
import { CurrencyInput } from "../../components/ui/CurrencyInput"

export default function CurrentRatioPage() {
  const [currentAssets, setCurrentAssets] = useState("")
  const [currentLiabilities, setCurrentLiabilities] = useState("")
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const assets = parseFloat(currentAssets)
    const liabilities = parseFloat(currentLiabilities)

    if (!isNaN(assets) && !isNaN(liabilities) && assets >= 0 && liabilities > 0) {
      try {
        setResult(calculateCurrentRatio(assets, liabilities))
        setError(null)
      } catch (e) {
        setError((e as Error).message)
        setResult(null)
      }
    } else {
      setResult(null)
      setError(null)
    }
  }, [currentAssets, currentLiabilities])

  return (
    <CalculatorShell
      title="Current Ratio"
      description="Evaluates short-term liquidity by comparing current assets to current liabilities."
      explainerText="The Current Ratio measures a business's ability to pay off its short-term obligations using assets that can be converted to cash within a year. A ratio above 1.33 is typically the minimum benchmark set by Indian banks for working capital credit limits. It is one of the most frequently referenced ratios in cash credit and overdraft assessments, as it directly reflects day-to-day financial health and operational liquidity."
      result={
        result ? (
          <ResultCard
            result={result}
            calculatorType="current-ratio"
            inputs={{ currentAssets: parseFloat(currentAssets), currentLiabilities: parseFloat(currentLiabilities) }}
          />
        ) : null
      }
    >
      <div className="space-y-4">
        <CurrencyInput
          label="Current Assets"
          value={currentAssets}
          onChange={setCurrentAssets}
          placeholder="Enter current assets"
          helperText="Cash, inventory, receivables, and other short-term assets"
        />

        <CurrencyInput
          label="Current Liabilities"
          value={currentLiabilities}
          onChange={setCurrentLiabilities}
          placeholder="Enter current liabilities"
          helperText="Obligations due within one year"
          error={error || undefined}
        />
      </div>
    </CalculatorShell>
  )
}
