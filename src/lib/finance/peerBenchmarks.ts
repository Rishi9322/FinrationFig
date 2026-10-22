import data from "../../data/peerBenchmarks.json";

// Where a business sits against listed Indian companies on four credit ratios.
// Built by scripts/build-peer-benchmarks.mjs from Kaggle pacificrm/financial-sheets (CC0).
// Listed companies are mostly mid-size and large: read the result as "relative to established
// operators in the industry", not as a norm for a small firm.

export type PeerMetric = "de" | "cr" | "icr" | "opm";

export const PEER_METRICS: Record<PeerMetric, { label: string; lowerIsBetter: boolean; unit: string }> = {
  de: { label: "Debt / Equity", lowerIsBetter: true, unit: "x" },
  cr: { label: "Current Ratio", lowerIsBetter: false, unit: "x" },
  icr: { label: "Interest Cover (EBIT / Interest)", lowerIsBetter: false, unit: "x" },
  opm: { label: "Operating Margin", lowerIsBetter: false, unit: "%" },
};

type Dist = { n: number; q: number[] };
const all = data.all as Partial<Record<PeerMetric, Dist>>;
const industries = data.industries as Record<string, Partial<Record<PeerMetric, Dist>>>;

export const ALL_PEERS = "All listed non-financial companies";

export function listPeerIndustries(): string[] {
  return Object.keys(industries).sort();
}

export interface PeerPosition {
  metric: PeerMetric
  value: number
  /** The industry compared against, or ALL_PEERS when the industry has too few companies for this ratio. */
  scope: string
  peers: number
  median: number
  /** Share of peers this business is better than, 0-100, in the direction that counts as better for the metric. */
  betterThanPct: number
}

/** Fraction of the distribution at or below `value`, by interpolating between the stored quantiles. */
function percentileBelow(q: number[], value: number): number {
  if (value <= q[0]) return 0;
  if (value >= q[q.length - 1]) return 100;
  const i = q.findIndex((x) => x >= value);
  const span = q[i] - q[i - 1];
  const frac = span === 0 ? 1 : (value - q[i - 1]) / span;
  return ((i - 1 + frac) / (q.length - 1)) * 100;
}

export function peerPosition(metric: PeerMetric, value: number | null | undefined, industry?: string): PeerPosition | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const own = industry ? industries[industry]?.[metric] : undefined;
  const dist = own ?? all[metric];
  if (!dist) return null;
  const below = percentileBelow(dist.q, value);
  return {
    metric, value,
    scope: own ? industry! : ALL_PEERS,
    peers: dist.n,
    median: dist.q[Math.floor(dist.q.length / 2)],
    betterThanPct: Math.round(PEER_METRICS[metric].lowerIsBetter ? 100 - below : below),
  };
}
