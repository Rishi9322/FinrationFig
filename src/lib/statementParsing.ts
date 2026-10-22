// Turning uploaded statement text into balance-sheet sections, and scoring how
// far the result can be trusted. Pure functions, no I/O.
//
// Replaces the old fixed 0.5/0.6/0.7 "confidence" constants: the score is built
// from things we can check (enough line items, lines classified, totals that
// agree AND are matched by the line items), and the notes say which.

import type { LineItem, BalanceSection, Group, IncomeStatement } from "./parsedBalanceSheet";

// A column holding "-", "--" or "Nil" means zero in that column - it must keep
// its place so the next column (the previous year) isn't mistaken for it.
const PLACEHOLDER = /^(?:-{1,3}|[—–]|nil)$/i;
const NUMERIC = /^\(?-?(?:₹|rs\.?)?\s*\d[\d,]*(?:\.\d+)?\)?-?$/i;
const isPlaceholder = (s: string) => PLACEHOLDER.test(s.trim());
const isNumeric = (s: string) => NUMERIC.test(s.trim());
/** A cell that can be an amount: a number or a zero placeholder. */
export const isAmountCell = (s: string) => isNumeric(s) || isPlaceholder(s);

/** Indian comma grouping ("12,34,567"), "(1,234)" and "1,234-" negatives, rupee marks, "Rs.", "Nil". */
export function parseAmount(raw: unknown): number {
  const str = String(raw ?? "").trim();
  if (!str || isPlaceholder(str)) return 0;
  const negative = /^\(.*\)$/.test(str) || /^(?:(?:₹|rs\.?)\s*)?-/i.test(str) || /\d\s*-$/.test(str);
  const digits = str.replace(/rs\.?|inr|₹/gi, "").replace(/[^0-9.]/g, "");
  const value = Number(digits);
  if (isNaN(value)) return 0;
  return negative ? -Math.abs(value) : value;
}

/** CSV line split that respects quotes, so "20,00,000" stays one value. Delimiter is a comma or tab. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && (ch === "," || ch === "\t")) {
      cells.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

type PdfItem = { str?: string; transform?: number[]; width?: number }

function rowsOf(items: PdfItem[]): string[] {
  const byRow = new Map<number, Array<{ x: number; str: string }>>();
  for (const it of items) {
    const str = (it.str ?? "").trim();
    if (!str || !it.transform) continue;
    const y = Math.round(Math.round(it.transform[5]) / 4) * 4;
    if (!byRow.has(y)) byRow.set(y, []);
    byRow.get(y)!.push({ x: it.transform[4], str });
  }
  return [...byRow.keys()]
    .sort((a, b) => b - a)
    .map((y) => byRow.get(y)!.sort((a, b) => a.x - b.x).map((c) => c.str).join(" | "));
}

/**
 * A sheet printed two pages up ("spread") or a two-column layout has an empty
 * vertical band in the middle. Reading straight across it glues a left-hand line
 * to a right-hand one, so find that band and read each side on its own. A
 * label | amount table also has a gap, but its left side holds no amounts - so a
 * split needs numbers AND words on both sides. Returns the split x, or null.
 */
export function findGutter(items: PdfItem[]): number | null {
  const spans = items
    .filter((it) => (it.str ?? "").trim() && it.transform && typeof it.width === "number" && it.width > 0)
    .map((it) => ({ a: it.transform![4], b: it.transform![4] + it.width!, y: Math.round(it.transform![5] / 4), str: (it.str ?? "").trim() }));
  if (spans.length < 30) return null;
  const lo = Math.min(...spans.map((x) => x.a));
  const hi = Math.max(...spans.map((x) => x.b));
  const w = hi - lo;
  if (w <= 0) return null;

  // Candidate gutters: stretches in the middle 30% of the sheet that nothing crosses.
  // Stray text (a centred title, "View single page" links, a footer) may cross; an amount may not.
  const tolerance = Math.max(1, Math.floor(0.06 * spans.length));
  const step = w / 400;
  const end = lo + 0.65 * w;
  const candidates: Array<{ gap: number; at: number }> = [];
  let runStart: number | null = null;
  for (let c = lo + 0.35 * w; c <= end + step; c += step) {
    const across = c <= end ? spans.filter((x) => x.a < c && x.b > c) : [];
    const clear = c <= end && across.length <= tolerance && !across.some((x) => isAmountCell(x.str));
    if (clear) { if (runStart === null) runStart = c; }
    else if (runStart !== null) {
      if (c - runStart >= 0.01 * w) candidates.push({ gap: c - runStart, at: runStart + (c - runStart) / 2 });
      runStart = null;
    }
  }

  // A real page boundary leaves labels at the start of every row on both sides. A cut between
  // an item column and a subtotal column leaves rows that begin with an amount.
  const isLabel = (str: string) => hasWords(str) && !isAmountCell(str);
  const side = (xs: typeof spans) => {
    const first = new Map<number, { a: number; str: string }>();
    for (const x of xs) { const f = first.get(x.y); if (!f || x.a < f.a) first.set(x.y, x); }
    const rows = [...first.values()];
    return { rows: rows.length, purity: rows.length ? rows.filter((r) => isLabel(r.str)).length / rows.length : 0 };
  };
  const ok = (xs: typeof spans) => xs.filter((x) => isAmountCell(x.str)).length >= 8 && xs.filter((x) => isLabel(x.str)).length >= 8;
  let best: { at: number; score: number } | null = null;
  for (const c of candidates) {
    const left = spans.filter((x) => x.b <= c.at);
    const right = spans.filter((x) => x.a >= c.at);
    if (!ok(left) || !ok(right)) continue;
    const purity = Math.min(side(left).purity, side(right).purity);
    if (purity < 0.6) continue;
    const score = purity + c.gap / w; // purity decides, width breaks ties
    if (!best || score > best.score) best = { at: c.at, score };
  }
  return best ? best.at : null;
}

