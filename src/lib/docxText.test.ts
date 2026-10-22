import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { docxToText, htmlToRows } from "./docxText";
import { parseStatementLines } from "./statementParsing";

const fixture = (name: string) => {
  const buf = fs.readFileSync(path.join(__dirname, "__fixtures__", name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};

describe("docxToText", () => {
  it("reads a real .docx at all (an xmldom version clash used to make every upload throw)", async () => {
    const text = await docxToText(fixture("statement-paragraphs.docx"));
    expect(text.length).toBeGreaterThan(20);
  });

  it("keeps a Word table's rows together as 'label | amount' lines", async () => {
    const text = await docxToText(fixture("statement-table.docx"));
    expect(text).toMatch(/\|/);
    const items = parseStatementLines(text);
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.every((i) => /[A-Za-z]{3}/.test(i.name))).toBe(true);
  });
});

describe("htmlToRows", () => {
  it("one line per paragraph and one pipe-joined line per table row, skipping empty cells", () => {
    const html = "<p>Balance Sheet</p><table><tr><td>Share Capital</td><td></td><td>1,000</td></tr><tr><td>Total Assets</td><td>2,600</td></tr></table><p> </p>";
    expect(htmlToRows(html)).toBe("Balance Sheet\nShare Capital | 1,000\nTotal Assets | 2,600");
  });
});

describe("Word statements through the same classifier", () => {
  const rows = (cells: string[][]) => `<table>${cells.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;

  it("a side-by-side (T-format) Word table keeps both sides", async () => {
    const { buildSections } = await import("./statementParsing");
    const html = rows([
      ["Liabilities", "Amount", "Assets", "Amount"],
      ["Capital Account", "10,00,000", "Closing Stock", "10,00,000"],
      ["Bank OD A/c", "8,00,000", "Sundry Debtors", "8,00,000"],
    ]);
    const s = buildSections(parseStatementLines(htmlToRows(html)));
    expect(s.assets.map((a) => a.name)).toEqual(["Closing Stock", "Sundry Debtors"]);
    expect(s.liabilities.map((a) => a.name)).toEqual(["Bank OD A/c"]);
    expect(s.equity.map((a) => a.name)).toEqual(["Capital Account"]);
  });

  it("heading paragraphs between tables and bulleted lines still count", async () => {
    const { buildSections } = await import("./statementParsing");
    const html = "<p>Current Assets</p><ul><li>Inventories 500</li><li>Cash 100</li></ul><p>Current Liabilities</p><ol><li>Trade payables 300</li></ol>";
    const s = buildSections(parseStatementLines(htmlToRows(html)));
    expect(s.assets.map((a) => a.amount)).toEqual([500, 100]);
    expect(s.liabilities.map((a) => a.amount)).toEqual([300]);
  });
});
