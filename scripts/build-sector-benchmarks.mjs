// Builds src/data/sectorBenchmarks.json (sector-median KPI benchmarks) from a local
// extract of the Kaggle dataset "detailed-financial-data-of-4456-nse-and-bse-company".
// Re-run after `python -m kaggle datasets download sameerprogrammer/detailed-financial-data-of-4456-nse-and-bse-company -p scratch/kaggle --unzip`
// Source data license: CC BY-NC-ND 4.0 (non-commercial use only) — see docs/ATTRIBUTIONS.md.
import fs from "node:fs";
import path from "node:path";

const ROOT =
  "scratch/kaggle/Detailed-Financials-Data-Of-4456-NSE-And-BSE-Company-20231230T233228Z-001/Detailed-Financials-Data-Of-4456-NSE-_-BSE-Company";

function parseCsv(text) {
  const lines = text.trim().split("\n").map((l) => l.split(","));
  const header = lines[0];
  return { header, rows: lines.slice(1) };
}

function latestNumeric(header, row) {
  // last non-empty numeric column (rightmost = most recent year)
  for (let i = header.length - 1; i >= 1; i--) {
    const v = parseFloat(row[i]);
    if (!Number.isNaN(v)) return v;
  }
  return null;
}

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const bySector = {}; // sector -> { metric -> number[] }

const companies = fs.readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory());

for (const dir of companies) {
  const base = path.join(ROOT, dir.name);
  try {
    const basicInfoFile = fs.readdirSync(base).find((f) => f.endsWith("_Basic_Info.csv"));
    if (!basicInfoFile) continue;
    const basicInfo = parseCsv(fs.readFileSync(path.join(base, basicInfoFile), "utf-8"));
    const sector = basicInfo.rows[0]?.[2]?.trim();
    if (!sector) continue;

    const metrics = (bySector[sector] ??= {
      "Debtor Days": [],
      "Inventory Days": [],
      "Days Payable": [],
      "Cash Conversion Cycle": [],
      "Working Capital Days": [],
      "ROCE %": [],
      "Operating Cashflow to Sales": [],
    });

    const ratiosFile = path.join(base, "Ratios.csv");
    if (fs.existsSync(ratiosFile)) {
      const { header, rows } = parseCsv(fs.readFileSync(ratiosFile, "utf-8"));
      for (const row of rows) {
        const label = row[0];
        if (label in metrics) {
          const v = latestNumeric(header, row);
          if (v !== null) metrics[label].push(v);
        }
      }
    }

    const cashflowFile = path.join(base, "Yearly_Cash_flow.csv");
    const plFile = path.join(base, "Yearly_Profit_Loss.csv");
    if (fs.existsSync(cashflowFile) && fs.existsSync(plFile)) {
      const cf = parseCsv(fs.readFileSync(cashflowFile, "utf-8"));
      const pl = parseCsv(fs.readFileSync(plFile, "utf-8"));
      const opCfRow = cf.rows.find((r) => r[0] === "Cash from Operating Activity");
      const salesRow = pl.rows.find((r) => r[0] === "Sales");
      if (opCfRow && salesRow) {
        const opCf = latestNumeric(cf.header, opCfRow);
        const sales = latestNumeric(pl.header, salesRow);
        if (opCf !== null && sales) metrics["Operating Cashflow to Sales"].push(opCf / sales);
      }
    }
  } catch {
    // skip malformed company folder
  }
}

const benchmarks = {};
for (const [sector, metrics] of Object.entries(bySector)) {
  const entry = { sampleSize: 0 };
  for (const [metric, values] of Object.entries(metrics)) {
    if (values.length >= 3) entry[metric] = Math.round(median(values) * 100) / 100;
  }
  entry.sampleSize = Math.max(...Object.values(metrics).map((v) => v.length), 0);
  if (entry.sampleSize >= 3) benchmarks[sector] = entry;
}

fs.mkdirSync("src/data", { recursive: true });
fs.writeFileSync("src/data/sectorBenchmarks.json", JSON.stringify(benchmarks, null, 2));
console.log(`Wrote benchmarks for ${Object.keys(benchmarks).length} sectors`);
