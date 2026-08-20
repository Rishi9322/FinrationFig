import { useState, useEffect } from "react"
import { CalculatorShell } from "../../components/calculators/CalculatorShell"
import { calculateLYCA, calculateIAICOC, calculateROA2Bond, CalculationResult } from "../../../lib/financialCalculations"
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

// Macroeconomic-context ratios that read debt structure, inventory, and returns
// against prevailing rate conditions. All macro inputs (yield spread, inflation,
// bond rate) must be supplied — there's no live economic data feed wired up.
// Formulas: https://www.cfodigital.ai/faqs
export default function MacroRatiosPage() {
  const [yieldCurveSpread, setYieldCurveSpread] = useState("")
  const [currentLiabilities, setCurrentLiabilities] = useState("")
  const [longTermLiabilities, setLongTermLiabilities] = useState("")
  const [totalLiabilities, setTotalLiabilities] = useState("")

  const [inventory, setInventory] = useState("")
  const [totalAssets, setTotalAssets] = useState("")
  const [inflationRate, setInflationRate] = useState("")
  const [daysInInventory, setDaysInInventory] = useState("")

  const [roa, setRoa] = useState("")
  const [bondRate, setBondRate] = useState("")

  const [lyca, setLyca] = useState<CalculationResult | null>(null)
  const [iaicoc, setIaicoc] = useState<CalculationResult | null>(null)
  const [roa2bond, setRoa2Bond] = useState<CalculationResult | null>(null)

  useEffect(() => {
    const spread = parseFloat(yieldCurveSpread) / 100
    const cl = parseFloat(currentLiabilities)
    const ltl = parseFloat(longTermLiabilities)
    const tl = parseFloat(totalLiabilities)
    if (!isNaN(spread) && !isNaN(cl) && !isNaN(ltl) && !isNaN(tl) && tl !== 0) {
      try {
        setLyca(calculateLYCA(spread, cl, ltl, tl))
      } catch {
        setLyca(null)
      }
    } else setLyca(null)
  }, [yieldCurveSpread, currentLiabilities, longTermLiabilities, totalLiabilities])

  useEffect(() => {
    const inv = parseFloat(inventory)
    const assets = parseFloat(totalAssets)
    const inflation = parseFloat(inflationRate) / 100
    const days = parseFloat(daysInInventory)
    if (!isNaN(inv) && !isNaN(assets) && !isNaN(inflation) && !isNaN(days) && assets !== 0) {
      try {
        setIaicoc(calculateIAICOC(inv, assets, inflation, days))
      } catch {
        setIaicoc(null)
      }
    } else setIaicoc(null)
  }, [inventory, totalAssets, inflationRate, daysInInventory])

  useEffect(() => {
    const roaVal = parseFloat(roa) / 100
    const bond = parseFloat(bondRate) / 100
    if (!isNaN(roaVal) && !isNaN(bond) && bond !== 0) {
      try {
        setRoa2Bond(calculateROA2Bond(roaVal, bond))
      } catch {
        setRoa2Bond(null)
      }
    } else setRoa2Bond(null)
  }, [roa, bondRate])

  return (
    <CalculatorShell
      title="Macro-Context Ratios"
      description="Ratios that read a business's debt structure, inventory carrying cost, and return on assets against the prevailing macroeconomic environment."
      explainerText="Financial ratios are dynamic and should be read against economic conditions, not fixed benchmarks. LYCA checks whether the debt maturity mix is aligned with the current yield curve, IAICOC quantifies the inflation-adjusted cost of carrying inventory, and ROA2Bond compares return on assets to the prevailing cost of borrowing. All three require you to supply the macro inputs (yield spread, inflation, bond rate) — there's no live rate feed."
      result={
        <div className="space-y-4">
          {lyca && (
            <ResultCard
              result={lyca}
              calculatorType="macro-ratios"
              inputs={{ yieldCurveSpread, currentLiabilities, longTermLiabilities, totalLiabilities, ratio: "lyca" }}
            />
          )}
          {iaicoc && (
            <ResultCard
              result={iaicoc}
              calculatorType="macro-ratios"
              inputs={{ inventory, totalAssets, inflationRate, daysInInventory, ratio: "iaicoc" }}
            />
          )}
          {roa2bond && (
            <ResultCard
              result={roa2bond}
              calculatorType="macro-ratios"
              inputs={{ roa, bondRate, ratio: "roa2bond" }}
            />
          )}
          {!lyca && !iaicoc && !roa2bond && null}
        </div>
      }
    >
      <div className="space-y-6">
        <div className="space-y-4">
          <p className="text-xs font-['Geist_Mono'] text-[#60A5FA] uppercase tracking-widest">Debt vs. Yield Curve (LYCA)</p>
          <NumberField
            label="Yield Curve Spread"
            value={yieldCurveSpread}
            onChange={setYieldCurveSpread}
            suffix="%"
            helperText="Short-term rate minus long-term rate. Negative if normal (upward-sloping) curve."
          />
          <CurrencyInput label="Current Liabilities" value={currentLiabilities} onChange={setCurrentLiabilities} />
          <CurrencyInput label="Long-Term Liabilities" value={longTermLiabilities} onChange={setLongTermLiabilities} />
          <CurrencyInput label="Total Liabilities" value={totalLiabilities} onChange={setTotalLiabilities} />
        </div>

        <div className="space-y-4 pt-4 border-t border-white/8">
          <p className="text-xs font-['Geist_Mono'] text-[#60A5FA] uppercase tracking-widest">Inventory Carry Cost (IAICOC)</p>
          <CurrencyInput label="Inventory" value={inventory} onChange={setInventory} />
          <CurrencyInput label="Total Assets" value={totalAssets} onChange={setTotalAssets} />
          <NumberField label="Annual Inflation Rate" value={inflationRate} onChange={setInflationRate} suffix="%" />
          <NumberField label="Average Days in Inventory" value={daysInInventory} onChange={setDaysInInventory} suffix="days" />
        </div>

        <div className="space-y-4 pt-4 border-t border-white/8">
          <p className="text-xs font-['Geist_Mono'] text-[#60A5FA] uppercase tracking-widest">ROA vs. Cost of Borrowing</p>
          <NumberField label="Quarterly Return on Assets (ROA)" value={roa} onChange={setRoa} suffix="%" />
          <NumberField label="Corporate Bond Yield" value={bondRate} onChange={setBondRate} suffix="%" helperText="e.g. Moody's BAA yield" />
        </div>
      </div>
    </CalculatorShell>
  )
}
