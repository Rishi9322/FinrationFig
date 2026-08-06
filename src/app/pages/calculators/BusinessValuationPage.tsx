import { useEffect, useState } from "react"
import { CalculatorShell } from "../../components/calculators/CalculatorShell"
import { ResultCard } from "../../components/calculators/ResultCard"
import { CurrencyInput } from "../../components/ui/CurrencyInput"
import { CalculationResult, calculateValuation } from "../../../lib/financialCalculations"

export default function BusinessValuationPage() {
  const [ebitda, setEbitda] = useState("")
  const [multiple, setMultiple] = useState("6")
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const parsedEbitda = parseFloat(ebitda)
    const parsedMultiple = parseFloat(multiple)

    if (Number.isNaN(parsedEbitda) || Number.isNaN(parsedMultiple)) {
      setResult(null)
      setError(null)
      return
    }

    try {
      setResult(calculateValuation(parsedEbitda, parsedMultiple))
      setError(null)
    } catch (e) {
      setResult(null)
      setError((e as Error).message)
    }
  }, [ebitda, multiple])

  return (
    <CalculatorShell
      title="Business Valuation"
      description="Estimate business valuation using EBITDA multiples."
      explainerText="Business valuation gives a quick, lender-friendly estimate of enterprise value by applying an EBITDA multiple. The right multiple depends on industry, growth, customer concentration, and funding risk. Use this calculator to sanity-check acquisition pricing, sanction discussions, or credit committee assumptions."
      result={
        result ? <ResultCard result={result} calculatorType="valuation" inputs={{ ebitda: parseFloat(ebitda), multiple: parseFloat(multiple) }} /> : null
      }
    >
      <div className="space-y-4">
        <CurrencyInput
          label="EBITDA"
          value={ebitda}
          onChange={setEbitda}
          placeholder="Enter EBITDA"
          helperText="Earnings before interest, tax, depreciation, and amortisation"
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#F1F5F9]">EBITDA Multiple</label>
          <input
            type="number"
            value={multiple}
            onChange={(e) => setMultiple(e.target.value)}
            placeholder="6"
            min="0"
            step="0.1"
            className="w-full px-4 py-2.5 bg-[#050A14] border border-white/10 rounded-lg text-[#F1F5F9] text-sm font-['Geist_Mono'] placeholder:text-[#94A3B8]/50 focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
          />
          <p className="text-xs text-[#94A3B8]">Typical market multiple used for the estimate</p>
        </div>

        {error && <p className="text-xs text-[#ef4444]">{error}</p>}
      </div>
    </CalculatorShell>
  )
}