import { describe, it, expect } from "vitest";
import {
  parseModelConfidence, parseBool, selectFinancialExcerpt, assessText, scoreClassification,
  financialSignal, countEvidence,
} from "./confidence";

const COVER = Array.from({ length: 120 }, (_, i) => `Annual Report cover / index / directors line ${i} lorem ipsum`).join("\n");
const BALANCE_SHEET = [
  "BALANCE SHEET as at 31 March 2026",
  "Share Capital | 1,000",
  "Reserves and Surplus | 500",
  "Term Loans | 800",
  "Sundry Creditors | 300",
  "Total Liabilities | 2,600",
  "Fixed Assets | 1,500",
  "Sundry Debtors | 700",
  "Inventory | 400",
  "Total Assets | 2,600",
].join("\n");
const REPORT = `${COVER}\n${BALANCE_SHEET}\n${COVER}`;
const SMALL_CSV = "Particulars,Amount\nShare Capital,1000\nReserves & Surplus,500\nTotal Assets,1500\nTotal Liabilities,1500";
const PROSE = "Our proprietor signed the cheque for purchases. Turnover of staff and inventory of books. Closing balance of the lecture. Net worth of the hero.";

describe("parseModelConfidence", () => {
  it.each([
    [0.85, 0.85], [1, 1], [0, 0], [85, 0.85], ["85%", 0.85], ["0.85", 0.85], ["85", 0.85],
    [" 72.5 % ", 0.725], ["high", 0.85], ["Medium", 0.6], ["LOW", 0.3],
  ])("%j -> %j", (input, expected) => {
    expect(parseModelConfidence(input)).toBeCloseTo(expected as number, 5);
  });

  it.each([[null], [undefined], ["n/a"], [""], [NaN], [-1], [250], [{}], [[]], [true]])("%j -> null (unusable, not 0)", (input) => {
    expect(parseModelConfidence(input)).toBeNull();
  });
});

describe("parseBool", () => {
  it("reads text booleans instead of treating 'false' as true", () => {
    expect(parseBool("false")).toBe(false);
    expect(parseBool("No")).toBe(false);
    expect(parseBool("TRUE")).toBe(true);
    expect(parseBool(true)).toBe(true);
    expect(parseBool("maybe")).toBeNull();
    expect(parseBool(undefined)).toBeNull();
  });
});

describe("selectFinancialExcerpt", () => {
  it("returns short text untouched and nothing for a zero budget", () => {
    expect(selectFinancialExcerpt("tiny", 4000)).toBe("tiny");
    expect(selectFinancialExcerpt("anything long enough", 0)).toBe("");
  });

  it("finds the balance sheet buried behind a long cover section (the old 4000-char head missed it)", () => {
    expect(REPORT.slice(0, 4000)).not.toMatch(/Total Assets/);
    const ex = selectFinancialExcerpt(REPORT, 4000);
    expect(ex).toMatch(/Total Assets/);
    expect(ex).toMatch(/Sundry Creditors/);
    expect(ex.length).toBeLessThanOrEqual(4000);
  });

  it("D2: still finds the statement when the whole document is ONE line (pdf.js joins items with spaces)", () => {
    const oneLine = `${"cover ".repeat(3000)}BALANCE SHEET Share Capital 1000 Total Assets 2600 Sundry Debtors 700 ${"tail ".repeat(3000)}`;
    expect(oneLine.includes("\n")).toBe(false);
    const ex = selectFinancialExcerpt(oneLine, 4000);
    expect(ex).toMatch(/Total Assets/);
    expect(ex.length).toBeLessThanOrEqual(4000);
  });

  it("D2: still finds it when each page is a 6 KB line", () => {
    const pages = Array.from({ length: 30 }, (_, i) => (i === 17 ? `Balance Sheet Total Assets 100 ${"x ".repeat(3000)}` : "filler ".repeat(900)));
    expect(selectFinancialExcerpt(pages.join("\n"), 4000)).toMatch(/Total Assets/);
  });

  it("D2: a tiny budget is still centred on a keyword, and never exceeds the budget", () => {
    const text = `${"a".repeat(5000)} Total Assets ${"b".repeat(5000)}`;
    for (const budget of [60, 100, 300, 1000]) {
      const ex = selectFinancialExcerpt(text, budget);
      expect(ex.length).toBeLessThanOrEqual(budget);
      expect(ex).toMatch(/Total Assets/);
    }
  });

  it("falls back to head + tail within the budget when nothing matches", () => {
    const text = `HEAD${"x".repeat(9000)}TAIL`;
    const ex = selectFinancialExcerpt(text, 1000);
    expect(ex.startsWith("HEAD")).toBe(true);
    expect(ex.endsWith("TAIL")).toBe(true);
    expect(ex.length).toBeLessThanOrEqual(1000);
  });

  it("never exceeds the budget on dense text, and keeps a keyword", () => {
    const dense = Array.from({ length: 400 }, () => "Total Assets 100 Sundry Debtors 50").join("\n");
    const ex = selectFinancialExcerpt(dense, 800);
    expect(ex.length).toBeLessThanOrEqual(800);
    expect(ex).toMatch(/Total Assets|Sundry Debtors/);
  });

  it("keeps windows in page order", () => {
    const text = `${COVER}\nProfit and Loss Account\nNet Sales 100\n${COVER}\n${BALANCE_SHEET}\n${COVER}`;
    const ex = selectFinancialExcerpt(text, 3000);
    expect(ex.indexOf("Profit and Loss")).toBeLessThan(ex.indexOf("BALANCE SHEET"));
  });

  it("handles CRLF and whitespace-only text without throwing", () => {
    expect(() => selectFinancialExcerpt(REPORT.replace(/\n/g, "\r\n"), 2000)).not.toThrow();
    expect(selectFinancialExcerpt(" \n ".repeat(5000), 1000).length).toBeLessThanOrEqual(1000);
  });

  it("is fast on a large document (no catastrophic regex)", () => {
    const big = `${"word ".repeat(400_000)}Total Assets ${"word ".repeat(400_000)}`; // ~4 MB
    const t = performance.now();
    expect(selectFinancialExcerpt(big, 4000)).toMatch(/Total Assets/);
    expect(performance.now() - t).toBeLessThan(1500);
  });
});

