import { describe, it, expect } from "vitest";
import {
  parseAmount, pdfItemsToRows, parseStatementLines, buildSections, scoreExtraction,
} from "./statementParsing";
import parseFile from "./parsers";
import { mapToCalculator } from "./parsedToCalculatorMapper";

const item = (name: string, value: number) => ({ name, value });

describe("parseAmount", () => {
  it.each([
    ["1,000", 1000], ["12,34,567", 1234567], ["(1,234)", -1234], ["-50", -50], ["₹ 2,500.75", 2500.75], ["", 0], ["abc", 0],
  ])("%j -> %j", (input, expected) => expect(parseAmount(input)).toBe(expected));
});

describe("pdfItemsToRows", () => {
  it("groups items on one baseline into a row, left to right, rows top to bottom", () => {
    const rows = pdfItemsToRows([
      { str: "1,000", transform: [1, 0, 0, 1, 300, 700] },
      { str: "Share Capital", transform: [1, 0, 0, 1, 20, 701] }, // same visual row (within the 4pt bucket)
      { str: "Total Assets", transform: [1, 0, 0, 1, 20, 600] },
      { str: "2,600", transform: [1, 0, 0, 1, 300, 600] },
      { str: "  ", transform: [1, 0, 0, 1, 0, 500] },
    ]);
    expect(rows).toEqual(["Share Capital | 1,000", "Total Assets | 2,600"]);
  });
});

describe("parseStatementLines", () => {
  it("reads pipe-separated PDF rows, taking the first (current-year) amount", () => {
    expect(parseStatementLines("Share Capital | 1,000 | 900\nSundry Creditors | (300) | 250")).toEqual([
      item("Share Capital", 1000), item("Sundry Creditors", -300),
    ]);
  });

  it("reads plain 'label  amount' lines and Indian grouping", () => {
    expect(parseStatementLines("Fixed Assets 12,34,567\nInventory   400")).toEqual([
      item("Fixed Assets", 1234567), item("Inventory", 400),
    ]);
  });

  it("skips headers, page markers, year lines and statement-date lines", () => {
    const out = parseStatementLines("--- PAGE 1 ---\nParticulars | 2025-26 | 2024-25\n2025 2024\nBalance Sheet as at 31 March 2026\nCash 50");
    expect(out).toEqual([item("Cash", 50)]);
  });

  it("ignores lines with no number or no real label", () => {
    expect(parseStatementLines("Notes to accounts\n| 1,000\n12 34")).toEqual([]);
  });
});

describe("buildSections", () => {
  const items = [
    item("Share Capital", 1000), item("Reserves and Surplus", 500),
    item("Term Loans", 800), item("Sundry Creditors", 300),
    item("Fixed Assets", 1500), item("Sundry Debtors", 700), item("Inventory", 400), item("Cash and Bank", 200),
    item("Total Assets", 2800), item("Total Liabilities", 2800),
  ];

  it("places a plural 'Term Loans' in liabilities (it used to fall through to assets)", () => {
    const s = buildSections(items);
    expect(s.liabilities.map((x) => x.name)).toContain("Term Loans");
    expect(s.assets.map((x) => x.name)).not.toContain("Term Loans");
  });

  it("uses {name, amount} so the mapper can read the values (was {name, value})", () => {
    const s = buildSections(items);
    expect(s.liabilities[0]).toEqual({ name: "Term Loans", amount: 800 });
  });

  it("pulls explicit totals out of the sections instead of double counting them", () => {
    const s = buildSections(items);
    expect(s.totals).toEqual({ totalAssets: 2800, totalLiabilities: 2800 });
    expect([...s.assets, ...s.liabilities, ...s.equity].some((x) => /^total/i.test(x.name!))).toBe(false);
  });

  it("drops subtotals and keeps unknown lines out of the sections", () => {
    const s = buildSections([item("Sub Total", 99), item("Total Current Assets", 1300), item("Miscellaneous widgets", 5)]);
    expect(s.assets).toEqual([]);
    expect(s.unclassified).toEqual([item("Miscellaneous widgets", 5)]);
  });

  it.each([
    ["Loans and Advances", "assets"], ["Capital Work in Progress", "assets"], ["Security Deposits", "assets"],
    ["Advance from Customers", "liabilities"], ["Provision for Tax", "liabilities"], ["Bank Overdraft", "liabilities"],
    ["Unsecured Loans", "liabilities"], ["Share Capital", "equity"], ["Net Worth", "equity"],
  ] as const)("classifies %j as %s", (name, section) => {
    const s = buildSections([item(name, 10)]);
    if (name === "Net Worth") expect(s.totals.totalEquity).toBe(10); // an explicit total, not a line
    else expect(s[section].map((x) => x.name)).toEqual([name]);
  });
});

