// Builds src/data/peerBenchmarks.json: per-industry distributions of four credit
// ratios for ~4,600 listed Indian companies, so a borrower can be placed against peers.
//
// Source: Kaggle "Financial Sheets Dataset" (pacificrm/financial-sheets), CC0 public domain.
//   python -m kaggle datasets download pacificrm/financial-sheets -p scratch/kaggle/financial-sheets --unzip
//   node scripts/build-peer-benchmarks.mjs [folder holding Balance_Sheet_final.csv and Annual_P_L_1_final.csv]
//
// Ratios (all unit-free, so the file's crore/lakh unit does not matter):
//   de   Debt / (Equity capital + Reserves)      lower is better
//   cr   Current assets / Current liabilities    higher is better
//   icr  EBIT / Interest                         higher is better
//   opm  Operating profit margin, %              higher is better
import fs from "node:fs";
import path from "node:path";

const DIR = process.argv[2] ?? "scratch/kaggle/financial-sheets/dataset/dataset";
const MIN_PEERS = 15; // an industry needs this many companies with the ratio to get its own distribution
const POINTS = 21; // quantiles at 0, 5, ... 100
const FINANCIAL = /bank|financ|insur/i; // balance sheets of lenders are not comparable with operating companies

/** CSV with quoted fields. */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  return body.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}
const load = (f) => parseCsv(fs.readFileSync(path.join(DIR, f), "utf8"));
const num = (v) => (v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

const bs = load("Balance_Sheet_final.csv");
const pl = new Map(load("Annual_P_L_1_final.csv").map((r) => [r.Name, r]));

function ratios(b) {
  const p = pl.get(b.Name);
  const out = {};
  const debt = num(b.Debt), eq = num(b["Equity capital"]), res = num(b.Reserves);
  if (debt !== null && eq !== null && res !== null && eq + res > 0) out.de = debt / (eq + res);
  const ca = num(b["Current assets"]), cl = num(b["Current liabilities"]);
  if (ca !== null && cl !== null && cl > 0) out.cr = ca / cl;
  if (p) {
    const ebit = num(p.EBIT), interest = num(p.Interest), opm = num(p.OPM);
    if (ebit !== null && interest !== null && interest > 0) out.icr = ebit / interest;
    if (opm !== null) out.opm = opm;
  }
  return out;
}

function quantiles(values) {
  const v = [...values].sort((a, b) => a - b);
  return Array.from({ length: POINTS }, (_, i) => {
    const pos = (i / (POINTS - 1)) * (v.length - 1);
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return Math.round((v[lo] + (v[hi] - v[lo]) * (pos - lo)) * 1000) / 1000;
  });
}

const METRICS = ["de", "cr", "icr", "opm"];
const byIndustry = new Map();
const all = Object.fromEntries(METRICS.map((m) => [m, []]));
for (const b of bs) {
  const r = ratios(b);
  const industry = (b.Industry || "Unclassified").trim();
  if (!byIndustry.has(industry)) byIndustry.set(industry, Object.fromEntries(METRICS.map((m) => [m, []])));
  for (const m of METRICS) {
    if (typeof r[m] !== "number" || !Number.isFinite(r[m])) continue;
    byIndustry.get(industry)[m].push(r[m]);
    if (!FINANCIAL.test(industry)) all[m].push(r[m]);
  }
}

const dist = (xs) => (xs.length >= MIN_PEERS ? { n: xs.length, q: quantiles(xs) } : null);
const pack = (obj) => Object.fromEntries(METRICS.map((m) => [m, dist(obj[m])]).filter(([, d]) => d));

const industries = {};
for (const [name, obj] of [...byIndustry].sort((a, b) => a[0].localeCompare(b[0]))) {
  const d = pack(obj);
  if (Object.keys(d).length) industries[name] = d;
}

const out = {
  source: "Kaggle pacificrm/financial-sheets (CC0). Listed Indian companies, latest annual figures.",
  points: POINTS,
  all: pack(all),
  industries,
};
fs.mkdirSync("src/data", { recursive: true });
fs.writeFileSync("src/data/peerBenchmarks.json", JSON.stringify(out));
console.log(`peerBenchmarks.json: ${Object.keys(industries).length} industries, all-company n =`,
  Object.fromEntries(METRICS.map((m) => [m, out.all[m]?.n])), `${(fs.statSync("src/data/peerBenchmarks.json").size / 1024).toFixed(1)} KB`);
