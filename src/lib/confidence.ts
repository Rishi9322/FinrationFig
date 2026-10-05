// Honest confidence for document detection. Pure functions, no I/O.
//
// Why this exists: the CMA screen used to show whatever number the AI model
// guessed, judged from the first 4,000 characters of the file (often a cover
// page), and silently turned unusable replies into 0%. These helpers pick the
// text the model should actually see, parse its answer defensively, and blend
// it with checks we can verify ourselves.

export type SourceKind = "pdf" | "image" | "sheet" | "text";

/**
 * Evidence that text is a financial statement, one entry per concept. `strong`
 * terms are specific to statements; `weak` terms also appear in everyday prose
 * ("turnover of staff", "cheque", "inventory of books"), so they count for less
 * and can never carry the signal on their own.
 */
const EVIDENCE: Array<{ strong: RegExp; weak?: RegExp }> = [
  { strong: /balance\s*sheet|statement\s+of\s+assets\s+and\s+liabilities|equity\s+and\s+liabilities/i },
  {
    strong: /total\s+(?:current\s+)?assets|fixed\s+assets|tangible\s+assets|net\s+block|current\s+assets|sundry\s+debtors|trade\s+receivables?|loans?\s*(?:and|&)\s*advances|cash\s*(?:and|&)\s*cash\s+equivalents/i,
    weak: /inventor(?:y|ies)|stock[-\s]in[-\s]trade/i,
  },
  {
    strong: /total\s+(?:current\s+)?liabilities|current\s+liabilities|sundry\s+creditors|trade\s+payables?|term\s+loans?|secured\s+loans?|unsecured\s+loans?|bank\s+overdraft|cash\s+credit|provision\s+for\s+tax|loan\s+funds|(?:long|short)[-\s]term\s+borrowings?/i,
    weak: /borrowings/i,
  },
  {
    strong: /share\s+capital|reserves?\s*(?:and|&)\s*surplus|capital\s+reserve|shareholders'?\s*funds?|total\s+equity|partner'?s?'?\s*capital|owner'?s?\s*capital/i,
    weak: /net\s*worth|proprietor|capital\s+account/i,
  },
  { strong: /profit\s*(?:and|&)\s*loss|\bP\s*&\s*L\b|income\s+statement|statement\s+of\s+profit|trading\s+account/i },
  {
    strong: /revenue\s+from\s+operations|net\s+sales|gross\s+sales|total\s+income|total\s+expenses|cost\s+of\s+sales/i,
    weak: /turnover|revenue|\bsales\b|other\s+income/i,
  },
  {
    strong: /cost\s+of\s+(?:goods|materials)|employee\s+benefit|finance\s+costs?|interest\s+expense|gross\s+profit/i,
    weak: /purchases|depreciation/i,
  },
  { strong: /net\s+profit|profit\s+(?:before|after)\s+tax|loss\s+before\s+tax|\bPBT\b|\bPAT\b|\bEBITDA\b/i },
  {
    strong: /credit\s+monitoring|\bMPBF\b|drawing\s+power|working\s+capital\s+limit/i,
    weak: /\bCMA\b/i,
  },
  { strong: /statement\s+of\s+account|\b(?:NEFT|RTGS|IMPS|IFSC)\b/i },
  {
    // Both ends of a running balance close together is a ledger/statement, not prose.
    strong: /opening\s+balance[\s\S]{0,2000}closing\s+balance|closing\s+balance[\s\S]{0,2000}opening\s+balance/i,
    weak: /narration|cheque|withdrawals?|\bdr\b/i,
  },
];

/** Weak evidence can contribute at most this much in total (in "concepts"). */
const WEAK_CAP = 1;
/** Concepts needed for full marks - e.g. a typical balance sheet hits four. */
const FULL_MARKS = 4;

/** Distinct concepts with strong evidence, plus (capped) weak evidence. */
export function countEvidence(text: string): number {
  let strong = 0;
  let weak = 0;
  for (const e of EVIDENCE) {
    if (e.strong.test(text)) strong += 1;
    else if (e.weak && e.weak.test(text)) weak += 0.5;
  }
  return strong + Math.min(weak, WEAK_CAP);
}