/**
 * pdf.js text items -> one string per visual row (items sharing a baseline,
 * left to right, joined with " | "). Joining a whole page with spaces loses the
 * label/amount structure that statement parsing depends on.
 */
export function pdfItemsToRows(items: PdfItem[]): string[] {
  const gutter = findGutter(items);
  if (gutter === null) return rowsOf(items);
  const side = (left: boolean) => items.filter((it) => !!it.transform && (it.transform[4] < gutter) === left);
  return [...rowsOf(side(true)), ...rowsOf(side(false))];
}

/** Header/date lines whose first number is a year, not an amount. */
const DATE_LINE = /\b(?:as\s+at|as\s+on|year\s+ended|for\s+the\s+year|period\s+ended|march|september|december|june)\b/i;
const isYearLike = (s: string) => /^(?:19|20)\d{2}$/.test(s.trim());
/** A schedule/note reference ("3") sitting in a column before the amounts. */
const isNoteRef = (s: string) => /^\d{1,2}$/.test(s.trim());
const isBig = (s: string) => /[,.]/.test(s) || s.replace(/\D/g, "").length >= 3;

/** A label that starts mid-sentence is the second half of a wrapped one. */
const CONTINUATION = /^(?:[a-z]|(?:and|of|from|to|for|on|against|with|&)\b)/;

const NOTE_REF_IN_LABEL = /\(?\s*(?:refer\s+)?note\s*(?:no\.?)?\s*\d+[a-z]?\s*\)?/gi;

/**
 * Choose the current-year amount from the amount cells that follow a label:
 * the FIRST one, after dropping a year in a date line and a leading Note
 * column. Returns undefined when nothing usable is left.
 */
export function pickAmount(amounts: string[], label: string): string | undefined {
  let a = amounts;
  if (a.length && DATE_LINE.test(label) && isYearLike(a[0])) a = a.slice(1);
  if (a.length >= 2 && isNoteRef(a[0]) && (isBig(a[1]) || a.length >= 3)) a = a.slice(1);
  return a[0];
}

// "(a) ", "(i) ", "(2) ", "1. ", "II. " list markers, "To, " / "By, " (trading account), "Add:" / "Less:".
const ENUM = /^(?:\((?:[a-z]{1,2}|[ivx]{1,4}|\d{1,2})\)|(?:[ivx]{1,4}|\d{1,2})[.)]|[a-z][.)])\s*/i;
const TO_BY = /^(?:to|by)\s*,\s*/i;
const ADD_LESS = /^(?:add|less)\s*[:-]\s*/i;
const isLess = (label: string) => ADD_LESS.test(label.trim().replace(ENUM, "").replace(TO_BY, "")) && /^less/i.test(label.trim().replace(ENUM, "").replace(TO_BY, ""));
const cleanLabel = (label: string) =>
  label.replace(ENUM, "").replace(TO_BY, "").replace(ADD_LESS, "").replace(NOTE_REF_IN_LABEL, " ").replace(/\s+/g, " ").replace(/[:.\-\s]+$/, "").trim();
const hasWords = (s: string) => /[A-Za-z]{3}/.test(s);

/**
 * A statement line is never thousands of characters long, and several of the patterns below are
 * quadratic on a long run of spaces. Collapse blanks (tabs are kept - they delimit cells) and cap
 * the length before any of them runs.
 */
const MAX_LINE = 1500;
const tidyLine = (s: string) => s.replace(/[^\S\t]+/g, " ").trim().slice(0, MAX_LINE);

// Signature-block lines ("DIN: 07847098", "Date: April 12") carry numbers that are not amounts.
const SIGNATURE_LINE = /^(?:particulars|din|date|place|membership\s+no|firm\s+reg\w*|pan|cin|page)\b/i;

