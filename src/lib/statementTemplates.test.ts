// Different firms, different templates: the same figures must come out whichever
// way the statement is laid out or worded.
import { describe, it, expect } from "vitest";
import { htmlToRows } from "./docxText";
import { statementBases } from "./statementParsing";
import { principalRepayments, itemsFromRows, pdfItemsToRows, statementRegion, statementUnit, parseStatementLines, buildSections, buildIncomeStatement, isCurrentAsset, isCurrentLiability } from "./statementParsing";
import mapToCalculator from "./parsedToCalculatorMapper";
import type ParsedBalanceSheet from "./parsedBalanceSheet";

function parse(text: string): ParsedBalanceSheet {
  const s = buildSections(parseStatementLines(text));
  return {
    originalFormat: "pdf", parsedAt: "",
    balanceSheet: { assets: s.assets, liabilities: s.liabilities, equity: s.equity, totals: s.totals },
    incomeStatement: buildIncomeStatement(s.income),
  };
}

// Schedule III: headings, a Note column, two years.
const SCHEDULE_III = `
Balance Sheet as at 31 March 2025
Particulars | Note | 2025 | 2024
EQUITY AND LIABILITIES
Shareholders' funds
Share Capital | 1 | 10,00,000 | 10,00,000
Reserves and Surplus | 2 | 5,00,000 | 4,00,000
Non-current liabilities
Long-term borrowings | 3 | 20,00,000 | 25,00,000
Current liabilities
Short-term borrowings | 4 | 8,00,000 | 6,00,000
Trade payables | 5 | 4,00,000 | 3,00,000
Other current liabilities | 6 | 1,00,000 | 1,00,000
Total Equity and Liabilities | | 48,00,000 | 49,00,000
ASSETS
Non-current assets
Property, plant and equipment | 7 | 25,00,000 | 27,00,000
Long-term loans and advances | 8 | 1,00,000 | 1,00,000
Current assets
Inventories | 9 | 10,00,000 | 9,00,000
Trade receivables | 10 | 8,00,000 | 7,00,000
Cash and cash equivalents | 11 | 4,00,000 | 5,00,000
Total Assets | | 48,00,000 | 49,00,000
`;

// Tally / Indian T-format: liabilities on the left, assets on the right, one row each.
const T_FORMAT = `
Liabilities | Amount | Assets | Amount
Capital Account | 10,00,000 | Land & Building | 20,00,000
Reserves & Surplus | 5,00,000 | Plant & Machinery | 5,00,000
Term Loan from SBI | 20,00,000 | Closing Stock | 10,00,000
Bank OD A/c | 8,00,000 | Sundry Debtors | 8,00,000
Sundry Creditors | 4,00,000 | Cash in Hand | 1,00,000
Outstanding Expenses | 1,00,000 | Balance with Bank | 3,00,000
Total | 48,00,000 | Total | 47,00,000
`;

describe("Schedule III layout", () => {
  const p = parse(SCHEDULE_III);
  it("uses the section headings, not just the words", () => {
    const cur = mapToCalculator("current-ratio", p);
    // current assets 10+8+4 = 22L, current liabilities 8+4+1 = 13L (long-term loans & advances excluded)
    expect(cur.inputs).toEqual({ currentAssets: 2200000, currentLiabilities: 1300000 });
  });
  it("debt is borrowings only (long-term + short-term), equity is capital + reserves", () => {
    expect(mapToCalculator("debt-equity", p).inputs).toEqual({ totalDebt: 2800000, totalEquity: 1500000 });
  });
});

describe("side-by-side (T-format) layout", () => {
  const p = parse(T_FORMAT);
  it("reads both sides of each row", () => {
    expect(p.balanceSheet.assets.map((a) => a.name)).toEqual(
      expect.arrayContaining(["Land & Building", "Closing Stock", "Sundry Debtors", "Cash in Hand", "Balance with Bank"]));
    expect(p.balanceSheet.liabilities.map((a) => a.name)).toEqual(
      expect.arrayContaining(["Term Loan from SBI", "Bank OD A/c", "Sundry Creditors"]));
    expect(p.balanceSheet.equity.map((a) => a.name)).toEqual(["Capital Account", "Reserves & Surplus"]);
  });
  it("Bank OD counts as debt and as a current liability, not as an asset", () => {
    expect(mapToCalculator("debt-equity", p).inputs).toEqual({ totalDebt: 2800000, totalEquity: 1500000 });
    expect(mapToCalculator("current-ratio", p).inputs).toEqual({ currentAssets: 2200000, currentLiabilities: 1300000 });
  });
  it("drawing power finds stock, debtors and creditors without a receivables list", () => {
    expect(mapToCalculator("drawing-power", p).inputs).toEqual({ eligibleStock: 1000000, eligibleReceivables: 800000, creditors: 400000 });
  });
});