/** 0..1 */
export function financialSignal(text: string): number {
  return Math.min(1, countEvidence(text) / FULL_MARKS);
}

/** Accepts 0.85, 85, "85%", "0.85", "high"... Returns null when unusable. */
export function parseModelConfidence(value: unknown): number | null {
  if (typeof value === "number") return normalise(value);
  if (typeof value !== "string") return null;
  const s = value.trim().toLowerCase();
  if (s === "high") return 0.85;
  if (s === "medium" || s === "moderate") return 0.6;
  if (s === "low") return 0.3;
  const n = Number.parseFloat(s.replace("%", ""));
  if (!Number.isFinite(n)) return null;
  return normalise(s.includes("%") ? n / 100 : n);
}

function normalise(n: number): number | null {
  if (!Number.isFinite(n) || n < 0) return null;
  if (n <= 1) return n;
  if (n <= 100) return n / 100; // a bare 85 means 85%
  return null;
}

/** Models sometimes answer "false"/"no" as text; Boolean("false") is true. */
export function parseBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true" || s === "yes") return true;
    if (s === "false" || s === "no") return false;
  }
  return null;
}

// One pass over the text finds every evidence term (a regex per concept would
// re-scan megabytes of text). Weak terms are found separately so they weigh less.
const joined = (key: "strong" | "weak") =>
  new RegExp(EVIDENCE.map((e) => e[key]?.source).filter(Boolean).join("|"), "gi");

function findHits(text: string): Array<{ pos: number; weight: number }> {
  const MAX_HITS = 5000;
  const hits: Array<{ pos: number; weight: number }> = [];
  for (const [key, weight] of [["strong", 2], ["weak", 1]] as const) {
    const re = joined(key);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) && hits.length < MAX_HITS) {
      hits.push({ pos: m.index, weight });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return hits.sort((a, b) => a.pos - b.pos);
}

const GAP = "\n...\n";

/**
 * The slice of text to show the classifier. Financial statements are rarely on
 * page one, so take character windows around evidence terms (best-supported
 * first) within the budget; fall back to head + tail when nothing matches.
 * Windows are measured in characters, so a huge single line (pdf.js often joins
 * a page with spaces) still yields the part that contains the statement.
 */
export function selectFinancialExcerpt(text: string, maxChars = 4000): string {
  if (maxChars <= 0) return "";
  if (text.length <= maxChars) return text;

  const hits = findHits(text);
  if (hits.length === 0) {
    const head = Math.max(0, Math.floor((maxChars - GAP.length) * 0.8));
    const tail = Math.max(0, maxChars - GAP.length - head);
    return `${text.slice(0, head)}${GAP}${tail ? text.slice(-tail) : ""}`.slice(0, maxChars);
  }

  const half = Math.max(30, Math.min(500, Math.floor(maxChars / 6)));
  type Win = { from: number; to: number; weight: number; first: number };
  const wins: Win[] = [];
  for (const h of hits) {
    const from = Math.max(0, h.pos - half);
    const to = Math.min(text.length, h.pos + half);
    const last = wins[wins.length - 1];
    if (last && from <= last.to) {
      last.to = Math.max(last.to, to);
      last.weight += h.weight;
    } else wins.push({ from, to, weight: h.weight, first: h.pos });
  }

  const chosen: Win[] = [];
  let remaining = maxChars;
  for (const w of [...wins].sort((a, b) => b.weight - a.weight)) {
    const size = w.to - w.from;
    const need = size + (chosen.length ? GAP.length : 0);
    if (need <= remaining) {
      chosen.push(w);
      remaining -= need;
    } else if (chosen.length === 0) {
      // Even the best window exceeds the budget: keep a slice centred on a hit.
      const len = maxChars;
      const from = Math.max(0, Math.min(w.first - Math.floor(len / 2), text.length - len));
      return text.slice(from, from + len);
    }
  }
  chosen.sort((a, b) => a.from - b.from);
  return chosen.map((w) => text.slice(w.from, w.to)).join(GAP);
}

