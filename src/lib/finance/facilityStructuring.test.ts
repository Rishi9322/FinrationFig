import { describe, it, expect } from "vitest";
import { suggestMpbfLimit, sizeTermLoan, tenureSensitivity } from "./facilityStructuring";
import type { CmaParsedData, CmaComputedData } from "./cmaTypes";

const parsed = { years: ["2024-25"] } as CmaParsedData;
const computed = {
  mpbf: { mpbfValue: [120] },
  dscr: { dscrNumerator: [150], dscrDenominator: [80] },
} as unknown as CmaComputedData;

describe("suggestMpbfLimit", () => {
  it("reads the latest year's MPBF value", () => {
    expect(suggestMpbfLimit(parsed, computed)).toEqual({ year: "2024-25", mpbfValue: 120 });
  });
});

describe("sizeTermLoan", () => {
  it("sizes a loan such that the resulting DSCR hits the target", () => {
    const sizing = sizeTermLoan(parsed, computed, { interestRate: 0.1, tenureYears: 5, targetDscr: 1.5 });
    // maxAnnualEmi = 150/1.5 - 80 = 20
    expect(sizing.maxAnnualEmi).toBeCloseTo(20, 5);
    expect(sizing.maxLoanAmount).toBeGreaterThan(0);
    // Reconstituted DSCR at that EMI should equal the target.
    const dscrAtMax = sizing.annualCashAccrual / (sizing.existingDebtService + sizing.maxAnnualEmi);
    expect(dscrAtMax).toBeCloseTo(1.5, 5);
  });

  it("clamps to zero when the business can't service any more debt at the target DSCR", () => {
    const tightComputed = { mpbf: { mpbfValue: [0] }, dscr: { dscrNumerator: [100], dscrDenominator: [90] } } as unknown as CmaComputedData;
    const sizing = sizeTermLoan(parsed, tightComputed, { interestRate: 0.1, tenureYears: 5, targetDscr: 1.5 });
    expect(sizing.maxAnnualEmi).toBe(0);
    expect(sizing.maxLoanAmount).toBe(0);
  });
});

describe("tenureSensitivity", () => {
  it("shows lower EMI and higher DSCR as tenure lengthens", () => {
    const rows = tenureSensitivity(parsed, computed, { loanAmount: 200, interestRate: 0.1, tenureOptions: [3, 5, 10] });
    expect(rows).toHaveLength(3);
    expect(rows[0].annualEmi).toBeGreaterThan(rows[1].annualEmi);
    expect(rows[1].annualEmi).toBeGreaterThan(rows[2].annualEmi);
    expect(rows[0].projectedDscr).toBeLessThan(rows[1].projectedDscr);
  });
});
