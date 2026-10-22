// An uploaded JSON file that already looks like a parsed statement is user input like any other.
// Rebuild it from scratch with only the shapes the report can safely read: lists of {name, amount},
// finite numbers, known fields. Nothing from the file is spread into the result, so odd keys
// ("__proto__", "constructor") cannot ride along.

import type ParsedBalanceSheet from "./parsedBalanceSheet";
import type { BalanceSection, Group, IncomeStatement, ReceivableItem } from "./parsedBalanceSheet";

const GROUPS = new Set<string>([
  "asset", "current-asset", "noncurrent-asset", "liability", "current-liability", "noncurrent-liability", "borrowing", "equity", "income", "expense",
]);
const MAX_ITEMS = 5000;
const MAX_TEXT = 300;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): number | undefined => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v.replace(/,/g, "")) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};
const text = (v: unknown) => (typeof v === "string" ? v.slice(0, MAX_TEXT) : undefined);

function sections(v: unknown): BalanceSection[] {
  if (!Array.isArray(v)) return [];
  const out: BalanceSection[] = [];
  for (const row of v.slice(0, MAX_ITEMS)) {
    if (!isObject(row)) continue;
    const amount = finite(row.amount);
    if (amount === undefined) continue;
    const item: BalanceSection = { amount };
    const name = text(row.name);
    if (name !== undefined) item.name = name;
    if (typeof row.group === "string" && GROUPS.has(row.group)) item.group = row.group as Group;
    out.push(item);
  }
  return out;
}

function numbers(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObject(v)) return out;
  for (const [k, raw] of Object.entries(v).slice(0, 200)) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
    const n = finite(raw);
    if (n !== undefined) out[k.slice(0, MAX_TEXT)] = n;
  }
  return out;
}

function receivables(v: unknown): ReceivableItem[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: ReceivableItem[] = [];
  for (const row of v.slice(0, MAX_ITEMS)) {
    if (!isObject(row)) continue;
    const amount = finite(row.amount);
    const days = finite(row.daysOutstanding);
    if (amount === undefined || days === undefined) continue;
    const item: ReceivableItem = { amount, daysOutstanding: days };
    const debtor = text(row.debtorName);
    if (debtor !== undefined) item.debtorName = debtor;
    out.push(item);
  }
  return out;
}

/** True when the object claims to be a parsed statement (has a balanceSheet object). */
export const looksParsed = (obj: unknown): obj is Record<string, unknown> => isObject(obj) && isObject(obj.balanceSheet);

export function sanitizeParsed(obj: Record<string, unknown>, base: { name: string; parsedAt: string }): ParsedBalanceSheet {
  const bs = obj.balanceSheet as Record<string, unknown>;
  const totalsIn = numbers(bs.totals);
  const totals: NonNullable<ParsedBalanceSheet["balanceSheet"]["totals"]> = {};
  for (const k of ["totalAssets", "totalLiabilities", "totalEquity"] as const) if (k in totalsIn) totals[k] = totalsIn[k];

  const meta = isObject(obj.metadata) ? obj.metadata : {};
  const confidence = finite(meta.confidence);
  const income = numbers(obj.incomeStatement) as IncomeStatement;

  return {
    sourceFilename: base.name,
    originalFormat: "json",
    parsedAt: base.parsedAt,
    balanceSheet: { assets: sections(bs.assets), liabilities: sections(bs.liabilities), equity: sections(bs.equity), totals },
    ...(Object.keys(income).length ? { incomeStatement: income } : {}),
    ...(receivables(obj.receivables) ? { receivables: receivables(obj.receivables) } : {}),
    metadata: {
      confidence: confidence === undefined ? undefined : Math.min(1, Math.max(0, confidence)),
      notes: text(meta.notes),
      unit: text(meta.unit),
    },
  };
}
