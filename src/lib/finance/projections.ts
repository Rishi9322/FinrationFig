import type { CmaParsedData } from "./cmaTypes";

// ponytail: single growth/margin lever per scenario, debt service held flat at
// the base year's figure - a real forward model would roll the full balance
// sheet forward and let debt service move with new borrowings/repayments.
// Upgrade path: replace the flat debtService with a repayment schedule once
// the projections need to double as a sanction-limit tool, not a screening one.

export type ScenarioKey = "best" | "base" | "worst";

export interface ScenarioAssumptions {
  growthRate: number; // e.g. 0.10 = 10% YoY sales growth, base case
  marginSwing: number; // e.g. 0.02 = best case gets +2pt margin, worst gets -2pt
  growthSwing: number; // e.g. 0.05 = best case gets +5pt growth, worst gets -5pt
}

export interface ProjectedYear {
  label: string;
  netSales: number;
  netProfit: number;
  margin: number;
  dscr: number;
}

export interface ScenarioProjection {
  scenario: ScenarioKey;
  years: ProjectedYear[]; // 2 entries: +12mo, +24mo
}

/**
 * Projects the next two years of Net Sales / Net Profit / DSCR from the last
 * actual (or latest available) year, under three growth/margin assumptions.
 * Deterministic math only - the AI narrates around this, it never computes it.
 */
export function projectScenarios(
  parsedData: CmaParsedData,
  assumptions: ScenarioAssumptions
): ScenarioProjection[] {
  const { operatingStatement, balanceSheet, years, yearTypes } = parsedData;

  let baseIndex = yearTypes.lastIndexOf("Actual");
  if (baseIndex === -1) baseIndex = years.length - 1;
  if (baseIndex < 0) throw new Error("No years available to project from");

  const baseSales = operatingStatement.netSales[baseIndex] || 0;
  const baseNetProfit = operatingStatement.netProfit[baseIndex] || 0;
  const baseMargin = baseSales === 0 ? 0 : baseNetProfit / baseSales;
  const baseDepreciation = operatingStatement.depreciationManufacturing[baseIndex] || 0;
  const baseInterest = operatingStatement.totalInterest[baseIndex] || 0;
  const debtService =
    (balanceSheet.currentLiabilities.tlInstalmentsWithin1Yr[baseIndex] || 0) + baseInterest;

  const scenarios: Array<{ key: ScenarioKey; growthDelta: number; marginDelta: number }> = [
    { key: "best", growthDelta: assumptions.growthSwing, marginDelta: assumptions.marginSwing },
    { key: "base", growthDelta: 0, marginDelta: 0 },
    { key: "worst", growthDelta: -assumptions.growthSwing, marginDelta: -assumptions.marginSwing },
  ];

  return scenarios.map(({ key, growthDelta, marginDelta }) => {
    const growth = Math.max(assumptions.growthRate + growthDelta, -0.9); // never below -90% YoY
    const margin = baseMargin + marginDelta;

    const years: ProjectedYear[] = [];
    let sales = baseSales;
    for (let i = 1; i <= 2; i++) {
      sales = sales * (1 + growth);
      const netProfit = sales * margin;
      const dscr = debtService === 0 ? 0 : (netProfit + baseDepreciation + baseInterest) / debtService;
      years.push({
        label: i === 1 ? "+12 months" : "+24 months",
        netSales: sales,
        netProfit,
        margin,
        dscr,
      });
    }

    return { scenario: key, years };
  });
}
