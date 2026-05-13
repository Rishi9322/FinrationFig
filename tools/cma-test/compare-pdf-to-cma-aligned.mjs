#!/usr/bin/env node

import XLSX from 'xlsx';
import fs from 'fs';

// PDF extracted metrics for AY 26-27 (units: Rupees)
const pdfMetrics = {
  netSales: 93581350,
  grossProfit: 26646064,
  netProfit: 10882220,
  currentAssets: 43549214,
  currentLiabilities: 43549214,
  currentRatio: 1,
  tangibleNetWorth: null, // will extract
  paidUpCapital: null,
  interestExpense: 5928346,
};

const cmaFilePath = 'teest/CMA Spar Coats.xls';

console.log('=== PDF vs CMA Comparison (ALIGNED TO AY 26-27) ===\n');

try {
  const wb = XLSX.readFile(cmaFilePath);
  
  // Financial Position sheet has the years: 2024-25 (Actual), 2025-26 (Provisional), 2026-27 (Projected)
  const fpSheet = wb.Sheets['Financial Position'];
  const fpRaw = XLSX.utils.sheet_to_json(fpSheet, { defval: '' });
  
  // Operating Statement sheet
  const osSheet = wb.Sheets['Operating Statement'];
  const osRaw = XLSX.utils.sheet_to_json(osSheet, { defval: '' });
  
  // Helper to find value in projected 2026-27 column (should be column 4, index 3 or 4)
  const extractProjectedValue = (dataArray, searchLabel, colIndex = 4) => {
    for (const row of dataArray) {
      const vals = Object.values(row);
      const combined = (String(vals[0] || '') + ' ' + String(vals[1] || '')).toLowerCase();
      
      if (combined.includes(searchLabel)) {
        const val = parseFloat(vals[colIndex]);
        if (!isNaN(val)) {
          return val;
        }
      }
    }
    return null;
  };
  
  // Extract from Financial Position (projected 2026-27)
  console.log('📊 EXTRACTING CMA DATA FOR AY 26-27 PROJECTIONS...\n');
  
  const cmaPaidUpCapital = extractProjectedValue(fpRaw, 'paid up capital', 4);
  const cmaTangibleNW = extractProjectedValue(fpRaw, 'tangible net worth', 4);
  const cmaCurrentAssets = extractProjectedValue(fpRaw, 'current assets', 4);
  const cmaCurrentLiabilities = extractProjectedValue(fpRaw, 'current liabilities', 4);
  const cmaCurrentRatio = extractProjectedValue(fpRaw, 'current ratio', 4);
  const cmaDSCR = extractProjectedValue(fpRaw, 'dscr', 4);
  const cmaInterestCoverage = extractProjectedValue(fpRaw, 'interest coverage', 4);
  const cmaNetProfitMargin = extractProjectedValue(fpRaw, 'profitability', 4);
  
  // Extract from Operating Statement (projected 2026-27)
  const cmaNetSales = extractProjectedValue(osRaw, 'net sales', 4);
  const cmaGrossProfit = extractProjectedValue(osRaw, 'gross profit', 4);
  const cmaNetProfit = extractProjectedValue(osRaw, 'net profit', 4);
  
  // Convert lakhs to rupees
  const lakhs2rupees = (lakhs) => {
    return lakhs ? Math.round(lakhs * 100000) : null;
  };
  
  const variance = (pdf, cma) => {
    if (!pdf || !cma) return null;
    return Math.round(((pdf - cma) / Math.abs(cma)) * 10000) / 100; // percent with 2 decimals
  };
  
  // Build comparison
  const comparison = [
    {
      metric: 'Net Sales',
      pdf: pdfMetrics.netSales,
      cmaLakhs: cmaNetSales,
      cmaRupees: lakhs2rupees(cmaNetSales),
      variancePercent: variance(pdfMetrics.netSales, lakhs2rupees(cmaNetSales)),
      unit: 'Rupees'
    },
    {
      metric: 'Gross Profit',
      pdf: pdfMetrics.grossProfit,
      cmaLakhs: cmaGrossProfit,
      cmaRupees: lakhs2rupees(cmaGrossProfit),
      variancePercent: variance(pdfMetrics.grossProfit, lakhs2rupees(cmaGrossProfit)),
      unit: 'Rupees'
    },
    {
      metric: 'Net Profit',
      pdf: pdfMetrics.netProfit,
      cmaLakhs: cmaNetProfit,
      cmaRupees: lakhs2rupees(cmaNetProfit),
      variancePercent: variance(pdfMetrics.netProfit, lakhs2rupees(cmaNetProfit)),
      unit: 'Rupees'
    },
    {
      metric: 'Current Assets',
      pdf: pdfMetrics.currentAssets,
      cmaLakhs: cmaCurrentAssets,
      cmaRupees: lakhs2rupees(cmaCurrentAssets),
      variancePercent: variance(pdfMetrics.currentAssets, lakhs2rupees(cmaCurrentAssets)),
      unit: 'Rupees'
    },
    {
      metric: 'Current Liabilities',
      pdf: pdfMetrics.currentLiabilities,
      cmaLakhs: cmaCurrentLiabilities,
      cmaRupees: lakhs2rupees(cmaCurrentLiabilities),
      variancePercent: variance(pdfMetrics.currentLiabilities, lakhs2rupees(cmaCurrentLiabilities)),
      unit: 'Rupees'
    },
    {
      metric: 'Tangible Net Worth',
      pdf: pdfMetrics.tangibleNetWorth,
      cmaLakhs: cmaTangibleNW,
      cmaRupees: lakhs2rupees(cmaTangibleNW),
      variancePercent: pdfMetrics.tangibleNetWorth ? variance(pdfMetrics.tangibleNetWorth, lakhs2rupees(cmaTangibleNW)) : null,
      unit: 'Rupees'
    },
    {
      metric: 'Paid-up Capital',
      pdf: pdfMetrics.paidUpCapital,
      cmaLakhs: cmaPaidUpCapital,
      cmaRupees: lakhs2rupees(cmaPaidUpCapital),
      variancePercent: pdfMetrics.paidUpCapital ? variance(pdfMetrics.paidUpCapital, lakhs2rupees(cmaPaidUpCapital)) : null,
      unit: 'Rupees'
    },
    {
      metric: 'Current Ratio',
      pdf: pdfMetrics.currentRatio,
      cmaLakhs: null,
      cmaRupees: cmaCurrentRatio,
      variancePercent: variance(pdfMetrics.currentRatio, cmaCurrentRatio),
      unit: 'Ratio'
    },
    {
      metric: 'DSCR',
      pdf: null,
      cmaLakhs: null,
      cmaRupees: cmaDSCR,
      variancePercent: null,
      unit: 'Ratio'
    },
    {
      metric: 'Interest Coverage',
      pdf: null,
      cmaLakhs: null,
      cmaRupees: cmaInterestCoverage,
      variancePercent: null,
      unit: 'Ratio'
    }
  ];
  
  // Print formatted comparison
  console.log('COMPARISON MATRIX (AY 2026-27)\n');
  console.log('Metric'.padEnd(25) + ' PDF Value'.padEnd(20) + ' CMA Value'.padEnd(20) + ' Variance %'.padEnd(15) + 'Status');
  console.log('─'.repeat(105));
  
  for (const row of comparison) {
    let pdfStr = row.pdf !== null ? row.pdf.toLocaleString('en-IN').substring(0, 18) : 'N/A';
    let cmaStr = row.cmaRupees !== null ? row.cmaRupees.toLocaleString('en-IN').substring(0, 18) : 'N/A';
    
    if (row.unit === 'Ratio') {
      pdfStr = row.pdf !== null ? row.pdf.toFixed(3) : 'N/A';
      cmaStr = row.cmaRupees !== null ? row.cmaRupees.toFixed(3) : 'N/A';
    }
    
    const varStr = row.variancePercent !== null ? `${row.variancePercent}%` : 'N/A';
    
    let status = '✓ MATCH';
    if (row.variancePercent !== null) {
      const absVar = Math.abs(row.variancePercent);
      if (absVar > 20) status = '✗ MAJOR MISMATCH (>20%)';
      else if (absVar > 10) status = '⚠ SIGNIFICANT (10-20%)';
      else if (absVar > 5) status = '~ CLOSE (5-10%)';
      else status = '✓ MATCH (<5%)';
    }
    
    console.log(
      row.metric.padEnd(25) +
      pdfStr.padEnd(20) +
      cmaStr.padEnd(20) +
      varStr.padEnd(15) +
      status
    );
  }
  
  // Summary statistics
  const validComparisons = comparison.filter(c => c.variancePercent !== null);
  const exact = validComparisons.filter(c => Math.abs(c.variancePercent) < 5);
  const close = validComparisons.filter(c => Math.abs(c.variancePercent) >= 5 && Math.abs(c.variancePercent) < 10);
  const significant = validComparisons.filter(c => Math.abs(c.variancePercent) >= 10 && Math.abs(c.variancePercent) < 20);
  const major = validComparisons.filter(c => Math.abs(c.variancePercent) >= 20);
  
  console.log('\n📊 SUMMARY');
  console.log('─'.repeat(50));
  console.log(`Total Comparable Metrics: ${validComparisons.length}`);
  console.log(`✓ Exact Matches (<5%):        ${exact.length}`);
  console.log(`~ Close Matches (5-10%):      ${close.length}`);
  console.log(`⚠ Significant Variance (10-20%): ${significant.length}`);
  console.log(`✗ Major Mismatches (>20%):   ${major.length}`);
  
  // Write JSON report
  const report = {
    title: 'PDF vs CMA Comparison Report (AY 2026-27)',
    comparisonDate: new Date().toISOString(),
    period: 'AY 2026-27 (01-Apr-2026 to 31-Mar-2027)',
    sources: {
      pdf: 'Spar AY 26-27 Provisional 08.05.2026.pdf (Provisional Balance Sheet)',
      cma: 'CMA Spar Coats.xls (Financial Projections Column)'
    },
    unitNote: 'CMA values in Lakhs (1 Lakh = 100,000 Rupees). Converted to Rupees for comparison.',
    data: comparison.map(c => ({
      metric: c.metric,
      pdf: c.pdf,
      cmaLakhs: c.cmaLakhs,
      cmaRupees: c.cmaRupees,
      variancePercent: c.variancePercent,
      matchStatus: c.variancePercent === null ? 'N/A' : Math.abs(c.variancePercent) < 5 ? 'EXACT' : Math.abs(c.variancePercent) < 10 ? 'CLOSE' : Math.abs(c.variancePercent) < 20 ? 'SIGNIFICANT' : 'MAJOR_MISMATCH',
      unit: c.unit
    })),
    summary: {
      totalComparableMetrics: validComparisons.length,
      exactMatches: exact.length,
      closeMatches: close.length,
      significantVariance: significant.length,
      majorMismatches: major.length,
      overallQuality: exact.length === validComparisons.length ? 'EXCELLENT' : close.length + exact.length >= validComparisons.length * 0.8 ? 'GOOD' : 'NEEDS_REVIEW'
    }
  };
  
  fs.writeFileSync('tools/ocr/out/pdf-vs-cma-comparison-aligned.json', JSON.stringify(report, null, 2));
  console.log('\n✅ Detailed JSON saved: tools/ocr/out/pdf-vs-cma-comparison-aligned.json');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