describe("profit and loss lines", () => {
  const text = `
Revenue from operations 1,20,00,000
Other Income 2,00,000
Cost of materials consumed 80,00,000
Depreciation and amortisation 5,00,000
Finance Costs 4,00,000
Profit before tax 12,00,000
Tax expense 3,00,000
Profit after tax 9,00,000
Term Loan 20,00,000
Share Capital 10,00,000
Closing Stock 10,00,000
`;
  const p = parse(text);
  it("interest and expenses stay out of the balance sheet", () => {
    expect(p.balanceSheet.liabilities.map((l) => l.name)).toEqual(["Term Loan"]);
    expect(p.balanceSheet.equity.map((l) => l.name)).toEqual(["Share Capital"]);
  });
  it("feeds EBITDA, ISCR and DSCR instead of zeros", () => {
    expect(p.incomeStatement).toMatchObject({ revenue: 12000000, depreciation: 500000, interestExpense: 400000, "profit before tax": 1200000, ebit: 1600000 });
    expect(mapToCalculator("ebitda", p).inputs).toEqual({ profit: 1200000, depreciation: 500000, financeCost: 400000, sales: 12000000 });
    expect(mapToCalculator("iscr", p).inputs).toEqual({ ebit: 1600000, interestExpense: 400000 });
    expect(mapToCalculator("dscr", p).inputs).toEqual({ netOperatingIncome: 2100000, totalDebtService: 400000 });
  });
});

describe("naming variants", () => {
  it.each([
    ["Sundry Debtors", true], ["Trade Receivables", true], ["Stock-in-trade", true], ["Closing Stock", true], ["Cash & Bank Balances", true],
    ["Loans and Advances", true], ["Prepaid Expenses", true], ["Fixed Deposit with Bank", true],
    ["Long-term Loans and Advances", false], ["Capital Work-in-progress", false], ["Net Block", false], ["Investments", false],
  ])("current asset? %j -> %s", (name, expected) => {
    expect(isCurrentAsset({ name, amount: 1 })).toBe(expected);
  });
  it.each([
    ["Sundry Creditors", true], ["Trade Payables", true], ["Bank OD", true], ["Cash Credit", true], ["Provision for Taxation", true],
    ["Outstanding Expenses", true], ["Current Maturities of Long-term Debt", true], ["Statutory Dues", true],
    ["Term Loan", false], ["Long-term Provisions", false], ["Non-current Liabilities", false], ["Unsecured Loan from Directors", false],
  ])("current liability? %j -> %s", (name, expected) => {
    expect(isCurrentLiability({ name, amount: 1 })).toBe(expected);
  });
  it("a printed 'Current Assets' subtotal is not counted next to its own lines", () => {
    const s = buildSections(parseStatementLines("Closing Stock 100\nSundry Debtors 200\nCurrent Assets 300"));
    expect(s.assets.map((a) => a.name)).toEqual(["Closing Stock", "Sundry Debtors"]);
  });
});

describe("a full report: only the statements are read", () => {
  const report = [
    "Independent Auditor's Report",
    "We have audited the Balance Sheet; trade receivables 9,99,999 were confirmed",
    "Balance Sheet as at 31st March, 2024",
    "(Rs. in thousands)",
    "Particulars | Notes | As at | As at",
    "ASSETS",
    "Current Assets",
    "Cash and Cash Equivalents | 1 | 37 | 76",
    "Total Assets | 37 | 76",
    "EQUITY AND LIABILITIES",
    "Equity",
    "Equity Share Capital | 2 | 300 | 300",
    "Other Equity | 3 | (336) | (259)",
    "Total Equity | (36) | 41",
    "Current Liabilities",
    "Other Current liabilities | 4 | 73 | 35",
    "Total Liabilities | 73 | 35",
    "Total Equity and Liabilities | 37 | 76",
    "Director",
    "DIN: 07847098",
    "Date: April 12, 2024",
    "Statement of Cash Flows",
    "(Increase) in trade receivables | (500) | 20",
  ].join("\n");

  it("drops the auditor's letter and cash flow, keeps the statements", () => {
    const s = buildSections(parseStatementLines(statementRegion(report)));
    expect(s.assets).toEqual([{ name: "Cash and Cash Equivalents", amount: 37, group: "current-asset" }]);
    expect(s.equity.map((e) => e.amount)).toEqual([300, -336]);
    expect(s.unclassified).toEqual([]);
  });
  it("'Total Equity and Liabilities' is the tie-out, not the plain 'Total Liabilities'", () => {
    expect(buildSections(parseStatementLines(statementRegion(report))).totals).toEqual({ totalAssets: 37, totalLiabilities: 37, totalEquity: -36 });
  });
  it("reports the unit", () => {
    expect(statementUnit(report)).toBe("thousands");
  });
  it("text with no statement heading is left alone", () => {
    expect(statementRegion("Cash 10\nCreditors 5")).toBe("Cash 10\nCreditors 5");
  });
});