describe("assessText", () => {
  it("flags a PDF with almost no text per page as scanned", () => {
    expect(assessText("   \n ", { source: "pdf", pages: 3 }).likelyScanned).toBe(true);
    expect(assessText("x".repeat(200), { source: "pdf", pages: 10 }).likelyScanned).toBe(true); // 20 chars/page
  });

  it("accepts a normal text PDF", () => {
    expect(assessText("word ".repeat(400), { source: "pdf", pages: 2 }).likelyScanned).toBe(false);
  });

  it("D1: a short CSV/sheet is NOT a scan", () => {
    expect(SMALL_CSV.length).toBeLessThan(120);
    expect(assessText(SMALL_CSV, { source: "sheet" }).likelyScanned).toBe(false);
    expect(assessText(SMALL_CSV).likelyScanned).toBe(false); // default source without pages
    expect(assessText("Particulars,Amount\nA,1\nB,2", { source: "sheet" }).likelyScanned).toBe(false);
  });

  it("an empty sheet is 'empty', not 'scanned'", () => {
    const q = assessText("", { source: "sheet" });
    expect(q.likelyScanned).toBe(false);
    expect(q.empty).toBe(true);
  });

  it("real statement vocabulary overrides a scan guess (short PDF that clearly is a balance sheet)", () => {
    expect(assessText("Balance Sheet Total Assets 100 Share Capital 50", { source: "pdf", pages: 1 }).likelyScanned).toBe(false);
  });

  it("images use the same scan logic as PDFs", () => {
    expect(assessText("", { source: "image" }).likelyScanned).toBe(true);
  });
});

describe("financialSignal / countEvidence", () => {
  it("is full marks for a balance sheet and zero for plain prose", () => {
    expect(financialSignal(BALANCE_SHEET)).toBe(1);
    expect(countEvidence("The quick brown fox")).toBe(0);
    expect(financialSignal("The quick brown fox")).toBe(0);
  });

  it("D3: everyday prose full of weak words cannot reach a confident signal", () => {
    expect(financialSignal(PROSE)).toBeLessThanOrEqual(0.25);
    expect(countEvidence(PROSE)).toBeLessThanOrEqual(1);
  });

  it("D5: recognises common Indian statement vocabulary the first version missed", () => {
    for (const phrase of [
      "Loans & Advances", "Capital Reserve", "Bank Overdraft", "Cash Credit", "Provision for Tax",
      "Cash and Cash Equivalents", "Equity and Liabilities", "Loan Funds", "Tangible Assets", "Trade Payable",
      "Long Term Borrowing", "Gross Profit", "Net Block", "Shareholders' Funds", "Total Equity", "Total Income",
      "Profit after tax", "Loss before tax", "P&L Account", "Partner's Capital", "Statement of Account",
    ]) {
      expect(countEvidence(phrase), phrase).toBeGreaterThanOrEqual(1);
    }
  });

  it("recognises a bank statement through its own markers", () => {
    expect(financialSignal("Statement of Account IFSC SBIN0001 NEFT Narration Opening Balance Closing Balance")).toBeGreaterThanOrEqual(0.5);
  });
});

