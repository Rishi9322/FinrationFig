import type { CmaParsedData } from "./cmaTypes";

// ponytail: single global threshold per rule, not tuned per industry/sector.
// Upgrade path: once sector benchmarking exists, swap these fixed cutoffs for
// sector-relative ones (e.g. "receivables growth > 2x sector median").

export type AnomalySeverity = "warn" | "info";

export interface Anomaly {
  year: string;
  severity: AnomalySeverity;
  message: string;
}

function yoyGrowth(curr: number, prev: number): number | null {
  if (!prev) return null; // avoid dividing by zero / meaningless % off a zero base
  return (curr - prev) / prev;
}

/**
 * Year-over-year rule checks across the parsed CMA data. Pure and
 * deterministic - every finding cites the actual numbers that triggered it.
 */
export function findAnomalies(parsed: CmaParsedData): Anomaly[] {
  const { years, operatingStatement: os, balanceSheet: bs } = parsed;
  const anomalies: Anomaly[] = [];

  for (let i = 1; i < years.length; i++) {
    const year = years[i];
    const netSales = os.netSales[i] || 0;
    const prevNetSales = os.netSales[i - 1] || 0;
    const salesGrowth = yoyGrowth(netSales, prevNetSales);

    // Balance sheet mismatch this year.
    const totalAssets = bs.totalAssets[i] || 0;
    const totalLiabilities = bs.totalLiabilities[i] || 0;
    if (Math.abs(totalAssets - totalLiabilities) > 1) {
      anomalies.push({
        year, severity: "warn",
        message: `Total Assets (${totalAssets.toFixed(1)}) does not match Total Liabilities (${totalLiabilities.toFixed(1)}).`,
      });
    }

    if (salesGrowth === null) continue;

    // Receivables spike relative to sales growth.
    const receivables = (bs.currentAssets.tradeReceivablesDomestic[i] || 0) + (bs.currentAssets.tradeReceivablesExport[i] || 0);
    const prevReceivables = (bs.currentAssets.tradeReceivablesDomestic[i - 1] || 0) + (bs.currentAssets.tradeReceivablesExport[i - 1] || 0);
    const receivablesGrowth = yoyGrowth(receivables, prevReceivables);
    if (receivablesGrowth !== null && receivablesGrowth - salesGrowth > 0.3 && receivablesGrowth > 0.2) {
      anomalies.push({
        year, severity: "warn",
        message: `Trade receivables grew ${(receivablesGrowth * 100).toFixed(0)}% while sales grew ${(salesGrowth * 100).toFixed(0)}% - collections may be slowing.`,
      });
    }

    // Current liabilities outpacing sales.
    const cl = bs.currentLiabilities.totalCurrentLiabilities[i] || 0;
    const prevCl = bs.currentLiabilities.totalCurrentLiabilities[i - 1] || 0;
    const clGrowth = yoyGrowth(cl, prevCl);
    if (clGrowth !== null && clGrowth - salesGrowth > 0.25) {
      anomalies.push({
        year, severity: "warn",
        message: `Current liabilities grew ${(clGrowth * 100).toFixed(0)}% against ${(salesGrowth * 100).toFixed(0)}% sales growth - short-term obligations are outpacing the business.`,
      });
    }

    // Margin compression.
    const margin = netSales ? (os.netProfit[i] || 0) / netSales : 0;
    const prevMargin = prevNetSales ? (os.netProfit[i - 1] || 0) / prevNetSales : 0;
    if (prevMargin - margin > 0.02) {
      anomalies.push({
        year, severity: "warn",
        message: `PAT margin fell from ${(prevMargin * 100).toFixed(1)}% to ${(margin * 100).toFixed(1)}%.`,
      });
    }

    // Debt growth without revenue support.
    const debt = (bs.currentLiabilities.totalBankBorrowings[i] || 0) + (bs.termLiabilities.totalTermLiabilities[i] || 0);
    const prevDebt = (bs.currentLiabilities.totalBankBorrowings[i - 1] || 0) + (bs.termLiabilities.totalTermLiabilities[i - 1] || 0);
    const debtGrowth = yoyGrowth(debt, prevDebt);
    if (debtGrowth !== null && debtGrowth > 0.15 && salesGrowth < 0.05) {
      anomalies.push({
        year, severity: "warn",
        message: `Debt grew ${(debtGrowth * 100).toFixed(0)}% while sales grew only ${(salesGrowth * 100).toFixed(0)}% - borrowing isn't tracking revenue.`,
      });
    }
  }

  return anomalies;
}
