// Real-world statement layouts found by the Phase 4 QA pass. Each case failed
// (silently wrong amounts, or a confident score on garbage) before the fix.
import { describe, it, expect } from "vitest";
import { parseAmount, parseStatementLines, buildSections, scoreExtraction, splitCsvLine, itemsFromRows } from "./statementParsing";
import parseFile from "./parsers";
import { mapToCalculator } from "./parsedToCalculatorMapper";

const item = (name: string, value: number) => ({ name, value });
const csv = (text: string, name = "bs.csv") => parseFile(new File([text], name, { type: "text/csv" }));

describe("Note / schedule columns are not amounts (D2)", () => {
  it.each([
    ["Reserves 3 350", item("Reserves", 350)],
    ["Share Capital (Refer Note 5) 200", item("Share Capital", 200)],
    ["Reserves | 3 | 350 | 300", item("Reserves", 350)],
    ["Term Loans | 4 | 1,200 | 900", item("Term Loans", 1200)],
  ])("%j", (line, expected) => expect(parseStatementLines(line)).toEqual([expected]));

  it("a genuinely small first amount with no note column is kept", () => {
    expect(parseStatementLines("Cash | 5")).toEqual([item("Cash", 5)]);
  });
});

describe("zero placeholders keep their column (D8)", () => {
  it("'-' or 'Nil' for the current year must not shift to the previous year's figure", () => {
    expect(parseStatementLines("Reserves | - | 300")).toEqual([item("Reserves", 0)]);
    expect(parseStatementLines("Reserves | Nil | 300")).toEqual([item("Reserves", 0)]);
    expect(parseStatementLines("Reserves - 300")).toEqual([item("Reserves", 0)]);
  });
});

describe("amount formats (D7, D10)", () => {
  it.each([
    ["Rs.3,50,000", 350000], ["Rs 3,50,000", 350000], ["INR 1,000", 1000], ["₹-50", -50], ["150-", -150], ["(1,234)", -1234], ["Nil", 0], ["-", 0],
  ])("%j -> %j", (input, expected) => expect(parseAmount(input)).toBe(expected));

  it("Dr/Cr suffixes and trailing minus are read, not dropped", () => {
    expect(parseStatementLines("Sundry Debtors 250 Dr")).toEqual([item("Sundry Debtors", 250)]);
    expect(parseStatementLines("Sundry Creditors 1,000 CR")).toEqual([item("Sundry Creditors", 1000)]);
    expect(parseStatementLines("Bank Overdraft 150-")).toEqual([item("Bank Overdraft", -150)]);
  });
});

describe("statement-date lines (D9)", () => {
  it("drops a pure header line but keeps a real line that mentions a date", () => {
    expect(parseStatementLines("Balance Sheet as at 31 March 2026")).toEqual([]);
    // The amount (not the year) is read; the label keeps its date words, which is harmless.
    expect(parseStatementLines("Reserves as at 31 March 2025 1,000").map((i) => i.value)).toEqual([1000]);
    expect(parseStatementLines("Cash Credit - March 2025 500").map((i) => i.value)).toEqual([500]);
  });
});

describe("CSV / spreadsheet layouts (D6, e)", () => {
  it("quoted Indian-grouped values stay one cell", () => {
    expect(splitCsvLine('"Share Capital","20,00,000",x')).toEqual(["Share Capital", "20,00,000", "x"]);
  });

  it("a year header picks the LATEST year column, whichever order the years are in", () => {
    const newestLast = itemsFromRows([["Particulars", "2023-24", "2024-25"], ["Term Loans", "400", "450"]]);
    expect(newestLast).toEqual([item("Term Loans", 450)]);
    const newestFirst = itemsFromRows([["Particulars", "2025-26", "2024-25"], ["Term Loans", "450", "400"]]);
    expect(newestFirst).toEqual([item("Term Loans", 450)]);
  });

  it("Particulars | Note | 2025-26 | 2024-25 gives the current year and a clean label", () => {
    const rows = [["Particulars", "Note", "2025-26", "2024-25"], ["Term Loans", "4", "400", "350"], ["Share Capital", "2", "1,000", "900"]];
    expect(itemsFromRows(rows)).toEqual([item("Term Loans", 400), item("Share Capital", 1000)]);
  });

  it("end to end: quoted Indian CSV is no longer all zeros", async () => {
    const parsed = await csv('Name,Amount\n"Share Capital","20,00,000"\n"Term Loans","8,00,000"\n"Fixed Assets","28,00,000"');
    expect(parsed.accounts!.map((a) => a.value)).toEqual([2000000, 800000, 2800000]);
  });

  it("end to end: a two-year CSV with a Note column maps the current year", async () => {
    const parsed = await csv(
      "Particulars,Note,2025-26,2024-25\nShare Capital,2,1000,900\nReserves and Surplus,3,500,400\nTerm Loans,4,800,700\nFixed Assets,5,1500,1300\nSundry Debtors,6,700,600\nCash,7,100,100\nTotal Assets,,2300,2000",
    );
    const m = mapToCalculator("debt-equity", parsed, "Private Limited Company");
    expect(m.inputs).toEqual({ totalDebt: 800, totalEquity: 1500 });
  });
});

