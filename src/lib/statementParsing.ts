// Turning uploaded statement text into balance-sheet sections, and scoring how
// far the result can be trusted. Pure functions, no I/O.
//
// Replaces the old fixed 0.5/0.6/0.7 "confidence" constants: the score is built
// from things we can check (enough line items, lines classified, totals that
// agree AND are matched by the line items), and the notes say which.

import type { LineItem, BalanceSection } from "./parsedBalanceSheet";

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

/**
 * pdf.js text items -> one string per visual row (items sharing a baseline,
 * left to right, joined with " | "). Joining a whole page with spaces loses the
 * label/amount structure that statement parsing depends on.
 */
export function pdfItemsToRows(items: Array<{ str?: string; transform?: number[] }>): string[] {
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

/** Header/date lines whose first number is a year, not an amount. */
const DATE_LINE = /\b(?:as\s+at|as\s+on|year\s+ended|for\s+the\s+year|period\s+ended|march|september|december|june)\b/i;
const isYearLike = (s: string) => /^(?:19|20)\d{2}$/.test(s.trim());
/** A schedule/note reference ("3") sitting in a column before the amounts. */
const isNoteRef = (s: string) => /^\d{1,2}$/.test(s.trim());
const isBig = (s: string) => /[,.]/.test(s) || s.replace(/\D/g, "").length >= 3;

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

const cleanLabel = (label: string) => label.replace(NOTE_REF_IN_LABEL, " ").replace(/\s+/g, " ").replace(/[:.\-\s]+$/, "").trim();
const hasWords = (s: string) => /[A-Za-z]{3}/.test(s);

/** One row of cells (CSV/XLSX/docx/PDF) -> a line item: first text cell is the label. */
export function rowToItem(cells: string[], yearIdx: number | null = null): LineItem | null {
  const li = cells.findIndex((c) => hasWords(c) && !isAmountCell(c));
  if (li === -1) return null;
  const label = cleanLabel(cells[li]);
  if (!hasWords(label)) return null;

  let amount: string | undefined;
  if (yearIdx !== null && yearIdx > li && isAmountCell(cells[yearIdx] ?? "")) amount = cells[yearIdx];
  else amount = pickAmount(cells.slice(li + 1).filter(isAmountCell), label);
  if (amount === undefined) return null;
  return { name: label, value: parseAmount(amount) };
}

/** Index of the latest-year column in a header like "Particulars | 2024-25 | 2025-26", or null. */
export function yearColumnIndex(header: string[]): number | null {
  const years = header.map((c) => (c.match(/(?:19|20)\d{2}/) ? Number(c.match(/(?:19|20)\d{2}/)![0]) : NaN));
  const found = years.filter((y) => !isNaN(y));
  if (found.length < 2 || new Set(found).size < 2) return null;
  return years.indexOf(Math.max(...found));
}

/** Rows of cells -> line items, honouring a year header when there is one. */
export function itemsFromRows(rows: string[][]): LineItem[] {
  if (!rows.length) return [];
  const yearIdx = yearColumnIndex(rows[0]);
  const items: LineItem[] = [];
  for (const r of rows) {
    const it = rowToItem(r.map((c) => String(c ?? "").trim()), yearIdx);
    if (it) items.push(it);
  }
  return items;
}

/**
 * Lines of statement text -> label/amount pairs: the label is the text, the
 * amount is the first number after it (the current-year column when a
 * statement shows several years).
 */
export function parseStatementLines(text: string): LineItem[] {
  const items: LineItem[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("---")) continue;

    if (line.includes("|") || line.includes("\t")) {
      const it = rowToItem(line.split(/\s*[|\t]\s*/).map((c) => c.trim()).filter(Boolean));
      if (it) items.push(it);
      continue;
    }

    const tokens = line.replace(NOTE_REF_IN_LABEL, " ").trim().split(/\s+/);
    while (tokens.length && /^(?:dr|cr)\.?$/i.test(tokens[tokens.length - 1])) tokens.pop(); // "250 Dr"
    let end = tokens.length;
    while (end > 0 && isAmountCell(tokens[end - 1])) end--;
    if (end === tokens.length) continue; // no trailing amount
    const label = cleanLabel(tokens.slice(0, end).join(" "));
    const amount = pickAmount(tokens.slice(end), label);
    if (amount === undefined || !hasWords(label)) continue;
    items.push({ name: label, value: parseAmount(amount) });
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
  /** Lines we could not place - kept out of the sections rather than guessed. */
  unclassified: LineItem[]
}

// Order matters: specific "this is an asset" cases first, because their words
// (capital, loans, advances) would otherwise read as equity/liabilities.
const ASSET_OVERRIDE = /capital\s+work|work[-\s]in[-\s]progress|\bwip\b|capital\s+advances|loans?\s*(?:and|&)\s*advances|advances?\s+(?:to|recoverable)|deposits?\s+with|security\s+deposits?|prepaid|advance\s+tax|deferred\s+tax\s+assets?|net\s+block/i;
const LIABILITY = /liabilit|payable|creditor|overdraft|borrowing|\bdebts?\b|debenture|\bloans?\b|provisions?|outstanding\s+expenses|advances?\s+from|deposits?\s+(?:received|from)|cash\s+credit|bills?\s+(?:discounted|payable)|\bdue\s+to\b|duties\s*(?:and|&)\s*taxes|statutory\s+dues|interest\s+accrued|proposed\s+dividend|obligations?|gratuity/i;
const EQUITY = /equity|capital|reserves?|surplus|\bshares?\b|net\s*worth|proprietor|retained|securities\s+premium|calls?\s+in\s+arrears|drawings|current\s+account|p\s*&\s*l\s*(?:a\/c|account)|profit\s*(?:and|&)\s*loss\s*(?:a\/c|account)/i;
const ASSET = /asset|cash|bank|receivable|debtor|inventor|\bstock|investment|goodwill|\bland\b|building|plant|machinery|furniture|vehicle|equipment|\bdeposits?\b|\badvances?\b|gold|trademark|software/i;

const TOTAL_ASSETS = /^total\s+assets\b/i;
const TOTAL_LIABILITIES = /^total\s+(?:(?:equity|capital|shareholders?[’']?s?[’']?\s*funds?)\s*(?:and|&)\s*)?liabilit/i;
const TOTAL_EQUITY = /^(?:(?:tangible\s+)?net\s*worth|total\s+(?:shareholders?[’']?s?[’']?\s*(?:funds?|equity)|equity|(?:tangible\s+)?net\s*worth))\b/i;
const ANY_TOTAL = /^(?:total|sub[-\s]?total|grand\s+total)\b/i;

/** Place each line into a section, pull out explicit totals, never double count them. */
export function buildSections(items: LineItem[]): Sectioned {
  const out: Sectioned = { assets: [], liabilities: [], equity: [], totals: {}, unclassified: [] };

  for (const it of items) {
    const name = it.name.trim();
    const section = (): BalanceSection => ({ name, amount: it.value });

    if (TOTAL_ASSETS.test(name)) { out.totals.totalAssets = it.value; continue; }
    if (TOTAL_LIABILITIES.test(name)) { out.totals.totalLiabilities = it.value; continue; }
    if (TOTAL_EQUITY.test(name)) { out.totals.totalEquity = it.value; continue; }
    if (ANY_TOTAL.test(name)) continue; // subtotal: its parts are already counted

    if (ASSET_OVERRIDE.test(name)) out.assets.push(section());
    else if (LIABILITY.test(name)) out.liabilities.push(section());
    else if (EQUITY.test(name)) out.equity.push(section());
    else if (ASSET.test(name)) out.assets.push(section());
    else out.unclassified.push(it);
  }
  return out;
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
  if (n < 6) notes.push(`Only ${n} line item${n === 1 ? "" : "s"} with amounts were found.`);

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
      notes.push("The totals agree, but the line items do not add up to them - some lines may be missing or misclassified.");
    } else {
      conf += 0.05;
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
  return { confidence: Math.round(Math.min(0.95, conf) * 100) / 100, notes };
}
