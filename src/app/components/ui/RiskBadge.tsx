import { RiskLevel } from "../../../lib/financialCalculations"

interface RiskBadgeProps {
  risk: RiskLevel
}

export function RiskBadge({ risk }: RiskBadgeProps) {
  const styles = {
    low: "bg-accent/12 text-accent border-accent/25",
    moderate: "bg-warning/12 text-warning border-warning/25",
    high: "bg-destructive/12 text-destructive border-destructive/25",
    "n/a": "bg-foreground/5 text-muted-foreground border-foreground/10",
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
