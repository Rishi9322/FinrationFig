import { useState, useEffect } from "react"
import { CalculatorShell } from "../../components/calculators/CalculatorShell"
import {
  calculateNCG,
  calculateOCG,
  calculateCLCC,
  calculateOCS,
  calculateQPT,
  calculateQOFFUR,
  CalculationResult,
} from "../../../lib/financialCalculations"
import { ResultCard } from "../../components/calculators/ResultCard"
import { CurrencyInput } from "../../components/ui/CurrencyInput"

function NumberField({
  label,
  value,
  onChange,
  suffix,
  helperText,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string
  helperText?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-[#F1F5F9]">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2.5 pr-10 bg-[#050A14] border border-white/10 rounded-lg text-[#F1F5F9] text-sm font-['Geist_Mono'] placeholder:text-[#94A3B8]/50 focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm font-['Geist_Mono']">
            {suffix}
          </span>
        )}
      </div>
      {helperText && <p className="text-xs text-[#94A3B8]">{helperText}</p>}
    </div>
  )
}

// Quality-of-cashflow ratios from a single set of statement-of-cashflows + balance
// sheet inputs. Formulas: https://www.cfodigital.ai/faqs
export default function CashflowQualityPage() {
  const [operatingCashflow, setOperatingCashflow] = useState("")
  const [investingCashflow, setInvestingCashflow] = useState("")
  const [financingCashflow, setFinancingCashflow] = useState("")
  const [cash, setCash] = useState("")
  const [currentLiabilities, setCurrentLiabilities] = useState("")
  const [sales, setSales] = useState("")
  const [dso, setDso] = useState("")

  const [results, setResults] = useState<Record<string, CalculationResult> | null>(null)

  useEffect(() => {
    const opCf = parseFloat(operatingCashflow)
    const invCf = parseFloat(investingCashflow)
    const finCf = parseFloat(financingCashflow)
    const cashVal = parseFloat(cash)
    const cl = parseFloat(currentLiabilities)
    const salesVal = parseFloat(sales)
    const dsoVal = parseFloat(dso)

    const netCf = opCf + invCf + finCf

    const next: Record<string, CalculationResult> = {}
    try {
      if (!isNaN(opCf) && !isNaN(invCf) && !isNaN(finCf) && !isNaN(cashVal) && cashVal !== 0) {
        next.ncg = calculateNCG(netCf, cashVal)
        next.ocg = calculateOCG(opCf, cashVal)
      }
      if (!isNaN(opCf) && !isNaN(cl) && cl !== 0) next.clcc = calculateCLCC(opCf, cl)
      if (!isNaN(opCf) && !isNaN(salesVal) && salesVal !== 0) next.ocs = calculateOCS(opCf, salesVal)
      if (!isNaN(dsoVal)) next.qpt = calculateQPT(dsoVal)
      if (!isNaN(opCf) && !isNaN(finCf)) next.qoffur = calculateQOFFUR(opCf, finCf)
    } catch {
      // leave partial results — a bad single field shouldn't blank everything out
    }

    setResults(Object.keys(next).length > 0 ? next : null)
  }, [operatingCashflow, investingCashflow, financingCashflow, cash, currentLiabilities, sales, dso])

  const labels: Record<string, string> = {
    ncg: "Net Cash Generation (NCG)",
    ocg: "Operating Cash Generation (OCG)",
    clcc: "Current Liabilities Cash Coverage (CLCC)",
    ocs: "Operating Cash to Sales (OCS)",
    qpt: "Quality of Payment Terms (QPT)",
    qoffur: "Quality of Operating-to-Financing Funds Use (QOFFUR)",
  }

  return (
    <CalculatorShell
      title="Quality of Cashflow Ratios"
      description="A set of cashflow-quality ratios that assess how effectively a business manages its sources and uses of cash across operating, investing, and financing activities."
      explainerText="Beyond margin and leverage ratios, these six ratios (NCG, OCG, CLCC, OCS, QPT, QOFFUR) read the statement of cashflows to judge whether reported profit is backed by real cash — how much of the cash balance came from operations, how well operating cashflow covers current liabilities, and whether the business is funding itself sustainably or burning cash while cutting financing."
      result={
        results ? (
          <div className="space-y-4">
            {Object.entries(results).map(([key, result]) => (
              <ResultCard
                key={key}
                result={{ ...result, interpretation: `${labels[key]}: ${result.interpretation}` }}
                calculatorType="cashflow-quality"
                inputs={{
                  operatingCashflow: parseFloat(operatingCashflow),
                  investingCashflow: parseFloat(investingCashflow),
                  financingCashflow: parseFloat(financingCashflow),
                  cash: parseFloat(cash),
                  currentLiabilities: parseFloat(currentLiabilities),
                  sales: parseFloat(sales),
                  dso: parseFloat(dso),
                  ratio: key,
                }}
              />
            ))}
          </div>
        ) : null
      }
    >
      <div className="space-y-4">
        <CurrencyInput
          label="Cash from Operating Activity"
          value={operatingCashflow}
          onChange={setOperatingCashflow}
          helperText="Can be negative"
        />
        <CurrencyInput
          label="Cash from Investing Activity"
          value={investingCashflow}
          onChange={setInvestingCashflow}
          helperText="Can be negative"
        />
        <CurrencyInput
          label="Cash from Financing Activity"
          value={financingCashflow}
          onChange={setFinancingCashflow}
          helperText="Can be negative"
        />
        <CurrencyInput label="Closing Cash Balance" value={cash} onChange={setCash} />
        <CurrencyInput label="Current Liabilities" value={currentLiabilities} onChange={setCurrentLiabilities} />
        <CurrencyInput label="Sales (Revenue)" value={sales} onChange={setSales} />
        <NumberField
          label="Days Sales Outstanding (DSO)"
          value={dso}
          onChange={setDso}
          suffix="days"
          helperText="Average collection period for receivables"
        />
      </div>
    </CalculatorShell>
  )
}
