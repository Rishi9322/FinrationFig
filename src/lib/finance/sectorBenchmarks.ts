import benchmarks from "../../data/sectorBenchmarks.json";

// Sector-median KPIs derived from ~4,400 NSE/BSE-listed Indian companies
// (Kaggle: sameerprogrammer/detailed-financial-data-of-4456-nse-and-bse-company,
// CC BY-NC-ND 4.0 — non-commercial use). Rebuild via scripts/build-sector-benchmarks.mjs.
export type SectorBenchmark = {
  sampleSize: number;
  "Debtor Days"?: number;
  "Inventory Days"?: number;
  "Days Payable"?: number;
  "Cash Conversion Cycle"?: number;
  "Working Capital Days"?: number;
  "ROCE %"?: number;
  "Operating Cashflow to Sales"?: number;
};

const sectorBenchmarks = benchmarks as Record<string, SectorBenchmark>;

export function listBenchmarkSectors(): string[] {
  return Object.keys(sectorBenchmarks).sort();
}

export function getSectorBenchmark(sector: string): SectorBenchmark | null {
  return sectorBenchmarks[sector] ?? null;
}