/** One row of cells (CSV/XLSX/docx/PDF) -> a line item: first text cell is the label. */
export function rowToItem(cells: string[], yearIdx: number | null = null): LineItem | null {
  const li = cells.findIndex((c) => hasWords(c) && !isAmountCell(c));
  if (li === -1) return null;
  const label = cleanLabel(cells[li]);
  if (!hasWords(label) || SIGNATURE_LINE.test(label)) return null;

  let amount: string | undefined;
  if (yearIdx !== null && yearIdx > li && isAmountCell(cells[yearIdx] ?? "")) amount = cells[yearIdx];
  else amount = pickAmount(cells.slice(li + 1).filter(isAmountCell), label);
  if (amount === undefined) return null;
  const value = parseAmount(amount);
  return { name: label, value: isLess(cells[li]) ? -Math.abs(value) : value };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * A sortable key for a period header cell, or NaN if it isn't one. Handles
 * "2025-26", "FY25", "Mar-25", "March 2025", "31-Mar-24", "31/03/2025".
 */
export function periodKey(cell: string): number {
  const c = cell.trim().toLowerCase();
  if (!c || c.length > 30) return NaN;
  const year = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

  let m = c.match(/(\d{1,2})[/.-](\d{1,2})[/.-]((?:19|20)?\d{2})\b/); // 31/03/2025, 31.03.25
  if (m) return year(m[3]) * 12 + Number(m[2]);

  m = c.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s'.,/-]*((?:19|20)?\d{2})\b/); // Mar-25, March 2025, 31-Mar-24
  if (m) return year(m[2]) * 12 + MONTHS.indexOf(m[1]) + 1;

  m = c.match(/\bfy\s*['-]?\s*((?:19|20)?\d{2})\b/); // FY25, FY 2025
  if (m) return year(m[1]) * 12 + 3;

  m = c.match(/\b((?:19|20)\d{2})\b/); // 2025-26, 2024, "year ended 2025"
  if (m) return Number(m[1]) * 12 + 3;
  return NaN;
}

/** Index of the latest-period column in a header like "Particulars | 2024-25 | 2025-26", or null. */
export function yearColumnIndex(header: string[]): number | null {
  const keys = header.map(periodKey);
  const found = keys.filter((k) => !isNaN(k));
  if (found.length < 2 || new Set(found).size < 2) return null;
  return keys.indexOf(Math.max(...found));
}

/**
 * Side-by-side statements ("Capital | 100 | Fixed Assets | 100") carry two line
 * items per row: split where a text cell follows an amount.
 */
function rowToItems(cells: string[], yearIdx: number | null = null): LineItem[] {
  const segs: string[][] = [];
  let cur: string[] = [];
  for (const c of cells) {
    if (hasWords(c) && !isAmountCell(c) && cur.some(isAmountCell)) { segs.push(cur); cur = []; }
    cur.push(c);
  }
  segs.push(cur);
  const split = segs.length > 1 ? segs.map((s) => rowToItem(s)).filter((i): i is LineItem => !!i) : [];
  if (split.length > 1) return split;
  const one = rowToItem(cells, yearIdx);
  return one ? [one] : [];
}

// Statements differ in how they group lines, but the headings are a small
// vocabulary. Specific ones (current/non-current/equity) decide a line's section;
// generic ones ("Liabilities", "Assets") only place lines the words can't.
const HEADINGS: Array<[RegExp, Group | null]> = [
  [/^(?:balance\s+sheet|financial\s+position)\b/, null],
  [/^(?:non[-\s]?current\s+assets?|fixed\s+assets?|long[-\s]?term\s+assets?)\b/, "noncurrent-asset"],
  [/^(?:current\s+assets?\b|cash\s*(?:and|&)\s*bank)/, "current-asset"],
  [/^(?:assets?|application\s+of\s+funds)$/, "asset"],
  [/^(?:non[-\s]?current\s+liabilit|long[-\s]?term\s+(?:liabilit|borrowing))/, "noncurrent-liability"],
  [/^(?:(?:secured|unsecured)\s+loans?|loans?\s*\(liabilit(?:y|ies)\)|borrowings?)$/, "borrowing"],
  [/^(?:current\s+liabilit|short[-\s]?term\s+(?:liabilit|borrowing))/, "current-liability"],
  [/^(?:shareholders?[’'`]?s?\s+(?:funds?|equity)|owners?[’'`]?s?\s+(?:funds?|equity)|(?:proprietors?|partners?)[’'`]?s?\s*(?:funds?|capital)|capital\s+and\s+reserves|net\s*worth|equity(?!\s+(?:and|&)\s+liabilit))\b/, "equity"],
  [/^(?:liabilit(?:y|ies)|(?:equity|capital)\s+(?:and|&)\s+liabilit\w*|sources\s+of\s+funds)\b/, "liability"],
  [/^(?:statement\s+of\s+profit|profit\s+(?:and|&)\s+loss\s+(?:account|a\/c|statement)|income\s+statement|trading\s+(?:account|(?:and|&)\s+profit)|revenue|incomes?)\b/, "income"],
  [/^(?:expenses?|expenditure|costs?)\b/, "expense"],
];

/** Group a heading row names, null if it resets the context, undefined if it isn't a heading. */
function headingOf(cell: string): Group | null | undefined {
  const label = cell.trim().replace(ENUM, "").replace(/\s*:\s*$/, "").replace(/\s+$/, "").toLowerCase();
  if (!hasWords(label) || label.length > 100 || isAmountCell(label)) return undefined;
  for (const [re, g] of HEADINGS) if (re.test(label)) return g;
  return undefined;
}

const GRAND_TOTAL = /^(?:grand\s+)?total(?:\s+(?:of\s+)?(?:assets|liabilit\w*|equity|funds|capital|application|sources).*)?$/i;

/** Remembers the latest section heading while rows are read top to bottom. */
function headingTracker() {
  let heading: Group | undefined;
  return {
    /** A row with no amount: remember the section it names. Two on one row = side-by-side layout, so none. */
    note(cells: string[]) {
      const hits = cells.map(headingOf).filter((h) => h !== undefined);
      if (hits.length === 1) heading = hits[0] ?? undefined;
      else if (hits.length > 1) heading = undefined;
    },
    stamp(items: LineItem[]): LineItem[] {
      const h = items.length === 1 ? heading : undefined;
      const out = h ? items.map((it) => ({ ...it, heading: h })) : items;
      if (items.some((it) => GRAND_TOTAL.test(it.name))) heading = undefined;
      return out;
    },
  };
}

/**
 * A side-by-side sheet (liabilities in columns A-C, assets in D-F) has a second block of labels
 * after a run of amount columns. Returns the column where that block starts, or null.
 */
function secondBlockColumn(rows: string[][]): number | null {
  const width = Math.max(...rows.map((r) => r.length));
  const isLabel = (c: string) => hasWords(c) && !isAmountCell(c);
  const labelRows = (col: number) => rows.filter((r) => isLabel(r[col] ?? "")).length;
  const amountRows = (from: number, to: number) => rows.filter((r) => r.slice(from, to).some((c) => isAmountCell(c ?? "") && /\d/.test(c ?? ""))).length;
  const need = Math.max(6, Math.floor(rows.length * 0.2));
  for (let col = 2; col < width; col++) {
    if (!isLabel(rows.find((r) => isLabel(r[col] ?? ""))?.[col] ?? "")) continue;
    // a label column with amounts before it (left block) and after it (right block), and labels in an earlier column
    const earlier = Array.from({ length: col }, (_, c) => c).some((c) => labelRows(c) >= need);
    if (labelRows(col) >= need && earlier && amountRows(0, col) >= need && amountRows(col + 1, width) >= need) return col;
  }
  return null;
}

/** A side-by-side table as two tables, one after the other (left block, then right block); any other table is unchanged. */
export function splitSides(rows: string[][]): string[][] {
  const split = rows.length ? secondBlockColumn(rows) : null;
  if (split === null) return rows;
  return [...rows.map((r) => r.slice(0, split)), ...rows.map((r) => r.slice(split))];
}

/** Rows of cells -> line items, honouring a year header when there is one. */
export function itemsFromRows(rows: string[][]): LineItem[] {
  if (!rows.length) return [];
  const sides = splitSides(rows);
  if (sides !== rows) return itemsFromRows(sides.slice(0, rows.length)).concat(itemsFromRows(sides.slice(rows.length)));
  const yearIdx = yearColumnIndex(rows[0]);
  const items: LineItem[] = [];
  const tracker = headingTracker();
  for (const r of rows) {
    const cells = r.map((c) => tidyLine(String(c ?? "")));
    const found = rowToItems(cells, yearIdx);
    if (found.length) items.push(...tracker.stamp(found));
    else tracker.note(cells);
  }
  return items;
}

/**
 * A full report (auditor's letter, notes, cash flow) repeats balance-sheet items
 * many times. When the text has a "Balance Sheet as at ..." or "Statement of
 * Profit and Loss for the year ..." heading, keep only from there up to the cash
 * flow / changes in equity / notes - the statements themselves. No such heading
 * (a bare spreadsheet-style list): the text is returned unchanged.
 */
export type Basis = "consolidated" | "standalone";

/** Statement headings in the text: where each starts, and whether it says Consolidated or Standalone. */
function statementStarts(flat: string[]): Array<{ at: number; basis?: Basis }> {
  const START = /^(?:(consolidated|standalone)\s+)?(?:balance\s+sheet|statements?\s+of\s+(?:profit|income)|(?:trading\s+(?:and|&)\s+)?profit\s+(?:and|&)\s+loss\s+(?:account|a\/c))\b/i;
  // The auditor's letter has sentences starting the same way; a real heading is followed by the table.
  const TABLE_START = /^(?:particulars|liabilities\b|assets\b|equity\s+and\s+liabilities|income\b|revenue\b|i\s+(?:income|revenue))/i;
  const out: Array<{ at: number; basis?: Basis }> = [];
  flat.forEach((l, i) => {
    const m = START.exec(l);
    if (m && l.length < 90 && flat.slice(i + 1, i + 9).some((n) => TABLE_START.test(n))) out.push({ at: i, basis: m[1]?.toLowerCase() as Basis | undefined });
  });
  return out;
}

const flatLines = (text: string) => text.split(/\r?\n/).map((l) => tidyLine(l).replace(/ ?\| ?/g, " ").replace(/ +/g, " ").trim());

/** Which of Consolidated / Standalone the document has statements for, in the order they appear. */
export function statementBases(text: string): Basis[] {
  return [...new Set(statementStarts(flatLines(text)).map((s) => s.basis).filter((b): b is Basis => !!b))];
}

export function statementRegion(text: string, basis?: Basis): string {
  // PDF rows join cells with " | " ("Consolidated | Statement of Cash Flows"): compare without them.
  const lines = text.split(/\r?\n/);
  const flat = flatLines(text);
  const END = /^(?:(?:consolidated|standalone)\s+)?(?:statements?\s+of\s+(?:cash\s+flows?|changes\s+in\s+equity)|cash\s+flow\s+statement|notes?\s+(?:to|forming)\b)|^note(?:\s+no\.?)?\s+(?:\d|31|particulars)|^significant\s+accounting\s+policies$|^1\.?\s*(?:corporate|company|general)\s+information/i;
  const starts = statementStarts(flat);
  // A document with both sets of statements: take the one asked for, else the first.
  const chosen = (basis && starts.find((s) => s.basis === basis)) || starts[0];
  if (!chosen) return text;
  const start = chosen.at;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (END.test(flat[i])) { end = i; break; }
  return lines.slice(start, end).join("\n");
}

/** "(Rs. in thousands)" and friends: amounts are not rupees, and the report should say so. */
export function statementUnit(text: string): string | undefined {
  const m = text.match(/\((?:rs\.?|₹|inr|amounts?)?\s*in\s+(thousands?|lakhs?|lacs?|crores?|millions?)\)/i)
    ?? text.match(/(?:₹|rs\.?|inr)\s*(thousands?|lakhs?|lacs?|crores?|millions?)\b/i);
  return m?.[1]?.toLowerCase();
}

/**
 * Lines of statement text -> label/amount pairs: the label is the text, the
 * amount is the first number after it (the current-year column when a
 * statement shows several years).
 */
export function parseStatementLines(text: string): LineItem[] {
  const items: LineItem[] = [];
  // A long label that wrapped onto two lines: "Cash Credit" / "from Bank   300".
  let pending: string | null = null;
  const tracker = headingTracker();
  const push = (...found: LineItem[]) => {
    if (pending && found.length === 1 && CONTINUATION.test(found[0].name)) found = [{ ...found[0], name: `${pending} ${found[0].name}` }];
    pending = null;
    items.push(...tracker.stamp(found));
  };
  // "(77) | (71)" then "Loss for the year": the label comes on the next row. Only a result line is paired
  // this way - a bare subtotal followed by a section heading must not become one item.
  let orphan: string[] | null = null;
  const RESULT_LABEL = /^(?:net\s+)?(?:profit|loss)(?:\s*\/\s*(?:profit|loss))?\s+(?:for|after|before)\b/i;
  const noteLabelOnly = (line: string, cells: string[] = [line]) => {
    if (orphan && RESULT_LABEL.test(cleanLabel(line))) {
      const it = rowToItem([cleanLabel(line), ...orphan]);
      orphan = null;
      if (it) { push(it); return; }
    }
    orphan = null;
    tracker.note(cells);
    pending = hasWords(line) && !/\d/.test(line) && line.length <= 60 ? cleanLabel(line) : null;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = tidyLine(raw);
    if (!line || line.startsWith("---")) continue;

    if (line.includes("|") || line.includes("\t")) {
      const cells = line.split(/\s*[|\t]\s*/).map((c) => c.trim()).filter(Boolean);
      const found = rowToItems(cells);
      if (found.length) { orphan = null; push(...found); }
      else if (cells.length && cells.every(isAmountCell)) orphan = cells;
      else noteLabelOnly(cells.join(" "), cells);
      continue;
    }

    const tokens = line.replace(NOTE_REF_IN_LABEL, " ").trim().split(/\s+/);
    while (tokens.length && /^(?:dr|cr)\.?$/i.test(tokens[tokens.length - 1])) tokens.pop(); // "250 Dr"
    let end = tokens.length;
    while (end > 0 && isAmountCell(tokens[end - 1])) end--;
    if (end === tokens.length) { noteLabelOnly(line); continue; } // no trailing amount
    const label = cleanLabel(tokens.slice(0, end).join(" "));
    const amount = pickAmount(tokens.slice(end), label);
    if (amount === undefined || !hasWords(label) || SIGNATURE_LINE.test(label)) continue;
    push({ name: label, value: isLess(tokens.slice(0, end).join(" ")) ? -Math.abs(parseAmount(amount)) : parseAmount(amount) });
  }
  return items;
}

export interface Totals {
  totalAssets?: number
  totalLiabilities?: number
  totalEquity?: number
}

export interface Sectioned {
  assets: BalanceSection[]
  liabilities: BalanceSection[]
  equity: BalanceSection[]
  totals: Totals
  /** Profit-and-loss lines, kept out of the balance sheet (interest on a loan is not a loan). */
  income: LineItem[]
  /** Lines we could not place - kept out of the sections rather than guessed. */
  unclassified: LineItem[]
}

// Order matters: specific "this is an asset" cases first, because their words
// (capital, loans, advances) would otherwise read as equity/liabilities.
const ASSET_OVERRIDE = /capital\s+work|work[-\s]in[-\s]progress|\bwip\b|capital\s+advances|loans?\s*(?:and|&)\s*advances|loans?\s+to\b|advances?\s+(?:to|recoverable|paid)|deposits?\s+with|security\s+deposits?|prepaid|advance\s+tax|deferred\s+tax\s+assets?|net\s+block|due\s+from|(?:tds|gst|input\s+tax)\s+(?:receivable|credit|recoverable)|input\s+(?:tax\s+)?credit|balances?\s+with/i;
const LIABILITY = /liabilit|payable|creditor|overdraft|\bod\b|\bcc\b|\bwcdl\b|borrowing|\bdebts?\b|debenture|\bloans?\b|provisions?|outstanding\s+expenses|advances?\s+from|customer\s+advances?|deposits?\s+(?:received|from)|cash\s+credit|bills?\s+(?:discounted|payable)|acceptances?|\bdue\s+to\b|duties\s*(?:and|&)\s*taxes|statutory\s+dues|interest\s+accrued|accrued\s+(?:expenses|interest|liabilit)|unearned|proposed\s+dividend|obligations?|gratuity|hire\s+purchase|lease\s+(?:rent\s+)?(?:liabilit|obligation)|unsecured|secured/i;
const EQUITY = /equity|capital|reserves?|surplus|\bshares?\b|net\s*worth|proprietor|retained|securities\s+premium|calls?\s+in\s+arrears|drawings|current\s+account|p\s*&\s*l\s*(?:a\/c|account)|profit\s*(?:and|&)\s*loss\s*(?:a\/c|account)|^(?:net\s+)?profit\b|profit\s+for\s+the\s+(?:year|period)|paid[-\s]?up|revaluation|owner/i;
const ASSET = /asset|cash|bank|receivable|debtor|inventor|\bstock|stores|spares|raw\s+materials?|finished\s+goods|consumables?|investment|goodwill|\bland\b|building|plant|machiner|furniture|fixtures?|vehicle|equipment|computers?|\bdeposits?\b|\badvances?\b|gold|trademark|patent|software|\bfdr?\b|fixed\s+deposit|margin\s+money|accrued\s+income|miscellaneous\s+expenditure|preliminary|pre[-\s]operative|right[-\s]of[-\s]use|intangible|tangible|\bsundry\b/i;

const TOTAL_ASSETS = /^(?:grand\s+)?total(?:\s+of)?\s+(?:assets|application\s+of\s+funds|funds\s+applied)\b|^assets\s+total\b/i;
const TOTAL_LIABILITIES = /^(?:grand\s+)?total\s+(?:(?:equity|capital|shareholders?[’']?s?[’']?\s*funds?)\s*(?:and|&)\s*)?liabilit|^total\s+sources\s+of\s+funds|^total\s+funds\s+employed|^liabilities\s+total\b/i;
const TOTAL_EQUITY = /^(?:(?:tangible\s+)?net\s*worth|total\s+(?:shareholders?[’']?s?[’']?\s*(?:funds?|equity)|(?:owners?|proprietors?|partners?)[’']?s?[’']?\s*(?:funds?|capital|equity)|equity|(?:tangible\s+)?net\s*worth))\b/i;
const ANY_TOTAL = /^(?:total(?!\s+outstanding)|sub[-\s]?total|grand\s+total)\b/i;
/** Group sums that carry no "Total" prefix: counting them next to their own lines double counts. */
const SUBTOTAL_NAME = /^(?:(?:non[-\s]?)?current\s+(?:assets?|liabilit(?:y|ies))(?:\s*(?:,|and|&)\s*(?:loans?\s*(?:and|&)\s*advances|provisions))?|shareholders?[’']?s?[’']?\s*(?:funds?|equity))$/i;

/** Ratios and percentages sit beside the statement but are not amounts in it. */
const RATIO_LINE = /\bratio\b|\bper\s*cent\b|\bdays\b|\bcoverage\b|\bmargin\b(?!\s*money)|\b(?:ROE|ROCE|ROA|DSCR|ISCR|EBITDA\s+margin)\b|%|net\s+working\s+capital|net\s+current\s+assets?|working\s+capital\s+gap|\breturn\s+on\b/i;

// Profit-and-loss lines. Matched by name only when no balance-sheet heading says
// otherwise ("Interest Accrued" under Liabilities stays a liability).
const PL_NAME = /^(?:net\s+|gross\s+)?(?:sales|revenue|turnover)\b|revenue\s+from\s+operations|\bother\s+income|^(?:interest|dividend)\s+(?:income|received|earned)|cost\s+of\s+(?:goods|materials?|sales|revenue|production)|^purchases?\b|raw\s+materials?\s+consumed|^(?:less:?\s*)?(?:depreciation|amorti[sz]ation)|^interest\s+(?:on|paid|expense|and\s+finance|charges)|finance\s+costs?|gross\s+(?:profit|loss)|profit\s+(?:before|after)\b|\b(?:pbt|pat)\b|^net\s+(?:profit|loss|income)|operating\s+(?:profit|loss)|\bebit(?:da)?\b|tax\s+expense|^current\s+tax|^total\s+tax|employee\s+benefit\s+expense|^salaries\s+(?:and|&)\s+wages|^total\s+(?:income|revenue|expenses?|expenditure)/i;

type Side = "assets" | "liabilities" | "equity";
const SPECIFIC_SIDE: Partial<Record<Group, Side>> = {
  "current-asset": "assets", "noncurrent-asset": "assets",
  "current-liability": "liabilities", "noncurrent-liability": "liabilities", borrowing: "liabilities", equity: "equity",
};
const GENERIC_SIDE: Partial<Record<Group, Side>> = { asset: "assets", liability: "liabilities" };

/** Place each line into a section, pull out explicit totals, never double count them. */
export function buildSections(items: LineItem[]): Sectioned {
  const out: Sectioned = { assets: [], liabilities: [], equity: [], totals: {}, income: [], unclassified: [] };
  let combined = false;

  for (const it of items) {
    const name = it.name.trim();
    const g = it.heading;
    const plHeading = g === "income" || g === "expense";
    const inBalanceSheet = !!g && !plHeading;
    const place = (side: Side) => out[side].push({ name, amount: it.value, ...(g ? { group: g } : {}) });

    if (RATIO_LINE.test(name)) continue;
    if (TOTAL_ASSETS.test(name)) { out.totals.totalAssets = it.value; continue; }
    if (TOTAL_LIABILITIES.test(name)) {
      // "Total Equity and Liabilities" (= total assets) is the tie-out; a plain "Total Liabilities" only fills in when it is absent.
      if (/(?:equity|capital|funds?)\s*(?:and|&)\s*liabilit/i.test(name)) { out.totals.totalLiabilities = it.value; combined = true; }
      else if (!combined) out.totals.totalLiabilities = it.value;
      continue;
    }
    if (TOTAL_EQUITY.test(name)) { out.totals.totalEquity = it.value; continue; }
    if (plHeading || (!inBalanceSheet && PL_NAME.test(name))) { out.income.push(it); continue; }
    if (/^(?:grand\s+)?total$/i.test(name) && g) {
      // A bare "Total" closes the liabilities side or the assets side: the heading above says which.
      if (SPECIFIC_SIDE[g] === "assets" || g === "asset") out.totals.totalAssets ??= it.value;
      else if (SPECIFIC_SIDE[g] || g === "liability") { out.totals.totalLiabilities ??= it.value; combined = true; }
      continue;
    }
    if (ANY_TOTAL.test(name)) continue; // subtotal: its parts are already counted

    const specific = g && SPECIFIC_SIDE[g];
    if (specific) place(specific);
    else if (ASSET_OVERRIDE.test(name)) place("assets");
    else if (LIABILITY.test(name)) place("liabilities");
    else if (EQUITY.test(name)) place("equity");
    else if (ASSET.test(name)) place("assets");
    else if (g && GENERIC_SIDE[g]) place(GENERIC_SIDE[g]!);
    else out.unclassified.push(it);
  }

  // "Current Assets 1,000" printed under its own lines is a subtotal, not a line.
  for (const side of ["assets", "liabilities", "equity"] as const) {
    const rows = out[side];
    if (rows.some((r) => !SUBTOTAL_NAME.test(r.name ?? ""))) out[side] = rows.filter((r) => !SUBTOTAL_NAME.test(r.name ?? ""));
  }
  return out;
}

const firstMatch = (xs: LineItem[], re: RegExp, not?: RegExp) => xs.find((x) => re.test(x.name) && !(not && not.test(x.name)))?.value;

/**
 * P&L lines -> the income-statement keys the calculators read. Finance cost
 * lines are summed (interest on term loan + on cash credit); everything else
 * takes the first line that matches. Undefined when no P&L was found.
 */
export function buildIncomeStatement(lines: LineItem[]): IncomeStatement | undefined {
  if (!lines.length) return undefined;
  const is: IncomeStatement = {};
  const set = (k: string, v: number | undefined) => { if (v !== undefined) is[k] = v; };
  const INTEREST = /^interest\s+(?:on|paid|expense|and\s+finance|charges)|finance\s+costs?|bank\s+interest/i;
  const interest = lines.filter((l) => INTEREST.test(l.name));

  set("revenue", firstMatch(lines, /^(?:net\s+)?(?:sales|revenue|turnover)\b|revenue\s+from\s+operations|^sale\s+of|gross\s+receipts/i, /^total/i));
  set("totalIncome", firstMatch(lines, /^total\s+(?:income|revenue)/i));
  set("totalExpenses", firstMatch(lines, /^total\s+(?:expenses?|expenditure)/i));
  set("otherIncome", firstMatch(lines, /\bother\s+income/i));
  set("costOfSales", firstMatch(lines, /cost\s+of\s+(?:goods|materials?|sales|revenue|production)|^purchases?\b|raw\s+materials?\s+consumed/i));
  set("grossProfit", firstMatch(lines, /gross\s+(?:profit|loss)/i));
  set("depreciation", firstMatch(lines, /depreciation|amorti[sz]ation/i, /accumulated/i));
  if (interest.length) is.interestExpense = interest.reduce((s, l) => s + l.value, 0);
  set("profit before tax", firstMatch(lines, /profit\s+before\s+tax|\bpbt\b|profit\s+before\s+taxation/i));
  set("net profit", firstMatch(lines, /^net\s+(?:profit|loss|income)|profit\s+after\s+tax(?:ation)?|\bpat\b|profit\s+for\s+the\s+(?:year|period)/i));
  set("operating profit", firstMatch(lines, /operating\s+(?:profit|loss)/i));
  set("ebitda", firstMatch(lines, /\bebitda\b/i));
  set("ebit", firstMatch(lines, /\bebit\b/i));
  set("tax", firstMatch(lines, /^total\s+tax/i) ?? firstMatch(lines, /tax\s+expense|^current\s+tax|provision\s+for\s+(?:income\s+)?tax/i));

  // Fill what a template leaves out from what it does give.
  if (is.revenue === undefined && is.totalIncome !== undefined) is.revenue = is.totalIncome - (is.otherIncome ?? 0);
  if (is["profit before tax"] === undefined) {
    if (is.totalIncome !== undefined && is.totalExpenses !== undefined) is["profit before tax"] = is.totalIncome - is.totalExpenses;
    else if (is["net profit"] !== undefined && is.tax !== undefined) is["profit before tax"] = is["net profit"] + is.tax;
    // A proprietorship / partnership account shows no tax: its net profit is the profit before tax.
    else if (is["net profit"] !== undefined) is["profit before tax"] = is["net profit"];
  }
  if (is.ebit === undefined && is["profit before tax"] !== undefined) is.ebit = is["profit before tax"] + (is.interestExpense ?? 0);
  return Object.keys(is).length ? is : undefined;
}

// Current/non-current drives the liquidity ratios. A heading from the file wins;
// otherwise the words decide, checking "long-term"/"non-current" before "current".
const NONCURRENT_ASSET = /non[-\s]?current|long[-\s]?term|fixed\s+assets?|capital\s+work|capital\s+advances?|net\s+block|goodwill|intangible/i;
const CURRENT_ASSET = /cash|bank|receivable|debtor|inventor|\bstock|stores|spares|raw\s+materials?|finished\s+goods|work[-\s]in|consumables?|loans?\s*(?:and|&)\s*advances|advances?\s+(?:to|recoverable|paid)|prepaid|advance\s+tax|\btds\b|\bgst\b|input\s+(?:tax\s+)?credit|accrued\s+income|other\s+current|current\s+(?:assets?|investments?)|\bfdr?\b|fixed\s+deposit|margin\s+money|balances?\s+with|marketable|due\s+from|\bsundry\b/i;
const WORKING_CAPITAL_DEBT = /overdraft|\bod\b|cash\s*credit|\bcc\b|\bwcdl\b|bills?\s*(?:discounted|payable)/i;
const CURRENT_EXPLICIT_LIAB = /current\s+maturit|current\s+portion|short[-\s]?term/i;
const NONCURRENT_LIAB = /non[-\s]?current|long[-\s]?term|term\s+loans?|debentures?|\bbonds?\b|deferred\s+tax|unsecured|secured\s+loans?|loans?\s+from\s+(?:director|partner|relative|promoter|shareholder)|hire\s+purchase|gratuity|\bncd\b|preference|subordinated|vehicle\s+loan|car\s+loan|home\s+loan/i;
const CURRENT_LIAB = /current|payable|creditor|overdraft|\bod\b|\bcc\b|cash\s*credit|\bwcdl\b|working\s*capital|bills?\s*(?:payable|discounted)|acceptances?|provision|outstanding|accrued|advances?\s+from|customer\s+advances?|unearned|duties|statutory|\btax\b|\bdues\b|proposed\s+dividend|\bgst\b|\btds\b|salar|wages|expenses/i;

export function isCurrentAsset(s: BalanceSection): boolean {
  if (s.group === "current-asset") return true;
  if (s.group === "noncurrent-asset") return false;
  const n = s.name ?? "";
  return !NONCURRENT_ASSET.test(n) && CURRENT_ASSET.test(n);
}

export function isCurrentLiability(s: BalanceSection): boolean {
  if (s.group === "current-liability") return true;
  const n = s.name ?? "";
  // Working-capital borrowings are short-term whatever heading they sit under ("Secured Loans").
  if (WORKING_CAPITAL_DEBT.test(n)) return true;
  if (s.group === "noncurrent-liability") return false;
  if (CURRENT_EXPLICIT_LIAB.test(n)) return true;
  return !NONCURRENT_LIAB.test(n) && CURRENT_LIAB.test(n);
}

const sum = (xs: BalanceSection[]) => xs.reduce((s, x) => s + (Number(x.amount) || 0), 0);
const within = (a: number, b: number, pct: number) => {
  const denom = Math.max(Math.abs(a), Math.abs(b));
  return denom === 0 ? true : Math.abs(a - b) / denom <= pct;
};

export interface ExtractionScore {
  confidence: number
  notes: string[]
}

/**
 * How far the extraction can be trusted, from what we can verify:
 *   0.15 base (something was read)
 *   +0.25 enough line items (12+ for full marks)
 *   +0.20 lines placed in assets / liabilities / equity (coverage x share classified)
 *   +0.35 total assets agree with total liabilities (or liabilities + equity) AND the
 *         asset lines add up to total assets (0.10 if only the totals agree, because
 *         two total rows can agree while every amount between them is wrong)
 *   +0.05 structured source (spreadsheet/CSV)
 * Capped at 0.95: an automatic reading is never certain.
 */
export function scoreExtraction(
  items: LineItem[],
  sections: Sectioned,
  opts: { structured?: boolean } = {},
): ExtractionScore {
  const notes: string[] = [];
  const lineCount = (xs: Array<{ amount?: number; value?: number }>) => xs.filter((x) => (x.amount ?? x.value ?? 0) !== 0).length;
  const n =
    lineCount(sections.assets) + lineCount(sections.liabilities) + lineCount(sections.equity) + lineCount(sections.unclassified);
  if (n === 0) return { confidence: 0.05, notes: ["No line items with amounts could be read from this file."] };

  let conf = 0.15 + 0.25 * Math.min(1, n / 12);
  // Contradictory figures cap the final score, whatever bonuses are added later.
  let cap = 0.95;
  if (n < 6) notes.push(`Only ${n} line item${n === 1 ? "" : "s"} with amounts ${n === 1 ? "was" : "were"} found.`);

  const placed = sections.assets.length + sections.liabilities.length + sections.equity.length;
  const share = placed / (placed + sections.unclassified.length || 1);
  const coverage = ([sections.assets, sections.liabilities, sections.equity].filter((s) => s.length > 0).length) / 3;
  conf += 0.2 * coverage * share;
  if (sections.unclassified.length > 0) notes.push(`${sections.unclassified.length} line(s) could not be classified and were left out.`);
  if (coverage < 1) notes.push("Not all of assets, liabilities and equity were found.");

  const { totalAssets: ta, totalLiabilities: tl, totalEquity: te } = sections.totals;
  const assetsSum = sum(sections.assets);
  const claimsSum = sum(sections.liabilities) + sum(sections.equity);
  const itemsMatchAssets = ta !== undefined && assetsSum !== 0 && within(assetsSum, ta, 0.03);

  if (ta !== undefined && tl !== undefined) {
    // Indian statements: "Total Liabilities" usually already includes equity.
    const totalsTie = within(ta, tl, 0.01) || (te !== undefined && within(ta, tl + te, 0.01));
    if (totalsTie && itemsMatchAssets) {
      conf += 0.35;
      notes.push("Total assets agree with total liabilities, and the line items add up to them.");
    } else if (totalsTie) {
      conf += 0.1;
      cap = 0.55;
      notes.push("The totals agree, but the line items do not add up to them - some lines may be missing or misclassified.");
    } else {
      conf += 0.05;
      cap = 0.45;
      notes.push("Total assets and total liabilities do not agree - check the figures.");
    }
  } else if (ta !== undefined || tl !== undefined) {
    conf += itemsMatchAssets ? 0.2 : 0.05;
    notes.push(itemsMatchAssets
      ? "Only one total was found, but the asset lines add up to it."
      : "Only one total was found, so the balance sheet could not be fully cross-checked.");
  } else if (assetsSum !== 0 && claimsSum !== 0 && within(assetsSum, claimsSum, 0.02)) {
    conf += 0.25;
    notes.push("Line items add up: assets equal liabilities plus equity.");
  } else {
    notes.push("No totals could be cross-checked, so the balance sheet is unverified.");
  }

  if (opts.structured) conf += 0.05;
  return { confidence: Math.round(Math.min(cap, conf) * 100) / 100, notes };
}

/**
 * Principal repaid in the year, from the cash flow statement ("Repayment of borrowings",
 * "Payment of lease liabilities", ...). The balance sheet and P&L do not show it, but debt
 * service coverage needs it. Undefined when the text has no cash flow statement or no such lines.
 */
export function principalRepayments(text: string): number | undefined {
  const lines = text.split(/\r?\n/).map((l) => tidyLine(l).replace(/ ?\| ?/g, " | ").replace(/ +/g, " ").trim());
  const flat = (l: string) => l.replace(/ ?\| ?/g, " ");
  const START = /^(?:(?:consolidated|standalone)\s+)?(?:statements?\s+of\s+cash\s+flows?|cash\s+flow\s+statement)\b/i;
  const END = /^(?:net\s+(?:increase|decrease)|closing\s+balance\s+of\s+cash|cash\s+and\s+cash\s+equivalents\s+(?:at|as\s+at)\s+(?:the\s+)?end)/i;
  const REPAYMENT = /^(?:repayments?|payments?)\s+of\b.*\b(?:borrowings?|loans?|lease\s+liabilit|deferred\s+payment|debentures?)/i;

  // Cash flow headings repeat (the page header, then the statement): use the first one that is followed by a repayment line.
  let total = 0;
  let found = false;
  for (let i = 0; i < lines.length && !found; i++) {
    if (!START.test(flat(lines[i]))) continue;
    for (let j = i + 1; j < Math.min(lines.length, i + 140); j++) {
      const line = flat(lines[j]);
      if (END.test(line)) break;
      if (!REPAYMENT.test(line) || /interest/i.test(line)) continue;
      const amount = parseStatementLines(lines[j])[0]?.value;
      if (typeof amount === "number" && amount !== 0) { total += Math.abs(amount); found = true; }
    }
  }
  return found ? total : undefined;
}
