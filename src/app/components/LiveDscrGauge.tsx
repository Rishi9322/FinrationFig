import { useEffect, useMemo, useRef, useState } from "react"
import { CurrencyInput } from "./ui/CurrencyInput"
import { RiskBadge } from "./ui/RiskBadge"
import { calculateDSCR, type RiskLevel } from "../../lib/financialCalculations"

/* ---------------------------------------------------------------------------------------------
   A working Debt Service Coverage Ratio calculator with a gauge that answers the number.
   The maths, the risk bands and the reading all come from the app's own calculateDSCR, so
   nothing on screen is invented. The needle sweeps in once when the card scrolls into view;
   after that it follows whatever is typed. Reduced motion: no sweep, no easing.
   --------------------------------------------------------------------------------------------- */

const MAX = 2.5            // the gauge runs 0 to 2.5
const CX = 120
const CY = 120
const R = 96

const point = (f: number, r = R) => {
  const a = Math.PI * (1 - f)
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)] as const
}
const arc = (f0: number, f1: number) => {
  const [x0, y0] = point(f0)
  const [x1, y1] = point(f1)
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

const RISK_TEXT: Record<RiskLevel, string> = {
  low: "text-accent",
  moderate: "text-warning",
  high: "text-destructive",
  "n/a": "text-muted-foreground",
}

export function LiveDscrGauge() {
  const [income, setIncome] = useState("1410000")
  const [service, setService] = useState("1000000")
  const [seen, setSeen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true)
          obs.disconnect()
        }
      },
      { threshold: 0.35 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const result = useMemo(() => {
    const n = parseFloat(income)
    const d = parseFloat(service)
    if (isNaN(n) || isNaN(d) || d === 0) return null
    try { return calculateDSCR(n, d) } catch { return null }
  }, [income, service])

  const value = result ? Math.min(Math.max(result.value, 0), MAX) : 0
  const shown = seen || reduce ? value : 0
  const angle = -90 + (shown / MAX) * 180
  const risk: RiskLevel = result?.risk ?? "n/a"
  const ease = reduce ? "none" : "transform 800ms cubic-bezier(0.16, 1, 0.3, 1)"

  return (
    <div ref={ref} className="bg-card border border-foreground/8 rounded-2xl p-6 sm:p-8">
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <CurrencyInput label="Net Operating Income" value={income} onChange={setIncome} placeholder="Enter net operating income" />
        <CurrencyInput label="Total Debt Service" value={service} onChange={setService} placeholder="Enter total debt service" />
      </div>

      {/* The gauge: red below 1.0, amber to 1.5, green above, exactly the app's bands */}
      <svg viewBox="0 0 240 142" className="w-full max-w-sm mx-auto block" aria-hidden="true">
        <path d={arc(0, 0.4)} fill="none" strokeWidth="14" strokeLinecap="butt" style={{ stroke: "var(--destructive)", opacity: 0.8 }} />
        <path d={arc(0.4, 0.6)} fill="none" strokeWidth="14" strokeLinecap="butt" style={{ stroke: "var(--warning)", opacity: 0.8 }} />
        <path d={arc(0.6, 1)} fill="none" strokeWidth="14" strokeLinecap="butt" style={{ stroke: "var(--accent)", opacity: 0.8 }} />
        {([[0, "0"], [0.4, "1.0"], [0.6, "1.5"], [1, "2.5"]] as const).map(([f, label]) => {
          const [x, y] = point(f, R + 17)
          return (
            <text key={label} x={x} y={y + 3} textAnchor="middle" fontSize="9" fontFamily="'Geist Mono', monospace" style={{ fill: "var(--muted-foreground)" }}>
              {label}
            </text>
          )
        })}
        <g style={{ transformOrigin: `${CX}px ${CY}px`, transform: `rotate(${angle}deg)`, transition: ease }}>
          <line x1={CX} y1={CY} x2={CX} y2={CY - R + 8} strokeWidth="3" strokeLinecap="round" style={{ stroke: "var(--foreground)" }} />
        </g>
        <circle cx={CX} cy={CY} r="7" style={{ fill: "var(--foreground)" }} />
        <circle cx={CX} cy={CY} r="3" style={{ fill: "var(--card)" }} />
      </svg>

      <div aria-live="polite" className="mt-2 text-center">
        {result ? (
          <>
            <p className={`font-['Geist_Mono'] text-5xl font-medium tabular-nums transition-colors duration-300 ${RISK_TEXT[risk]}`}>
              {result.formatted}
            </p>
            <div className="mt-3 flex justify-center"><RiskBadge risk={risk} /></div>
            <p className="mt-4 text-sm text-foreground leading-relaxed max-w-sm mx-auto">{result.interpretation}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground py-6">Enter both figures to see the ratio.</p>
        )}
      </div>
    </div>
  )
}
