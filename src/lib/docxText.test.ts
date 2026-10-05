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