export interface TextQuality {
  chars: number
  /** So little text came out that a PDF/image is probably a scan or photo. */
  likelyScanned: boolean
  /** A spreadsheet/text file with essentially nothing in it. */
  empty: boolean
}

/**
 * Only PDFs and images can be "scans". A 6-row CSV or sheet is short but valid,
 * so sheets/text are only ever flagged when genuinely empty. Real statement
 * vocabulary in the text also overrides a scan guess.
 */
export function assessText(text: string, opts: { source?: SourceKind; pages?: number } = {}): TextQuality {
  const chars = text.replace(/\s+/g, "").length;
  const source = opts.source ?? (opts.pages !== undefined ? "pdf" : "text");
  const empty = chars < 20;

  let likelyScanned = false;
  if (source === "pdf" || source === "image") {
    const pages = opts.pages;
    likelyScanned = pages && pages > 0 ? chars / pages < 80 : chars < 120;
    if (likelyScanned && countEvidence(text) >= 2) likelyScanned = false;
  }
  return { chars, likelyScanned, empty: !likelyScanned && empty };
}

export interface ScoredClassification {
  isFinancialDocument: boolean
  docType: string
  confidence: number
  reason: string
  /** Why the number is what it is - shown to the user. */
  reasons: string[]
  /** The model's own figure, kept for debugging; null if it gave none. */
  modelConfidence: number | null
  likelyScanned: boolean
}

/**
 * Blend the model's answer with what we can verify: how much text there is and
 * how many financial-statement markers it contains.
 */
export function scoreClassification(
  model: { isFinancialDocument?: unknown; docType?: unknown; confidence?: unknown; reason?: unknown } | null,
  fullText: string,
  opts: { source?: SourceKind; pages?: number } = {},
): ScoredClassification {
  const quality = assessText(fullText, opts);
  const signal = financialSignal(fullText);
  const modelConf = parseModelConfidence(model?.confidence);
  const reasons: string[] = [];

  const modelSaysFinancial = model ? parseBool(model.isFinancialDocument) : null;
  const isFinancial = modelSaysFinancial ?? signal >= 0.5;
  let confidence: number;

  if (quality.likelyScanned) {
    confidence = Math.min(0.2, modelConf ?? 0.2);
    reasons.push("Almost no readable text was found - this looks like a scanned image. Upload a text-based PDF or an Excel/CSV file for reliable extraction.");
  } else if (quality.empty) {
    confidence = 0.1;
    reasons.push("The file contains almost no text.");
  } else if (!model) {
    // Without the model we only know how financial it looks.
    confidence = (isFinancial ? signal : 1 - signal) * 0.7;
    reasons.push("The AI classifier was unavailable, so this is based on keyword checks only.");
  } else if (isFinancial) {
    confidence = modelConf === null ? signal * 0.8 : 0.5 * modelConf + 0.5 * signal;
    if (modelConf === null) reasons.push("The AI gave no usable confidence figure; showing keyword-based confidence.");
    if (signal < 0.5) reasons.push("Few financial-statement terms were found in the extracted text.");
  } else {
    confidence = modelConf ?? 0.5;
    if (signal >= 0.6) {
      confidence = Math.min(confidence, 0.4);
      reasons.push("The text contains many financial-statement terms, so the 'not financial' result is doubtful.");
    }
  }

  confidence = Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100;

  return {
    isFinancialDocument: isFinancial,
    docType: model?.docType ? String(model.docType) : isFinancial ? "Other Financial Statement" : "Unknown",
    confidence,
    reason: [model?.reason ? String(model.reason) : "", ...reasons].filter(Boolean).join(" "),
    reasons,
    modelConfidence: modelConf,
    likelyScanned: quality.likelyScanned,
  };
}

/**
 * Text for the extraction prompt: keep the head (company name, unit, period
 * usually live there) and fill the rest of the budget with the statement pages.
 */
export function selectExtractionText(text: string, budget = 22000, headChars = 1500): string {
  if (text.length <= budget) return text;
  const head = text.slice(0, headChars);
  return `${head}${GAP}${selectFinancialExcerpt(text.slice(headChars), budget - headChars - GAP.length)}`;
}
