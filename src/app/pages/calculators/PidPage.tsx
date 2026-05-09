import { useEffect, useState } from "react"
import { CalculatorShell } from "../../components/calculators/CalculatorShell"
import { ResultCard } from "../../components/calculators/ResultCard"
import { CurrencyInput } from "../../components/ui/CurrencyInput"
import { CalculationResult, calculatePID, formatCurrency } from "../../../lib/financialCalculations"

function toNumber(value: string): number {
  return parseFloat(value)
}

export default function PidPage() {
  const [projectedAnnualSales, setProjectedAnnualSales] = useState("")
  const [annualPurchase, setAnnualPurchase] = useState("")
  const [marginPercent, setMarginPercent] = useState("15")
  const [salesCreditDays, setSalesCreditDays] = useState("60")
  const [purchaseCreditDays, setPurchaseCreditDays] = useState("30")
  const [pidLimit, setPidLimit] = useState("")
  const [pidCostPerMonthPercent, setPidCostPerMonthPercent] = useState("1.25")
  const [cashDiscountPercent, setCashDiscountPercent] = useState("2")
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sales = toNumber(projectedAnnualSales)
    const purchases = toNumber(annualPurchase)
    const margin = toNumber(marginPercent)
    const salesDays = toNumber(salesCreditDays)
    const purchaseDays = toNumber(purchaseCreditDays)
    const limit = toNumber(pidLimit)
    const monthlyCost = toNumber(pidCostPerMonthPercent)
    const discount = toNumber(cashDiscountPercent)

    if (
      [sales, purchases, margin, salesDays, purchaseDays, limit, monthlyCost, discount].some((value) => Number.isNaN(value))
    ) {
      setResult(null)
      setError(null)
      return
    }

    if (salesDays <= purchaseDays) {
      setResult(null)
      setError("Sales credit days must be greater than purchase credit days.")
      return
    }

    try {
      const pidResult = calculatePID({
        projectedAnnualSales: sales,
        annualPurchase: purchases,
        marginPercent: margin,
        salesCreditDays: salesDays,
        purchaseCreditDays: purchaseDays,
        pidLimit: limit,
        pidCostPerMonthPercent: monthlyCost,
        cashDiscountPercent: discount,
      })

      setResult({
        value: pidResult.totalProfitIncrease,
        formatted: formatCurrency(pidResult.totalProfitIncrease),
        interpretation: pidResult.interpretation,
        risk: pidResult.risk,
        details:
          `Net PID benefit: ${formatCurrency(pidResult.netPidBenefit)} · ` +
          `Additional profit: ${formatCurrency(pidResult.additionalProfit)} · ` +
          `PID cost per year: ${formatCurrency(pidResult.pidCostAnnual)}`,
      })
      setError(null)
    } catch (e) {
      setResult(null)
      setError((e as Error).message)
    }
  }, [
    projectedAnnualSales,
    annualPurchase,
    marginPercent,
    salesCreditDays,
    purchaseCreditDays,
    pidLimit,
    pidCostPerMonthPercent,
    cashDiscountPercent,
  ])

  return (
    <CalculatorShell
      title="Purchase Invoice Discounting"
      description="Calculate the net benefit of purchase invoice discounting facility."
      explainerText="Purchase Invoice Discounting helps bridge the gap between purchase payments and customer collections. The calculation estimates the annual benefit from accelerated cash conversion versus the facility cost and any cash discounts earned. It is most useful when the business can finance receivables efficiently and the sales-credit period is materially longer than the purchase-credit period."
      result={
        result ? (
          <ResultCard
            result={result}
            calculatorType="pid"
            inputs={{
              projectedAnnualSales: toNumber(projectedAnnualSales),
              annualPurchase: toNumber(annualPurchase),
              marginPercent: toNumber(marginPercent),
              salesCreditDays: toNumber(salesCreditDays),
              purchaseCreditDays: toNumber(purchaseCreditDays),
              pidLimit: toNumber(pidLimit),
              pidCostPerMonthPercent: toNumber(pidCostPerMonthPercent),
              cashDiscountPercent: toNumber(cashDiscountPercent),
            }}
          />
        ) : null
      }
    >
      <div className="space-y-4">
        <CurrencyInput
          label="Projected Annual Sales"
          value={projectedAnnualSales}
          onChange={setProjectedAnnualSales}
          placeholder="Enter projected annual sales"
          helperText="Expected yearly sales turnover"
        />

        <CurrencyInput
          label="Annual Purchase"
          value={annualPurchase}
          onChange={setAnnualPurchase}
          placeholder="Enter annual purchase"
          helperText="Expected yearly purchase value"
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#F1F5F9]">Margin Percentage</label>
          <input
            type="number"
            value={marginPercent}
            onChange={(e) => setMarginPercent(e.target.value)}
            placeholder="15"
            min="0"
            max="100"
            step="0.1"
            className="w-full px-4 py-2.5 bg-[#050A14] border border-white/10 rounded-lg text-[#F1F5F9] text-sm font-['Geist_Mono'] placeholder:text-[#64748B]/50 focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
          />
          <p className="text-xs text-[#64748B]">Profit margin on sales</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#F1F5F9]">Sales Credit Days</label>
            <input
              type="number"
              value={salesCreditDays}
              onChange={(e) => setSalesCreditDays(e.target.value)}
              placeholder="60"
              min="0"
              step="1"
              className="w-full px-4 py-2.5 bg-[#050A14] border border-white/10 rounded-lg text-[#F1F5F9] text-sm font-['Geist_Mono'] placeholder:text-[#64748B]/50 focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#F1F5F9]">Purchase Credit Days</label>
            <input
              type="number"
              value={purchaseCreditDays}
              onChange={(e) => setPurchaseCreditDays(e.target.value)}
              placeholder="30"
              min="0"
              step="1"
              className="w-full px-4 py-2.5 bg-[#050A14] border border-white/10 rounded-lg text-[#F1F5F9] text-sm font-['Geist_Mono'] placeholder:text-[#64748B]/50 focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
            />
          </div>
        </div>

        <CurrencyInput
          label="PID Limit"
          value={pidLimit}
          onChange={setPidLimit}
          placeholder="Enter PID limit"
          helperText="Sanctioned PID facility limit"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#F1F5F9]">PID Cost Per Month (%)</label>
            <input
              type="number"
              value={pidCostPerMonthPercent}
              onChange={(e) => setPidCostPerMonthPercent(e.target.value)}
              placeholder="1.25"
              min="0"
              step="0.01"
              className="w-full px-4 py-2.5 bg-[#050A14] border border-white/10 rounded-lg text-[#F1F5F9] text-sm font-['Geist_Mono'] placeholder:text-[#64748B]/50 focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#F1F5F9]">Cash Discount (%)</label>
            <input
              type="number"
              value={cashDiscountPercent}
              onChange={(e) => setCashDiscountPercent(e.target.value)}
              placeholder="2"
              min="0"
              step="0.01"
              className="w-full px-4 py-2.5 bg-[#050A14] border border-white/10 rounded-lg text-[#F1F5F9] text-sm font-['Geist_Mono'] placeholder:text-[#64748B]/50 focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
            />
          </div>
        </div>

        {error && <p className="text-xs text-[#ef4444]">{error}</p>}
      </div>
    </CalculatorShell>
  )
}