describe("scoreClassification", () => {
  const model = (confidence: unknown, isFinancialDocument: unknown = true, docType = "Balance Sheet") => ({ isFinancialDocument, docType, confidence, reason: "x" });

  it("the old failure: cover-page model said 0.4, but the real statement text is strong -> confidence recovers", () => {
    const scored = scoreClassification(model(0.4), REPORT, { source: "pdf", pages: 4 });
    expect(scored.confidence).toBeGreaterThanOrEqual(0.65);
    expect(scored.modelConfidence).toBe(0.4);
  });

  it("'85%' from the model is honoured instead of becoming 0%", () => {
    const scored = scoreClassification(model("85%"), REPORT, { source: "pdf", pages: 4 });
    expect(scored.modelConfidence).toBe(0.85);
    expect(scored.confidence).toBeGreaterThan(0.85);
  });

  it("unusable model figure is reported, not zeroed", () => {
    const scored = scoreClassification(model("n/a"), REPORT, { source: "pdf", pages: 4 });
    expect(scored.modelConfidence).toBeNull();
    expect(scored.confidence).toBeGreaterThan(0.5);
    expect(scored.reasons.join(" ")).toMatch(/no usable confidence/i);
  });

  it("a scanned PDF is capped low with an actionable reason", () => {
    const scored = scoreClassification(model(0.95), " ", { source: "pdf", pages: 3 });
    expect(scored.confidence).toBeLessThanOrEqual(0.2);
    expect(scored.likelyScanned).toBe(true);
    expect(scored.reasons.join(" ")).toMatch(/scanned/i);
  });

  it("D1: a small CSV balance sheet scores normally (not capped as a scan)", () => {
    const scored = scoreClassification(model(0.9), SMALL_CSV, { source: "sheet" });
    expect(scored.likelyScanned).toBe(false);
    expect(scored.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("an empty file says so instead of calling it a scan", () => {
    const scored = scoreClassification(model(0.9), "", { source: "sheet" });
    expect(scored.likelyScanned).toBe(false);
    expect(scored.confidence).toBeLessThanOrEqual(0.1);
    expect(scored.reasons.join(" ")).toMatch(/almost no text/i);
  });

  it("classifier unavailable (null) falls back to keyword evidence and says so", () => {
    const scored = scoreClassification(null, REPORT, { source: "pdf", pages: 4 });
    expect(scored.isFinancialDocument).toBe(true);
    expect(scored.confidence).toBeCloseTo(0.7, 2);
    expect(scored.reasons.join(" ")).toMatch(/unavailable/i);
  });

  it("D4: classifier unavailable + non-financial text is not reported as 0% certainty", () => {
    const scored = scoreClassification(null, "The quick brown fox jumps over the lazy dog. ".repeat(20), { source: "text" });
    expect(scored.isFinancialDocument).toBe(false);
    expect(scored.confidence).toBeGreaterThan(0.5);
  });

  it("model says 'not financial' but the text is full of statements -> doubt, capped", () => {
    const scored = scoreClassification(model(0.95, false, "Not a Financial Document"), REPORT, { source: "pdf", pages: 4 });
    expect(scored.confidence).toBeLessThanOrEqual(0.4);
  });

  it("D4: a text 'false' answer is read as false", () => {
    const scored = scoreClassification(model(0.9, "false", "Not a Financial Document"), "The quick brown fox. ".repeat(40), { source: "text" });
    expect(scored.isFinancialDocument).toBe(false);
    expect(scored.confidence).toBe(0.9);
  });

  it("genuinely non-financial prose keeps the model's own confidence", () => {
    const prose = "The quick brown fox jumps over the lazy dog. ".repeat(50);
    const scored = scoreClassification(model(0.9, false, "Not a Financial Document"), prose, { source: "pdf", pages: 1 });
    expect(scored.confidence).toBe(0.9);
  });

  it("D3: confident-sounding prose is not boosted to 'financial' by weak words", () => {
    const scored = scoreClassification(model(0.9, true), PROSE.repeat(5), { source: "text" });
    expect(scored.confidence).toBeLessThan(0.7);
    expect(scored.reasons.join(" ")).toMatch(/few financial-statement terms/i);
  });

  it("confidence is always within 0..1 and rounded to 2 dp", () => {
    for (const c of [0, 0.333333, 1, "high", "x", 500]) {
      const s = scoreClassification(model(c), REPORT, { source: "pdf", pages: 4 });
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
      expect(Math.round(s.confidence * 100) / 100).toBe(s.confidence);
    }
  });
});
