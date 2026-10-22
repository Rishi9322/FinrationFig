import { describe, it, expect } from "vitest";
import { rateFinancials, keyFigures } from "./financialRating";
import type { CalculationResult, CalculatorType, RiskLevel } from "./financialCalculations";
import type ParsedBalanceSheet from "./parsedBalanceSheet";

const row = (calculator: CalculatorType, risk: RiskLevel) => ({
  calculator,
  result: { value: 1, formatted: "1.00", interpretation: `${calculator} is ${risk}`, risk } as CalculationResult,
});
const names = { "debt-equity": "Debt / Equity", "current-ratio": "Current Ratio", dscr: "DSCR", iscr: "ISCR", ebitda: "EBITDA" };

describe("rateFinancials", () => {
  it("all low risk is an A, with every measure listed as support", () => {
    const r = rateFinancials([row("debt-equity", "low"), row("current-ratio", "low"), row("dscr", "low"), row("iscr", "low"), row("ebitda", "low")], names);
    expect([r.grade, r.score, r.label]).toEqual(["A", 100, "Strong"]);
    expect(r.strengths).toHaveLength(5);
    expect(r.concerns).toEqual([]);
  });

  it("one high-risk measure stops an A even when the average is high", () => {
    const r = rateFinancials([row("debt-equity", "low"), row("current-ratio", "low"), row("dscr", "low"), row("iscr", "high"), row("ebitda", "low")], names);
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(r.grade).toBe("B");
    expect(r.cappedBecause).toMatch(/one measure/);
    expect(r.concerns[0]).toMatch(/ISCR/);
  });

  it("two high-risk measures cap at C", () => {
    const r = rateFinancials([row("debt-equity", "high"), row("current-ratio", "low"), row("dscr", "high"), row("iscr", "low"), row("ebitda", "low")], names);
    expect(r.grade).toBe("C");
  });

  it("mostly high risk is a D", () => {
    const r = rateFinancials([row("debt-equity", "high"), row("current-ratio", "high"), row("dscr", "high"), row("iscr", "high")], names);
    expect(r.grade).toBe("D");
  });

  it("too few measures gives no grade instead of a guess", () => {
    const r = rateFinancials([row("debt-equity", "low"), { calculator: "dscr" as const, result: null }], names);
    expect(r.grade).toBeNull();
    expect(r.label).toMatch(/not enough data/i);
  });

  it("a low-confidence file marks the rating provisional", () => {
    const rows = [row("debt-equity", "low"), row("current-ratio", "low"), row("dscr", "low")];
    expect(rateFinancials(rows, names, 0.3).provisional).toBe(true);
    expect(rateFinancials(rows, names, 0.9).provisional).toBe(false);
  });
});

describe("keyFigures", () => {
  const parsed: ParsedBalanceSheet = {
    originalFormat: "pdf", parsedAt: "",
    balanceSheet: {
      assets: [{ name: "Inventories", amount: 600, group: "current-asset" }, { name: "Plant", amount: 400, group: "noncurrent-asset" }],
      liabilities: [{ name: "Term Loan", amount: 300 }, { name: "Trade Payables", amount: 200 }],
      equity: [{ name: "Share Capital", amount: 500 }],
      totals: { totalAssets: 1000 },
    },
    incomeStatement: { revenue: 5000, "net profit": 120, interestExpense: 30 },
  };
  it("collects the headline numbers the file provides and skips the ones it doesn't", () => {
    const f = Object.fromEntries(keyFigures(parsed).map((x) => [x.label, x.value]));
    expect(f).toMatchObject({ Revenue: 5000, "Net profit": 120, "Total assets": 1000, "Net worth": 500, "Total debt": 300, "Current assets": 600, "Interest cost": 30 });
    expect(f).not.toHaveProperty("Total income");
  });
});
