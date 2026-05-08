import { useState, useEffect } from "react"
import { CalculatorShell } from "../../components/calculators/CalculatorShell"
import { calculateNetWorkingCapital, CalculationResult } from "../../../lib/financialCalculations"
import { ResultCard } from "../../components/calculators/ResultCard"
import { CurrencyInput } from "../../components/ui/CurrencyInput"

export default function NetWorkingCapitalPage() {
  const [currentAssets, setCurrentAssets] = useState("")
  const [currentLiabilities, setCurrentLiabilities] = useState("")
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const assets = parseFloat(currentAssets)
    const liabilities = parseFloat(currentLiabilities)

    if (!isNaN(assets) && !isNaN(liabilities)) {
      try {
        setResult(calculateNetWorkingCapital(assets, liabilities))
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
      title="Net Working Capital"
      description="Measures the surplus of current assets over current liabilities as a liquidity buffer."
      explainerText="Net Working Capital (NWC) is the rupee surplus remaining after all short-term obligations are met with current assets. A positive NWC indicates the business has a cushion to fund its operational cycle — buying raw materials, converting to goods, and collecting receivables — without needing emergency credit. Banks assess NWC trends over multiple years to judge whether a borrower's liquidity position is improving or deteriorating before sanctioning working capital limits."
      result={
        result ? (
          <ResultCard
            result={result}
            calculatorType="net-working-capital"
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