describe("consolidated report headings", () => {
  const report = [
    "We have audited the Consolidated Balance Sheet as at 31 | March, 2026 and the",
    "Consolidated Balance Sheet",
    "Particulars | Notes | As at 31 March 2026",
    "ASSETS",
    "Non-Current Assets",
    "Property, Plant and Equipment | 1 | 500",
    "Current Assets",
    "Inventories | 2 | 100",
    "Total Assets | 600",
    "Consolidated Statement of Profit and Loss",
    "Revenue from Operations | 300",
    "Consolidated Statement of Changes in Equity",
    "Cash Flow Hedge Reserve | 121 | 72",
    "Consolidated | Statement of Cash Flows",
    "Net Cash flow from Operating Activities (A) | 77",
  ].join("\n");
  it("starts at the real heading, not the auditor's sentence, and stops at changes in equity", () => {
    const s = buildSections(parseStatementLines(statementRegion(report)));
    expect(s.assets.map((a) => a.amount)).toEqual([500, 100]);
    expect(s.income.map((a) => a.name)).toEqual(["Revenue from Operations"]);
    expect(s.equity).toEqual([]);
  });
});

describe("two pages printed on one sheet (spread)", () => {
  // pdf.js-style items: one sheet, balance sheet on the left, P&L on the right, same baselines.
  const item = (str: string, x: number, y: number, width = 60) => ({ str, transform: [1, 0, 0, 1, x, y], width });
  const left = ["Share capital", "Reserves", "Borrowings", "Trade payables", "Provisions", "Inventories", "Debtors", "Cash", "Advances"];
  const right = ["Revenue", "Other income", "Purchases", "Employee cost", "Finance costs", "Depreciation", "Other expenses", "Tax", "Profit"];
  const spread = left.flatMap((l, i) => [item(l, 50, 800 - i * 20), item("1,000", 350, 800 - i * 20, 40), item(right[i], 640, 800 - i * 20), item("2,000", 950, 800 - i * 20, 40)]);

  it("reads each side on its own instead of gluing left and right lines together", () => {
    const rows = pdfItemsToRows(spread);
    expect(rows).toHaveLength(18);
    expect(rows[0]).toBe("Share capital | 1,000");
    expect(rows[9]).toBe("Revenue | 2,000");
  });
  it("a plain label | amount table with a wide gap is NOT split", () => {
    const table = left.flatMap((l, i) => [item(l, 50, 800 - i * 20), item("1,000", 900, 800 - i * 20, 40)]);
    expect(pdfItemsToRows(table)[0]).toBe("Share capital | 1,000");
    expect(pdfItemsToRows(table)).toHaveLength(9);
  });
  it("a bare 'Total' closes the side the heading above names", () => {
    const s = buildSections(parseStatementLines("Equity and liabilities\nCurrent liabilities\nTrade payables | 400\nTotal | 1,000\nAssets\nCurrent assets\nCash | 1,000\nTotal | 1,000"));
    expect(s.totals).toEqual({ totalLiabilities: 1000, totalAssets: 1000 });
  });
  it("reads the '₹ lakh' unit style", () => {
    expect(statementUnit("Standalone balance sheet ₹ lakh unless stated")).toBe("lakh");
  });
});