describe("scoreExtraction", () => {
  const good = [
    item("Share Capital", 1000), item("Reserves and Surplus", 500), item("Term Loans", 800), item("Sundry Creditors", 300),
    item("Fixed Assets", 1500), item("Sundry Debtors", 700), item("Inventory", 400), item("Cash", 200),
    item("Provision for Tax", 100), item("Bank Overdraft", 100), item("Investments", 100), item("Goodwill", 50),
    item("Total Assets", 2950), item("Total Liabilities", 2950),
  ];

  it("a full balance sheet whose totals agree scores high, and says so", () => {
    const sections = buildSections(good);
    const r = scoreExtraction(good, sections, { structured: true });
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
    expect(r.notes.join(" ")).toMatch(/agree/i);
  });

  it("totals that disagree score much lower and warn", () => {
    const bad = good.map((i) => (i.name === "Total Liabilities" ? item(i.name, 9999) : i));
    const r = scoreExtraction(bad, buildSections(bad), { structured: true });
    expect(r.confidence).toBeLessThanOrEqual(0.7); // vs ~0.95 when they agree
    expect(r.notes.join(" ")).toMatch(/do not agree/i);
  });

  it("no usable lines is near zero with a clear note", () => {
    const r = scoreExtraction([], buildSections([]));
    expect(r.confidence).toBe(0.05);
    expect(r.notes[0]).toMatch(/no line items/i);
  });

  it("a handful of lines with nothing to cross-check stays modest", () => {
    const few = [item("Cash", 10), item("Share Capital", 10), item("Loans", 5)];
    const r = scoreExtraction(few, buildSections(few));
    expect(r.confidence).toBeLessThan(0.6);
    expect(r.notes.join(" ")).toMatch(/only 3 line items/i);
  });

  it("without explicit totals, items that add up still earn credit", () => {
    const noTotals = good.filter((i) => !/^total/i.test(i.name));
    const r = scoreExtraction(noTotals, buildSections(noTotals), { structured: true });
    expect(r.notes.join(" ")).toMatch(/add up|unverified/i);
  });

  it("is never above 0.95 and never below 0", () => {
    const r = scoreExtraction(good, buildSections(good), { structured: true });
    expect(r.confidence).toBeLessThanOrEqual(0.95);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
  });
});

describe("file -> parse -> calculator inputs (the path that used to yield all zeros)", () => {
  const csv = [
    "Name,Amount",
    "Share Capital,1000", "Reserves and Surplus,500", "Term Loans,800", "Sundry Creditors,300",
    "Fixed Assets,1500", "Sundry Debtors,700", "Inventory,400", "Cash,200",
    "Total Assets,2800", "Total Liabilities,2800",
  ].join("\n");

  it("debt-to-equity gets real inputs from a CSV", async () => {
    const parsed = await parseFile(new File([csv], "bs.csv", { type: "text/csv" }));
    const m = mapToCalculator("debt-equity", parsed, "Private Limited Company");
    expect(m.inputs).toEqual({ totalDebt: 800, totalEquity: 1500 });
    expect(m.confidence).toBeGreaterThan(0.5);
  });

  it("current ratio finds debtors, stock, cash and creditors", async () => {
    const parsed = await parseFile(new File([csv], "bs.csv", { type: "text/csv" }));
    const m = mapToCalculator("current-ratio", parsed, "Private Limited Company");
    expect(m.inputs).toEqual({ currentAssets: 700 + 400 + 200, currentLiabilities: 300 });
  });

  it("the parsed file carries a confidence built from checks, not a constant 0.6", async () => {
    const parsed = await parseFile(new File([csv], "bs.csv", { type: "text/csv" }));
    expect(parsed.metadata?.confidence).not.toBe(0.6);
    expect(parsed.metadata?.confidence).toBeGreaterThan(0.6);
    expect(parsed.metadata?.notes).toMatch(/agree/i);
    expect(parsed.balanceSheet.totals).toEqual({ totalAssets: 2800, totalLiabilities: 2800 });
  });

  it("a text statement (label  amount lines) parses too", async () => {
    const txt = "Share Capital 1,000\nTerm Loans 800\nFixed Assets 1,800\nSundry Creditors 0\nTotal Assets 1,800\nTotal Liabilities 1,800";
    const parsed = await parseFile(new File([txt], "bs.txt", { type: "text/plain" }));
    const m = mapToCalculator("debt-equity", parsed, "Private Limited Company");
    expect(m.inputs).toEqual({ totalDebt: 800, totalEquity: 1000 });
  });

  it("an unreadable file reports why instead of a made-up confidence", async () => {
    const parsed = await parseFile(new File(["nothing useful here"], "x.csv", { type: "text/csv" }));
    expect(parsed.metadata?.confidence).toBeLessThanOrEqual(0.1);
    expect(parsed.metadata?.notes).toMatch(/no line items|could not/i);
  });
});
