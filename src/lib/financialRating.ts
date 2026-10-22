// Our view of a business's financials: one grade built from the calculator
// results, with the reasons. Pure functions - the report only displays this.

import type { CalculationResult, CalculatorType, RiskLevel } from "./financialCalculations";
import type ParsedBalanceSheet from "./parsedBalanceSheet";
import mapToCalculator from "./parsedToCalculatorMapper";

export type Grade = "A" | "B" | "C" | "D";

/** How much each measure counts. Coverage and liquidity decide whether debt can be serviced, so they weigh most. */
export const WEIGHT: Partial<Record<CalculatorType, number>> = {
  "debt-equity": 2, "current-ratio": 2, dscr: 2, iscr: 2, ebitda: 1.5, // quasi debt/equity restates debt/equity: shown, not scored
};
const POINTS: Record<RiskLevel, number | null> = { low: 100, moderate: 55, high: 15, "n/a": null };
const GRADE_LABEL: Record<Grade, string> = { A: "Strong", B: "Satisfactory", C: "Watch", D: "Weak" };
const MIN_WEIGHT = 4; // fewer measures than this is not a basis for a grade

export interface RatedMeasure {
  calculator: CalculatorType
  weight: number
  risk: RiskLevel
  points: number
  text: string
}

export interface Rating {
  /** 0-100, null when too few measures could be computed. */
  score: number | null
  grade: Grade | null
  label: string
  measures: RatedMeasure[]
  strengths: string[]
  concerns: string[]
  /** The file itself was read with low confidence, so the grade is only indicative. */
  provisional: boolean
  /** Why the grade was held down, if it was. */
  cappedBecause?: string
}

export function rateFinancials(
  rows: Array<{ calculator: CalculatorType; result: CalculationResult | null }>,
  names: Record<string, string>,
  extractionConfidence?: number,
): Rating {
  const measures: RatedMeasure[] = [];
  for (const r of rows) {
    const weight = WEIGHT[r.calculator];
    const points = r.result ? POINTS[r.result.risk] : null;
    if (!weight || !r.result || points === null) continue;
    measures.push({
      calculator: r.calculator, weight, risk: r.result.risk, points,
      text: `${names[r.calculator] ?? r.calculator}: ${r.result.formatted} - ${r.result.interpretation}`,
    });
  }
  const strengths = measures.filter((m) => m.risk === "low").map((m) => m.text);
  const concerns = measures.filter((m) => m.risk !== "low").sort((a, b) => a.points - b.points).map((m) => m.text);
  const provisional = (extractionConfidence ?? 1) < 0.5;

  const totalWeight = measures.reduce((s, m) => s + m.weight, 0);
  if (totalWeight < MIN_WEIGHT) {
    return { score: null, grade: null, label: "Not enough data to rate", measures, strengths, concerns, provisional };
  }
  const score = Math.round(measures.reduce((s, m) => s + m.points * m.weight, 0) / totalWeight);
  let grade: Grade = score >= 75 ? "A" : score >= 55 ? "B" : score >= 35 ? "C" : "D";

  // An average can hide a failing measure: one high-risk result stops an A, two stop a B.
  const highs = measures.filter((m) => m.risk === "high").length;
  let cappedBecause: string | undefined;
  const ceiling: Grade | null = highs >= 2 ? "C" : highs === 1 ? "B" : null;
  if (ceiling && grade < ceiling) {
    grade = ceiling;
    cappedBecause = highs >= 2 ? "two or more measures are high risk" : "one measure is high risk";
  }
  return { score, grade, label: GRADE_LABEL[grade], measures, strengths, concerns, provisional, cappedBecause };
}

export interface KeyFigure { label: string; value: number }

/** The headline numbers of the statements, whichever the file provided. Amounts are in the file's own unit. */
export function keyFigures(parsed: ParsedBalanceSheet, businessConstitution?: string): KeyFigure[] {
  const sum = (xs: Array<{ amount: number }> = []) => xs.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const bs = parsed.balanceSheet;
  const inc = parsed.incomeStatement ?? {};
  const debt = mapToCalculator("debt-equity", parsed, businessConstitution).inputs;
  const cur = mapToCalculator("current-ratio", parsed, businessConstitution).inputs;
  const out: Array<[string, number | undefined]> = [
    ["Revenue", inc.revenue],
    ["Profit before tax", inc["profit before tax"] ?? inc["net profit"]],
    ["Net profit", inc["net profit"]],
    ["Total assets", bs.totals?.totalAssets ?? (sum(bs.assets) || undefined)],
    ["Net worth", bs.totals?.totalEquity ?? (sum(bs.equity) || undefined)],
    ["Total debt", typeof debt.totalDebt === "number" ? debt.totalDebt : undefined],
    ["Current assets", typeof cur.currentAssets === "number" ? cur.currentAssets : undefined],
    ["Current liabilities", typeof cur.currentLiabilities === "number" ? cur.currentLiabilities : undefined],
    ["Interest cost", inc.interestExpense],
  ];
  return out.filter((f): f is [string, number] => typeof f[1] === "number").map(([label, value]) => ({ label, value }));
}