describe("CA-prepared proprietorship / small-company layouts", () => {
  const sections = (text: string) => buildSections(parseStatementLines(text));

  it("a subtotal column does not pull the page split into the wrong gap", () => {
    // left page: label + item column (x 170-210) + subtotal column (x 236-286); right page starts at 296.
    const it2 = (str: string, x: number, y: number, width: number) => ({ str, transform: [1, 0, 0, 1, x, y], width });
    const items = [it2("Statement of the firm centred title across the sheet", 100, 900, 420)];
    for (let i = 0; i < 12; i++) {
      const y = 800 - i * 20;
      items.push(it2("Left item " + i, 20, y, 120), it2("1,000.00", 170, y, 40), it2("5,000.00", 236, y, 50));
      items.push(it2("Right item " + i, 296, y, 100), it2("2,000.00", 480, y, 40));
    }
    const rows = pdfItemsToRows(items);
    expect(rows).toContain("Left item 0 | 1,000.00 | 5,000.00");
    expect(rows).toContain("Right item 0 | 2,000.00");
  });

  it("'Less:' subtracts, 'Add:' adds, list markers and To,/By, prefixes are dropped", () => {
    const s = sections("Fixed Assets\nVehicle 1000\nLess: Depreciation 300\nAdd: Addition 50");
    expect(s.assets.map((a) => [a.name, a.amount])).toEqual([["Vehicle", 1000], ["Depreciation", -300], ["Addition", 50]]);
    expect(sections("(a) Share Capital 10").equity.map((a) => a.name)).toEqual(["Share Capital"]);
    expect(sections("Expenses\nTo, Salary 99\nTo, Depreciation 5").income.map((i) => i.name)).toEqual(["Salary", "Depreciation"]);
  });

  it("'(B) Total outstanding dues of creditors' is a payables line, not a total", () => {
    const s = sections("(3) Current Liabilities\n(B) Total outstanding dues of creditors other than | 7 | 784.02 | 181.40");
    expect(s.liabilities.map((l) => [l.name, l.amount])).toEqual([["Total outstanding dues of creditors other than", 784.02]]);
  });

  it("Bank OD is a current liability even under 'Secured Loans'; lenders under 'Unsecured Loans' are debt", () => {
    const s = sections("SECURED LOANS\nPNB OD A/c 200\nUNSECURED LOANS\nBajaj Finance 100\nAxis Bank P/L 50\nCURRENT LIABILITIES & PROVISIONS\nSundry Creditors 30");
    expect(isCurrentLiability(s.liabilities[0])).toBe(true);
    const parsed: ParsedBalanceSheet = { originalFormat: "pdf", parsedAt: "", balanceSheet: { assets: [], liabilities: s.liabilities, equity: [{ name: "Capital", amount: 100 }] } };
    expect(mapToCalculator("debt-equity", parsed).inputs).toEqual({ totalDebt: 350, totalEquity: 100 });
  });

  it("ratios printed in the notes are not balance-sheet lines", () => {
    expect(sections("Return on Capital employed 784.09\nReturn on investment 12").unclassified).toEqual([]);
    expect(sections("Return on Capital employed 784.09").equity).toEqual([]);
  });

  it("a proprietorship trading account feeds the income statement; net profit stands in for PBT", () => {
    const s = sections("TRADING AND PROFIT & LOSS ACCOUNT FOR THE PERIOD FROM 01.04.2024 TO 31.03.2025\nTo,Opening Stock 250\nBy, Sales 4000\nTo, Interest on Loan 90\nTo, Depreciation 14\nTo, Net Profit Tfd to Proprietor Capital Account 160");
    expect(s.assets).toEqual([]);
    expect(buildIncomeStatement(s.income)).toMatchObject({ revenue: 4000, interestExpense: 90, depreciation: 14, "net profit": 160, "profit before tax": 160, ebit: 250 });
  });
});

