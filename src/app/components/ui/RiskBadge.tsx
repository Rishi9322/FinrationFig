import { RiskLevel } from "../../../lib/financialCalculations"

interface RiskBadgeProps {
  risk: RiskLevel
}

export function RiskBadge({ risk }: RiskBadgeProps) {
  const styles = {
    low: "bg-[#10B981]/12 text-[#10B981] border-[#10B981]/25",
    moderate: "bg-[#f59e0b]/12 text-[#f59e0b] border-[#f59e0b]/25",
    high: "bg-[#ef4444]/12 text-[#ef4444] border-[#ef4444]/25",
    "n/a": "bg-white/5 text-[#64748B] border-white/10",
  }

  const labels = {
    low: "Low Risk",
    moderate: "Moderate Risk",
    high: "High Risk",
    "n/a": "N/A",
  }

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-['Geist_Mono'] font-medium border ${styles[risk]}`}
    >
      {labels[risk]}
    </span>
  )
}