describe("classification vocabulary (D11, D12)", () => {
  it.each([
    ["Debentures", "liabilities"], ["Bills Discounted", "liabilities"], ["Proposed Dividend", "liabilities"],
    ["Interest Accrued and Due", "liabilities"], ["Employee Benefit Obligations", "liabilities"],
    ["Securities Premium", "equity"], ["Partner Current Account", "equity"], ["Calls in Arrears", "equity"],
    ["Net Block", "assets"], ["Deferred Tax Asset", "assets"],
  ] as const)("%j -> %s", (name, section) => {
    expect(buildSections([item(name, 10)])[section].map((x) => x.name)).toEqual([name]);
  });

  it.each(["Total Shareholder's Funds", "Total Shareholders' Equity", "Total Shareholders Funds", "Tangible Net Worth", "Net Worth"])(
    "%j is read as the equity total, not a line",
    (name) => {
      const s = buildSections([item(name, 1500)]);
      expect(s.totals.totalEquity).toBe(1500);
      expect(s.equity).toEqual([]);
    },
  );
});

describe("score cannot be bought with two agreeing total rows (D3)", () => {
  const sec = (items: ReturnType<typeof item>[]) => buildSections(items);

  it("totals agree but the lines add up to nothing like them -> low, with an honest note", () => {
    const garbage = [item("Share Capital", 5), item("Cash", 3), item("Term Loans", 4), item("Total Assets", 1000), item("Total Liabilities", 1000)];
    const r = scoreExtraction(garbage, sec(garbage), { structured: true });
    expect(r.confidence).toBeLessThan(0.6);
    expect(r.notes.join(" ")).toMatch(/do not add up to them/i);
  });

  it("the same totals with matching lines score high", () => {
    const real = [item("Share Capital", 500), item("Term Loans", 500), item("Fixed Assets", 600), item("Cash", 400), item("Total Assets", 1000), item("Total Liabilities", 1000)];
    const r = scoreExtraction(real, sec(real), { structured: true });
    expect(r.notes.join(" ")).toMatch(/add up to them/i);
    expect(r.confidence).toBeGreaterThan(0.6);
  });

  it("D13: an Indian 'Total Liabilities' that includes equity (= total assets) is not flagged as a mismatch", () => {
    const indian = [
      item("Share Capital", 1000), item("Reserves and Surplus", 500), item("Term Loans", 800), item("Sundry Creditors", 500),
      item("Fixed Assets", 1800), item("Sundry Debtors", 700), item("Cash", 300),
      item("Total Assets", 2800), item("Total Liabilities", 2800), item("Net Worth", 1500),
    ];
    const r = scoreExtraction(indian, sec(indian), { structured: true });
    expect(r.notes.join(" ")).not.toMatch(/do not agree/i);
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it("unrecognised lines lower the score and are reported", () => {
    const odd = [item("Widgets A", 10), item("Widgets B", 20), item("Widgets C", 30), item("Cash", 5), item("Share Capital", 5), item("Term Loans", 5)];
    const r = scoreExtraction(odd, sec(odd));
    expect(r.notes.join(" ")).toMatch(/could not be classified/i);
    expect(r.confidence).toBeLessThan(0.6);
  });
});

describe("mapper: Indian financing vocabulary (D5, D13)", () => {
  const parse = (lines: string[]) => csv(["Name,Amount", ...lines].join("\n"));

  it("cash credit and bills discounted count as debt, not as nothing", async () => {
    const parsed = await parse(["Share Capital,550", "Term Loans,400", "Cash Credit,300", "Bills Discounted,50", "Fixed Assets,1300"]);
    expect(mapToCalculator("debt-equity", parsed, "Private Limited Company").inputs).toEqual({ totalDebt: 750, totalEquity: 550 });
  });

  it("current ratio: loans & advances are current assets; cash credit and provisions are current liabilities", async () => {
    const parsed = await parse(["Sundry Debtors,400", "Loans and Advances,40", "Cash,160", "Sundry Creditors,250", "Cash Credit,300", "Provision for Tax,50", "Share Capital,550"]);
    expect(mapToCalculator("current-ratio", parsed, "Private Limited Company").inputs).toEqual({ currentAssets: 600, currentLiabilities: 600 });
  });

  it("no debt line + Indian totals: debt = total liabilities minus equity, not the whole 'total liabilities'", async () => {
    const parsed = await parse(["Share Capital,1500", "Sundry Creditors,1300", "Fixed Assets,2800", "Total Assets,2800", "Total Liabilities,2800", "Net Worth,1500"]);
    expect(mapToCalculator("debt-equity", parsed, "Private Limited Company").inputs).toEqual({ totalDebt: 1300, totalEquity: 1500 });
  });
});
