import { useState } from "react"
import { ALL_PEERS, PEER_METRICS, listPeerIndustries, peerPosition, type PeerMetric } from "../../../lib/finance/peerBenchmarks"

type Props = {
  /** The business's own ratios; a missing one is simply not compared. */
  values: Partial<Record<PeerMetric, number | null>>
}

const ORDER: PeerMetric[] = ["de", "cr", "icr", "opm"]
const industries = listPeerIndustries()

const fmt = (n: number, unit: string) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${unit === "%" ? "%" : "x"}`

function tone(pct: number) {
  return pct >= 66 ? "bg-accent" : pct >= 33 ? "bg-warning" : "bg-destructive"
}

export function PeerComparison({ values }: Props) {
  const [industry, setIndustry] = useState("")
  const rows = ORDER.map((m) => peerPosition(m, values[m], industry || undefined)).filter((r): r is NonNullable<typeof r> => !!r)
  if (!rows.length) return null

  return (
    <div className="bs-report-section space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h4 className="text-xs font-['Geist_Mono'] text-link uppercase tracking-widest">How you compare with peers</h4>
        <label className="flex items-center gap-2 text-xs text-muted-foreground no-print">
          Industry
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            aria-label="Peer industry"
            className="bg-background border border-foreground/10 rounded-lg px-2 py-1.5 text-xs text-foreground"
          >
            <option value="">{ALL_PEERS}</option>
            {industries.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-foreground/10">
            <th className="py-1.5 font-normal">Measure</th>
            <th className="font-normal">This business</th>
            <th className="font-normal">Peer median</th>
            <th className="font-normal w-2/5">Better than</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const meta = PEER_METRICS[r.metric]
            return (
              <tr key={r.metric} className="border-b border-foreground/5 align-middle">
                <td className="py-2 pr-4">
                  {meta.label}
                  <span className="block text-muted-foreground">{meta.lowerIsBetter ? "lower is better" : "higher is better"} · {r.scope}, {r.peers} companies</span>
                </td>
                <td className="font-['Geist_Mono'] tabular-nums">{fmt(r.value, meta.unit)}</td>
                <td className="font-['Geist_Mono'] tabular-nums">{fmt(r.median, meta.unit)}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-foreground/10 overflow-hidden" role="img" aria-label={`Better than ${r.betterThanPct}% of peers`}>
                      <div className={`h-full ${tone(r.betterThanPct)}`} style={{ width: `${Math.max(r.betterThanPct, 2)}%` }} />
                    </div>
                    <span className="font-['Geist_Mono'] tabular-nums w-10 text-right">{r.betterThanPct}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Peers are listed Indian companies (latest annual results, financial companies excluded), mostly mid-size and large - a small firm is
        usually weaker on these measures than the median listed peer, so read this as a comparison with established operators.
      </p>
    </div>
  )
}
