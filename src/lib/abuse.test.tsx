// What a user can throw at the upload: empty, corrupt and mislabelled files, malformed or hostile JSON,
// absurd numbers, adversarial text. Whatever comes in, parseFile must not reject, the report must render,
// and nothing user-facing may read NaN / Infinity / undefined / [object Object].
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import parseFile from "./parsers";
import { BalanceSheetReport } from "../app/components/calculators/BalanceSheetReport";
import { parseStatementLines, buildSections, buildIncomeStatement, statementRegion, principalRepayments, pdfItemsToRows } from "./statementParsing";

const file = (content: string | Uint8Array | ArrayBuffer, name: string) => new File([content as BlobPart], name);
const junk = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 131 + 17) % 256);

async function survives(f: File) {
  const parsed = await parseFile(f); // must not reject
  expect(parsed).toBeTruthy();
  expect(parsed.balanceSheet).toBeTruthy();
  for (const k of ["assets", "liabilities", "equity"] as const) expect(Array.isArray(parsed.balanceSheet[k])).toBe(true);
  const html = renderToStaticMarkup(<BalanceSheetReport parsed={parsed} businessConstitution="Private Limited" />);
  // user-facing garbage
  const text = html.replace(/<[^>]*>/g, " ");
  expect(text).not.toMatch(/\bNaN\b|Infinity|undefined|\[object/);
  return { parsed, html };
}

describe("empty, corrupt and mislabelled files", () => {
  it.each([
    "empty.pdf", "empty.csv", "empty.json", "empty.xlsx", "empty.xls", "empty.docx", "empty.doc", "empty.txt", "empty.tsv", "empty",
  ])("%s (0 bytes)", async (name) => { await survives(file("", name)); });

  it.each([
    ["fake.pdf", () => file(junk(5000), "fake.pdf")],
    ["a Windows .exe renamed .pdf", () => file("MZ\u0090\u0000\u0003\u0000\u0000\u0000", "setup.pdf")],
    ["corrupt.xlsx", () => file(junk(5000), "corrupt.xlsx")],
    ["corrupt.docx", () => file(junk(5000), "corrupt.docx")],
    ["a PDF header with nothing after it", () => file("%PDF-1.7\n%%EOF", "stub.pdf")],
    ["a zip bomb-ish truncated xlsx", () => file("PK\u0003\u0004" + "\u0000".repeat(300), "trunc.xlsx")],
    ["binary garbage named .txt", () => file(junk(20000), "garbage.txt")],
    ["binary garbage named .csv", () => file(junk(20000), "garbage.csv")],
    ["no extension", () => file("Cash 100\nCreditors 50", "statement")],
    ["double extension", () => file("Cash 100", "statement.pdf.exe")],
    ["a name with HTML in it", () => file("Cash 100\nShare Capital 100", "<img src=x onerror=alert(1)>.csv")],
  ])("%s", async (_label, make) => { await survives(make()); });

  it("a file name with HTML is escaped in the report, not injected", async () => {
    const { html } = await survives(file("Cash 100\nShare Capital 100\nSales 500", "<img src=x onerror=alert(1)>.csv"));
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});

describe("malformed and hostile JSON", () => {
  it.each([
    ["not json", "{{{ nope"], ["null", "null"], ["empty array", "[]"], ["a number", "42"], ["a string", '"hello"'],
    ["array of junk", '[null, 1, "a", [], {}]'],
    ["balanceSheet is a number", '{"balanceSheet": 5}'],
    ["balanceSheet is a string", '{"balanceSheet": "abc"}'],
    ["assets is a number", '{"balanceSheet": {"assets": 5, "liabilities": 7, "equity": 9}}'],
    ["assets is a string", '{"balanceSheet": {"assets": "abc"}}'],
    ["assets hold nulls and strings", '{"balanceSheet": {"assets": [null, {"amount": "x"}, 5, {"name": 7, "amount": null}], "liabilities": [], "equity": []}}'],
    ["totals are strings", '{"balanceSheet": {"assets": [], "liabilities": [], "equity": [], "totals": {"totalAssets": "lots"}}}'],
    ["income statement is a number", '{"balanceSheet": {"assets": [], "liabilities": [], "equity": []}, "incomeStatement": 5}'],
    ["income statement holds strings", '{"balanceSheet": {"assets": [], "liabilities": [], "equity": []}, "incomeStatement": {"revenue": "big", "ebit": null}}'],
    ["receivables is not a list", '{"balanceSheet": {"assets": [], "liabilities": [], "equity": []}, "receivables": 5}'],
    ["amount beyond float range", '{"balanceSheet": {"assets": [{"name": "Cash", "amount": 1e999}], "liabilities": [{"name": "Loan", "amount": -1e999}], "equity": []}}'],
    ["metadata is wrong type", '{"balanceSheet": {"assets": [], "liabilities": [], "equity": []}, "metadata": "x"}'],
    ["deeply nested", '{"balanceSheet":' + '{"a":'.repeat(500) + "1" + "}".repeat(500) + "}"],
  ])("%s", async (_label, body) => { await survives(file(body, "data.json")); });

  it("__proto__ keys do not pollute Object.prototype", async () => {
    await survives(file('{"__proto__": {"polluted": 1}, "balanceSheet": {"__proto__": {"polluted": 2}, "assets": [], "liabilities": [], "equity": []}}', "evil.json"));
    expect(({} as any).polluted).toBeUndefined();
  });
});

describe("absurd numbers and awkward text in CSV / text files", () => {
  it.each([
    ["only a header", "name,amount\n"],
    ["only commas", ",,,,\n,,,,\n,,,"],
    ["unbalanced quotes", 'name,amount\n"Cash,100\nShare Capital,200'],
    ["NaN / Infinity words as amounts", "name,amount\nCash,NaN\nDebtors,Infinity\nCreditors,-Infinity\nCapital,undefined"],
    ["a 400-digit amount", "Cash " + "9".repeat(400) + "\nShare Capital 100\nSales 5,000"],
    ["a 400-digit amount with commas", "Cash " + "9,".repeat(200) + "99\nShare Capital 100"],
    ["negative everything", "Cash -100\nShare Capital -200\nSundry Creditors (50)\nTerm Loan -75\nSales -1000\nInterest on Loan -5"],
    ["all zeros", "Cash 0\nShare Capital 0\nSundry Creditors 0\nTerm Loan 0\nSales 0\nDepreciation 0\nInterest on Loan 0"],
    ["zero equity, real debt", "Share Capital 0\nTerm Loan 500\nCash 100\nSales 1000\nInterest on Term Loan 50\nNet Profit 10"],
    ["debt but no equity line at all", "Term Loan 500\nBank OD 100\nSundry Creditors 50\nCash 10"],
    ["scientific / hex / Arabic-Indic digits", "Cash 1e5\nDebtors 0x1F\nCreditors ٣٤٥\nCapital １２３"],
    ["emoji, RTL and zero-width characters", "💰 Cash 100\nمدينون 200\nShare​Capital 300\n‮toor 5"],
    ["tab / semicolon delimited", "name;amount\nCash;100\nShare Capital;200\n\nname\tamount\nDebtors\t50"],
    ["a UTF-8 BOM and CRLF", "﻿name,amount\r\nCash,100\r\nShare Capital,200\r\n"],
    ["spreadsheet formulas as text", "name,amount\n=cmd|' /C calc'!A0,100\n@SUM(1+1),5\n+1+1,3"],
    ["the same total repeated a thousand times", "Total Assets 100\n".repeat(1000) + "Cash 100"],
    ["one label with 200k characters", "A".repeat(200000) + " 100\nShare Capital 100"],
    ["10,000 rows", Array.from({ length: 10000 }, (_, i) => `Item ${i} ${i + 1}`).join("\n")],
  ])("%s", async (_label, body) => {
    await survives(file(body, "x.txt"));
    await survives(file(body, "x.csv"));
  }, 30000);
});

describe("adversarial text cannot make the parser hang (ReDoS / quadratic blowups)", () => {
  const cases: Array<[string, string]> = [
    ["50k spaces then a word", " ".repeat(50000) + "x 1"],
    ["a comma-digit chain", "Cash " + "1,".repeat(50000)],
    ["nested brackets", "(".repeat(50000) + "5" + ")".repeat(50000)],
    ["50k tokens then an amount", "a ".repeat(50000) + "1"],
    ["a long run of heading words", "Current ".repeat(20000) + "Assets"],
    ["long list-marker prefixes", "(a)(b)(c)".repeat(10000) + " Cash 5"],
    ["pipes everywhere", "|".repeat(50000)],
    ["a wall of digits and dots", "1.".repeat(50000)],
    ["Less/Add chain", "Less: ".repeat(20000) + "Depreciation 5"],
    ["total-like words", "Total ".repeat(20000) + "Assets 5"],
  ];
  it.each(cases)("%s", (_label, text) => {
    const t0 = performance.now();
    const items = parseStatementLines(text);
    const s = buildSections(items);
    buildIncomeStatement(s.income);
    statementRegion(text);
    principalRepayments(text);
    expect(performance.now() - t0).toBeLessThan(3000);
  }, 20000);

  it("a PDF page with a huge number of text items is split quickly", () => {
    const items = Array.from({ length: 60000 }, (_, i) => ({ str: i % 2 ? "1,000" : "Item " + i, transform: [1, 0, 0, 1, (i % 40) * 25, 800 - Math.floor(i / 40) * 2], width: 30 }));
    const t0 = performance.now();
    pdfItemsToRows(items);
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});