describe("finishing touches", () => {
  const sections = (text: string) => buildSections(parseStatementLines(text));

  it("a result line whose label sits on the row after its figures is still read", () => {
    const items = parseStatementLines("Total Expenses | 77 | 71\n(77) | (71)\nLoss for the year\nOther Comprehensive Income | - | -");
    expect(items.find((i) => /loss for the year/i.test(i.name))).toMatchObject({ value: -77 });
  });
  it("...but a bare subtotal before a section heading is not turned into a line", () => {
    const items = parseStatementLines("Vehicle | 100\n62,10,013.80\nSECURED LOANS\nBank OD | 50");
    expect(items.map((i) => i.name)).toEqual(["Vehicle", "Bank OD"]);
  });

  it("'Total tax' is the tax figure, not just current tax", () => {
    const s = sections("Statement of Profit and Loss for the year\nIncome\nCurrent Tax 607.32\nDeferred Tax 10.76\nTotal tax 618.08\nProfit before tax 1929");
    expect(buildIncomeStatement(s.income)).toMatchObject({ tax: 618.08 });
  });

  it("lease liabilities and deferred payments (spectrum dues) count as debt", () => {
    const p: ParsedBalanceSheet = {
      originalFormat: "pdf", parsedAt: "",
      balanceSheet: {
        assets: [],
        liabilities: [{ name: "Borrowings", amount: 100 }, { name: "Lease Liabilities", amount: 20 }, { name: "Deferred Payment Liabilities", amount: 50 }, { name: "Trade Payables", amount: 30 }],
        equity: [{ name: "Share Capital", amount: 100 }],
      },
    };
    expect(mapToCalculator("debt-equity", p).inputs).toEqual({ totalDebt: 170, totalEquity: 100 });
  });
});

describe("Excel / CSV side-by-side sheets", () => {
  const rows = [
    ["LIABILITIES", "", "", "ASSETS", "", ""],
    ["Capital Account", "10,00,000", "", "Closing Stock", "10,00,000", ""],
    ["Reserves", "5,00,000", "", "Sundry Debtors", "8,00,000", ""],
    ["Bank OD A/c", "8,00,000", "", "Cash in Hand", "1,00,000", ""],
    ["Sundry Creditors", "4,00,000", "", "Balance with Bank", "3,00,000", ""],
    ["Term Loan", "20,00,000", "", "Plant & Machinery", "10,00,000", ""],
    ["Outstanding Expenses", "1,00,000", "", "Furniture", "2,00,000", ""],
    ["Provision for Tax", "1,00,000", "", "Vehicle", "3,00,000", ""],
  ];
  it("reads the left block as one statement and the right block as another", () => {
    const s = buildSections(itemsFromRows(rows));
    expect(s.assets.map((a) => a.name)).toEqual(["Closing Stock", "Sundry Debtors", "Cash in Hand", "Balance with Bank", "Plant & Machinery", "Furniture", "Vehicle"]);
    expect(s.liabilities.map((a) => a.name)).toEqual(["Bank OD A/c", "Sundry Creditors", "Term Loan", "Outstanding Expenses", "Provision for Tax"]);
    expect(s.equity.map((a) => a.name)).toEqual(["Capital Account", "Reserves"]);
  });
  it("a normal Particulars | Note | 2025 | 2024 sheet is not split", () => {
    const plain = [["Particulars", "Note", "2025", "2024"], ...Array.from({ length: 10 }, (_, i) => [`Item number ${i}`, "1", "1,000", "900"])];
    expect(itemsFromRows(plain)).toHaveLength(10);
  });
});

