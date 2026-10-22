// A second opinion on the model's extraction, from the deterministic parser: if the
// document states a total assets figure, the model's total assets must agree with it
// (allowing for the unit conversion to Rs. Lakhs). A model can misread a column, mix
// two sides of a page or drop a zero - this catches the figure that anchors the rest.

import { buildIncomeStatement, buildSections, parseStatementLines, statementRegion } from "../statementParsing";

export interface SourceCheck {
  status: "match" | "mismatch" | "unverified"
  detail: string
}

const nums = (v: unknown): number[] =>
  Array.isArray(v) ? v.filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x !== 0) : [];

/** The headline figures the document itself prints (first amount column), when it prints them. */
function printedFigures(rawText: string): { totalAssets: number | null; revenue: number | null } {
  const sections = buildSections(parseStatementLines(statementRegion(rawText)));
  const pick = (v: unknown) => (typeof v === "number" && v !== 0 ? Math.abs(v) : null);
  return { totalAssets: pick(sections.totals.totalAssets), revenue: pick(buildIncomeStatement(sections.income)?.revenue) };
}

/** True when a/b is 1, 10, 100, 0.01, 0.00001 ... (a unit conversion), within 2%. */
function sameUpToUnit(a: number, b: number): boolean {
  const ratio = Math.abs(a) / b;
  const exp = Math.round(Math.log10(ratio));
  if (exp < -7 || exp > 3) return false;
  return Math.abs(ratio / 10 ** exp - 1) <= 0.02;
}

const fmt = (vs: number[]) => vs.map((v) => v.toLocaleString("en-IN")).join(" / ");

/**
 * Compare one extracted series with the figure printed in the document. Null when the document prints
 * nothing to compare against.
 */
function compare(label: string, extracted: number[], printed: number | null): { ok: boolean; detail: string; label: string } | null {
  if (printed === null) return null;
  if (!extracted.length) return { ok: false, label, detail: `The document prints ${label}, but none was extracted.` };
  if (extracted.some((v) => sameUpToUnit(v, printed))) return { ok: true, label, detail: `${label} agrees with the document.` };
  return { ok: false, label, detail: `Extracted ${label} (${fmt(extracted)} lakhs) do not agree with the ${printed.toLocaleString("en-IN")} printed in the document - check the extraction.` };
}

export function crossCheckAgainstSource(parsed: Record<string, unknown>, rawText: string): Record<string, unknown> {
  const printed = printedFigures(rawText);
  const bs = (parsed.balanceSheet ?? {}) as Record<string, unknown>;
  const os = (parsed.operatingStatement ?? {}) as Record<string, unknown>;

  const results = [
    compare("total assets", nums(bs.totalAssets), printed.totalAssets),
    // sales may be reported gross or net; either may carry the printed figure
    compare("revenue", [...nums(os.netSales), ...nums(os.grossSales)], printed.revenue),
  ].filter((r): r is NonNullable<typeof r> => r !== null);

  let check: SourceCheck;
  if (!results.length) {
    check = { status: "unverified", detail: "The document does not print a total assets or revenue figure that could be read automatically." };
  } else if (results.every((r) => r.ok)) {
    check = { status: "match", detail: `${results.map((r) => r.label).join(" and ").replace(/^./, (c) => c.toUpperCase())} agree with the figures printed in the document.` };
  } else {
    check = { status: "mismatch", detail: results.filter((r) => !r.ok).map((r) => r.detail).join(" ") };
  }
  return { ...parsed, sourceCheck: check };
}
