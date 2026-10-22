import { describe, it, expect } from "vitest";
import { CMA_EXTRACTION_PROMPT } from "./cmaPrompt";
import { crossCheckAgainstSource } from "./sourceCheck";

describe("CMA extraction prompt", () => {
  it("tells the model how Indian statements word each line, not just which fields exist", () => {
    for (const term of ["Sundry debtors", "Trade receivables", "Bank OD", "Cash credit", "Capital Account", "Stock-in-trade", "Current maturities", "Finance costs", "Deferred payment liabilities"]) {
      expect(CMA_EXTRACTION_PROMPT).toContain(term);
    }
  });

  it("covers the layouts: two-sided, proprietorship, trading account, Add/Less, subtotal columns", () => {
    expect(CMA_EXTRACTION_PROMPT).toMatch(/liabilities on the left and assets on the right/);
    expect(CMA_EXTRACTION_PROMPT).toMatch(/proprietorship/i);
    expect(CMA_EXTRACTION_PROMPT).toMatch(/Trading Account/);
    expect(CMA_EXTRACTION_PROMPT).toMatch(/"Less:" lines subtract/);
    expect(CMA_EXTRACTION_PROMPT).toMatch(/SUBTOTALS/);
  });

  it("makes the model convert every unit to Rs. Lakhs instead of labelling raw figures as lakhs", () => {
    expect(CMA_EXTRACTION_PROMPT).toMatch(/ALWAYS return amounts in Rs\. Lakhs/);
    expect(CMA_EXTRACTION_PROMPT).toMatch(/crore x 100/);
    expect(CMA_EXTRACTION_PROMPT).toMatch(/rupees \/ 1,00,000/);
  });

  it("no longer carries sample years the model could copy into an unrelated document", () => {
    expect(CMA_EXTRACTION_PROMPT).not.toMatch(/2024-25|2025-26|2026-27/);
    expect(CMA_EXTRACTION_PROMPT).toMatch(/Never invent a year/);
  });

  it("keeps the schema the rest of the app reads", () => {
    for (const key of ["operatingStatement", "balanceSheet", "bankBorrowingsCC", "sundryCreditors", "totalAssets", "tangibleNetWorth", "netWorkingCapital"]) {
      expect(CMA_EXTRACTION_PROMPT).toContain(`"${key}"`);
    }
  });
});

describe("crossCheckAgainstSource", () => {
  const source = (unit: string, total: string) =>
    [`Balance Sheet as at 31st March, 2025`, `(${unit})`, "Particulars | Note | 2025 | 2024", "ASSETS", "Current Assets", "Cash | 1 | 400 | 300", `Total Assets | ${total} | 900`].join("\n");
  const parsed = (totalAssets: number[]) => ({ balanceSheet: { totalAssets } });

  it("matches when the extracted figure is the printed one converted to lakhs", () => {
    // printed in rupees, returned in lakhs
    expect(crossCheckAgainstSource(parsed([0.01]), source("Rs. in rupees", "1,00,000")).sourceCheck).toMatchObject({ status: "match" });
    // printed in lakhs, returned unchanged
    expect(crossCheckAgainstSource(parsed([4200]), source("Rs. in lakhs", "4,200")).sourceCheck).toMatchObject({ status: "match" });
    // printed in crore, returned x100
    expect(crossCheckAgainstSource(parsed([420000]), source("Rs. in crore", "4,200")).sourceCheck).toMatchObject({ status: "match" });
  });

  it("matches any year in the series, since the model may order years differently", () => {
    expect(crossCheckAgainstSource(parsed([3900, 4200, 4500]), source("Rs. in lakhs", "4,200")).sourceCheck).toMatchObject({ status: "match" });
  });

  it("flags a figure that is not a unit conversion of what the document prints", () => {
    const r = crossCheckAgainstSource(parsed([3500]), source("Rs. in lakhs", "4,200")).sourceCheck as any;
    expect(r.status).toBe("mismatch");
    expect(r.detail).toMatch(/do not agree/);
  });

  it("flags a missing extraction when the document does print a total", () => {
    expect(crossCheckAgainstSource(parsed([]), source("Rs. in lakhs", "4,200")).sourceCheck).toMatchObject({ status: "mismatch" });
  });

  it("says unverified, not mismatch, when the document prints no readable total", () => {
    const r = crossCheckAgainstSource(parsed([4200]), "Cash 100\nDebtors 200").sourceCheck as any;
    expect(r.status).toBe("unverified");
  });

  it("keeps everything else the model returned", () => {
    const r = crossCheckAgainstSource({ company: "X", balanceSheet: { totalAssets: [4200] }, years: ["2025"] }, source("Rs. in lakhs", "4,200"));
    expect(r.company).toBe("X");
    expect(r.years).toEqual(["2025"]);
  });
});