describe("a real .xlsx through parseFile", () => {
  it("reads a side-by-side workbook and maps debt, equity and current ratio", async () => {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.aoa_to_sheet([
      ["BALANCE SHEET AS ON 31.03.2025", "", "", "", ""],
      ["LIABILITIES", "AMOUNT", "ASSETS", "AMOUNT", ""],
      ["Capital Account", 1000000, "Closing Stock", 1000000, ""],
      ["Reserves", 500000, "Sundry Debtors", 800000, ""],
      ["Bank OD A/c", 800000, "Cash in Hand", 100000, ""],
      ["Sundry Creditors", 400000, "Balance with Bank", 300000, ""],
      ["Term Loan", 2000000, "Plant & Machinery", 1000000, ""],
      ["Outstanding Expenses", 100000, "Furniture", 200000, ""],
      ["Provision for Tax", 100000, "Vehicle", 300000, ""],
      ["Unsecured Loan", 200000, "Computers", 100000, ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "BS");
    const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const { default: parseFile } = await import("./parsers");
    const parsed = await parseFile(new File([bytes], "firm.xlsx"));
    expect(mapToCalculator("debt-equity", parsed, "Proprietorship").inputs).toEqual({ totalDebt: 3000000, totalEquity: 1500000 });
    expect(mapToCalculator("current-ratio", parsed, "Proprietorship").inputs).toEqual({ currentAssets: 2200000, currentLiabilities: 1400000 });
  });
});

describe("principal repayments for a real DSCR", () => {
  const report = [
    "Balance Sheet as at 31st March, 2025", "Particulars | 2025", "Assets", "Cash | 100", "Total Assets | 100",
    "Statement of Cash Flows",
    "A | Cash Flow From Operating Activities:", "Profit Before Tax | 40",
    "Cash Flow From Financing Activities:",
    "Proceeds from Borrowings | 10,054 | 5,000",
    "Repayment of Borrowings - Non-current (including Current Maturities) | (8,465) | (7,000)",
    "Payment of Lease Liabilities | (6,064) | (5,500)",
    "Payment of Deferred Payment Liabilities | (4,736) | (4,000)",
    "Interest Paid on Borrowings | (2,000) | (1,900)",
    "Net Increase in Cash and Cash Equivalents | 8,546",
    "Repayment of Borrowings | (999) | (1)", // after the statement ended: ignored
  ].join("\n");

  it("sums borrowings, lease and deferred-payment repayments in the cash flow statement, not interest", () => {
    expect(principalRepayments(report)).toBe(8465 + 6064 + 4736);
  });
  it("is undefined when there is no cash flow statement", () => {
    expect(principalRepayments("Balance Sheet as at 31st March\nRepayment of Borrowings 100")).toBeUndefined();
  });
  it("DSCR then uses interest + principal as debt service, and says where the principal came from", () => {
    const p: ParsedBalanceSheet = {
      originalFormat: "pdf", parsedAt: "", balanceSheet: { assets: [], liabilities: [], equity: [] },
      incomeStatement: { ebit: 900, depreciation: 100, interestExpense: 200, principalRepayment: 300 },
    };
    const m = mapToCalculator("dscr", p);
    expect(m.inputs).toEqual({ netOperatingIncome: 1000, totalDebtService: 500 });
    expect(m.notes).toMatch(/cash flow statement/);
  });
});

describe("Word side-by-side tables", () => {
  it("a two-block table keeps the left statement and the right statement apart", () => {
    const cell = (v: string) => `<td>${v}</td>`;
    const row = (cs: string[]) => `<tr>${cs.map(cell).join("")}</tr>`;
    const html = `<table>${[
      row(["LIABILITIES", "AMOUNT", "", "ASSETS", "AMOUNT"]),
      ...["Capital|10,00,000|Closing Stock|10,00,000", "Reserves|5,00,000|Sundry Debtors|8,00,000", "Bank OD A/c|8,00,000|Cash in Hand|1,00,000",
        "Sundry Creditors|4,00,000|Balance with Bank|3,00,000", "Term Loan|20,00,000|Plant & Machinery|10,00,000", "Outstanding Expenses|1,00,000|Furniture|2,00,000",
        "Provision for Tax|1,00,000|Vehicle|3,00,000"].map((r) => { const [a, b, c, d] = r.split("|"); return row([a, b, "", c, d]); }),
    ].join("")}</table>`;
    const s = buildSections(parseStatementLines(htmlToRows(html)));
    expect(s.assets.map((a) => a.name)).toContain("Closing Stock");
    expect(s.assets.map((a) => a.name)).not.toContain("Bank OD A/c");
    expect(s.liabilities.map((a) => a.name)).toEqual(["Bank OD A/c", "Sundry Creditors", "Term Loan", "Outstanding Expenses", "Provision for Tax"]);
    expect(s.equity.map((a) => a.name)).toEqual(["Capital", "Reserves"]);
  });
});

describe("consolidated and standalone statements in one report", () => {
  const block = (basis: string, cash: number) => [
    `${basis} Balance Sheet as at 31st March, 2025`, "Particulars | Note | 2025 | 2024", "ASSETS", "Current Assets",
    `Cash and Cash Equivalents | 1 | ${cash} | 50`, `Total Assets | ${cash} | 50`, "Statement of Cash Flows", "Net Increase in Cash | 1",
  ].join("\n");
  const both = `${block("Standalone", 100)}\n${block("Consolidated", 900)}`;

  it("lists which sets the document has, in order", () => {
    expect(statementBases(both)).toEqual(["standalone", "consolidated"]);
    expect(statementBases(block("Consolidated", 900))).toEqual(["consolidated"]);
    expect(statementBases("Cash 10\nDebtors 20")).toEqual([]);
  });
  it("reads the first set by default and the other one when asked", () => {
    const cash = (basis?: "consolidated" | "standalone") =>
      buildSections(parseStatementLines(statementRegion(both, basis))).assets.find((a) => /cash/i.test(a.name ?? ""))?.amount;
    expect(cash()).toBe(100);
    expect(cash("standalone")).toBe(100);
    expect(cash("consolidated")).toBe(900);
  });
});
