// Defects from the final doc-parser QA pass.
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { periodKey, yearColumnIndex, itemsFromRows, parseStatementLines, buildSections, scoreExtraction } from "./statementParsing";
import parseFile from "./parsers";
import { mapToCalculator } from "./parsedToCalculatorMapper";

const item = (name: string, value: number) => ({ name, value });

describe("period headers of every common style pick the latest column", () => {
  it.each([
    ["2025-26", "2024-25"], ["FY25", "FY24"], ["FY 2025", "FY 2024"], ["Mar-25", "Mar-24"], ["March 2025", "March 2024"],
    ["31-Mar-25", "31-Mar-24"], ["31/03/2025", "31/03/2024"], ["31.03.25", "31.03.24"], ["As at 31 March 2025", "As at 31 March 2024"],
  ])("%j is later than %j", (later, earlier) => {
    expect(periodKey(later)).toBeGreaterThan(periodKey(earlier));
  });

  it("ordinary words are not periods", () => {
    for (const c of ["Particulars", "Note", "Amount", "", "Share Capital"]) expect(periodKey(c)).toBeNaN();
  });

  it("the old failure: '31-Mar-24 | 31-Mar-25' (oldest first) reads the 2025 column", () => {
    const rows = [["Particulars", "31-Mar-24", "31-Mar-25"], ["Term Loans", "500", "700"], ["Share Capital", "450", "550"]];
    expect(yearColumnIndex(rows[0])).toBe(2);
    expect(itemsFromRows(rows)).toEqual([item("Term Loans", 700), item("Share Capital", 550)]);
  });

  it("newest-first date headers work too", () => {
    expect(yearColumnIndex(["Particulars", "31-Mar-25", "31-Mar-24"])).toBe(1);
  });
});

describe("ratio and percentage rows are not statement lines", () => {
  it("'Debt Equity Ratio 1.27' is no longer added to debt", () => {
    const s = buildSections([item("Term Loans", 700), item("Debt Equity Ratio", 1.27), item("Current Ratio", 1.27), item("Return on Equity %", 12.5), item("ROE", 12)]);
    expect(s.liabilities).toEqual([{ name: "Term Loans", amount: 700 }]);
    expect(s.unclassified).toEqual([]);
  });

  it("but 'Margin Money' deposits (a real asset) are kept", () => {
    expect(buildSections([item("Margin Money Deposit", 40)]).assets.map((a) => a.name)).toEqual(["Margin Money Deposit"]);
  });

  it("end to end: the mapped debt is 700, not 701.27", async () => {
    const csv = "Name,Amount\nShare Capital,550\nTerm Loans,400\nCash Credit,300\nDebt Equity Ratio,1.27\nFixed Assets,1250";
    const parsed = await parseFile(new File([csv], "bs.csv", { type: "text/csv" }));
    expect(mapToCalculator("debt-equity", parsed, "Private Limited Company").inputs).toEqual({ totalDebt: 700, totalEquity: 550 });
  });
});

describe("labels that wrapped onto two lines are rejoined", () => {
  it("plain text: 'Cash Credit' / 'from Bank   300'", () => {
    expect(parseStatementLines("Cash Credit\nfrom Bank   300")).toEqual([item("Cash Credit from Bank", 300)]);
  });

  it("PDF rows: a label-only row followed by a continuation row", () => {
    expect(parseStatementLines("Term Loans\nand Advances | 1,200")).toEqual([item("Term Loans and Advances", 1200)]);
  });

  it("an unrelated label-only line (a section heading) is NOT glued onto the next real line", () => {
    expect(parseStatementLines("Current Liabilities\nSundry Creditors   250")).toEqual([item("Sundry Creditors", 250)]);
    expect(parseStatementLines("EQUITY AND LIABILITIES\nShare Capital | 1,000")).toEqual([item("Share Capital", 1000)]);
  });
});

describe("score is capped when the figures contradict themselves", () => {
  const sec = (xs: ReturnType<typeof item>[]) => buildSections(xs);

  it("totals that disagree can never look trustworthy (below the 50% 'low' line)", () => {
    const xs = [item("Share Capital", 500), item("Term Loans", 500), item("Fixed Assets", 600), item("Cash", 400), item("Sundry Debtors", 300), item("Inventory", 200),
      item("Provision for Tax", 100), item("Reserves and Surplus", 100), item("Total Assets", 1500), item("Total Liabilities", 1000)];
    const r = scoreExtraction(xs, sec(xs), { structured: true });
    expect(r.confidence).toBeLessThan(0.5);
    expect(r.notes.join(" ")).toMatch(/do not agree/i);
  });

  it("totals that agree but lines that don't add up stay at or below 55%", () => {
    const junk = Array.from({ length: 30 }, (_, i) => item(i % 2 ? "Cash" : "Term Loans", 1000 + i));
    const r = scoreExtraction([...junk, item("Total Assets", 5), item("Total Liabilities", 5)], sec([...junk, item("Total Assets", 5), item("Total Liabilities", 5)]), { structured: true });
    expect(r.confidence).toBeLessThanOrEqual(0.55);
  });

  it("grammar of the short-file note", () => {
    const one = [item("Cash", 10)];
    expect(scoreExtraction(one, sec(one)).notes.join(" ")).toMatch(/Only 1 line item with amounts was found/);
  });
});

describe("workbook with the statement on a later sheet", () => {
  it("tells the user which sheets exist instead of just 'nothing read'", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Annual Report 2025"], ["Cover page"]]), "Cover");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Share Capital", 1000], ["Total Assets", 1000]]), "Balance Sheet");
    const data = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const parsed = await parseFile(new File([data], "report.xlsx"));
    expect(parsed.metadata?.notes).toMatch(/Only the first sheet \("Cover"\) was read/);
    expect(parsed.metadata?.notes).toMatch(/Balance Sheet/);
    expect(parsed.metadata?.confidence).toBeLessThanOrEqual(0.1);
  });
});
