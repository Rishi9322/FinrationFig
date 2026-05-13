#!/usr/bin/env node

import XLSX from 'xlsx';
import fs from 'fs';

// PDF extracted metrics (units: Rupees)
const pdfMetrics = {
  netSales: 93581350,
  grossProfit: 26646064,
  netProfit: 10882220,
  currentAssets: 725556,
  currentLiabilities: 12054330,
  currentRatio: 0.0602,
  tangibleNetWorth: 11328774,
  paidUpCapital: null, // to extract
  interestExpense: 5928346,
  debtorsReceivables: 12046500,
  stock: 2356200,
  creditors: 12054330,
  purchases: 63183326,
};

// CMA file path
const cmaFilePath = 'teest/CMA Spar Coats.xls';

console.log('=== PDF vs CMA Comparison ===\n');

try {
  const wb = XLSX.readFile(cmaFilePath);
  
  // Extract from Operating Statement sheet
  console.log('📊 EXTRACTING CMA DATA...\n');
  
  const osSheet = wb.Sheets['Operating Statement'];
  const osData = XLSX.utils.sheet_to_json(osSheet, { defval: '' });
  
  // Find Net Sales row
  let netSalesRow = null;
  let grossProfitRow = null;
  let netProfitRow = null;
  
  for (const row of osData) {
    const vals = Object.values(row).map(v => String(v).toLowerCase());
    const joined = vals.join(' | ');
    
    if (joined.includes('net sales') && !joined.includes('%')) {
      netSalesRow = row;
    }
    if (joined.includes('gross profit')) {
      grossProfitRow = row;
    }
    if (joined.includes('net profit') && joined.includes('loss')) {
      netProfitRow = row;
    }
  }
  
  // Extract numbers from rows (look for first numeric column which is likely the actual/latest year)
  const extractValue = (row, searchKeys = []) => {
    if (!row) return null;
    
    const vals = Object.entries(row);
    for (const [key, val] of vals) {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) {
        return num;
      }
    }
    return null;
  };
  
  const cmaNetSales = extractValue(netSalesRow);
  const cmaGrossProfit = extractValue(grossProfitRow);
  const cmaNetProfit = extractValue(netProfitRow);
  
  // Extract from Financial Position sheet
  const fpSheet = wb.Sheets['Financial Position'];
  const fpData = XLSX.utils.sheet_to_json(fpSheet, { defval: '' });
  
  let paidUpCapitalRow = null;
  let tangibleNWRow = null;
  let currentAssetsRow = null;
  let currentLiabilitiesRow = null;
  let currentRatioRow = null;
  let debtEquityRow = null;
  let dscrRow = null;
  let interestCoverageRow = null;
  
  for (const row of fpData) {
    const vals = Object.values(row);
    const firstCol = String(vals[0] || '').toLowerCase();
    const secondCol = String(vals[1] || '').toLowerCase();
    const fullText = (firstCol + ' ' + secondCol).toLowerCase();
    
    if (fullText.includes('paid up capital')) paidUpCapitalRow = row;
    if (fullText.includes('tangible net worth')) tangibleNWRow = row;
    if (fullText.includes('current assets') && !fullText.includes('non')) currentAssetsRow = row;
    if (fullText.includes('current liabilities')) currentLiabilitiesRow = row;
    if (fullText.includes('current ratio')) currentRatioRow = row;
    if (fullText.includes('debt') && (fullText.includes('equity') || fullText.includes('quasi'))) debtEquityRow = row;
    if (fullText.includes('dscr')) dscrRow = row;
    if (fullText.includes('interest coverage')) interestCoverageRow = row;
  }
  
  const cmaPaidUpCapital = extractValue(paidUpCapitalRow);
  const cmaTangibleNW = extractValue(tangibleNWRow);
  const cmaCurrentAssets = extractValue(currentAssetsRow);
  const cmaCurrentLiabilities = extractValue(currentLiabilitiesRow);
  const cmaCurrentRatio = extractValue(currentRatioRow);
  const cmaDebtEquity = extractValue(debtEquityRow);
  const cmaDSCR = extractValue(dscrRow);
  const cmaInterestCoverage = extractValue(interestCoverageRow);
  
  // Function to convert lakhs to rupees
  const lakhs2rupees = (lakhs) => {
    return lakhs ? Math.round(lakhs * 100000) : null;
  };
  
  // Function to calculate variance percentage
  const variance = (pdf, cma) => {
    if (!pdf || !cma) return null;
    return Math.round(((pdf - cma) / cma) * 10000) / 100; // percent, 2 decimals
  };
  
  // Build comparison table
  const comparison = [
    {
      metric: 'Net Sales',
      pdf: pdfMetrics.netSales,
      cma: lakhs2rupees(cmaNetSales),
      variancePercent: variance(pdfMetrics.netSales, lakhs2rupees(cmaNetSales)),
      unit: 'Rupees'
    },
    {
      metric: 'Gross Profit',
      pdf: pdfMetrics.grossProfit,
      cma: lakhs2rupees(cmaGrossProfit),
      variancePercent: variance(pdfMetrics.grossProfit, lakhs2rupees(cmaGrossProfit)),
      unit: 'Rupees'
    },
    {
      metric: 'Net Profit',
      pdf: pdfMetrics.netProfit,
      cma: lakhs2rupees(cmaNetProfit),
      variancePercent: variance(pdfMetrics.netProfit, lakhs2rupees(cmaNetProfit)),
      unit: 'Rupees'
    },
    {
      metric: 'Current Assets',
      pdf: pdfMetrics.currentAssets,
      cma: lakhs2rupees(cmaCurrentAssets),
      variancePercent: variance(pdfMetrics.currentAssets, lakhs2rupees(cmaCurrentAssets)),
      unit: 'Rupees'
    },
    {
      metric: 'Current Liabilities',
      pdf: pdfMetrics.currentLiabilities,
      cma: lakhs2rupees(cmaCurrentLiabilities),
      variancePercent: variance(pdfMetrics.currentLiabilities, lakhs2rupees(cmaCurrentLiabilities)),
      unit: 'Rupees'
    },
    {
      metric: 'Tangible Net Worth',
      pdf: pdfMetrics.tangibleNetWorth,
      cma: lakhs2rupees(cmaTangibleNW),
      variancePercent: variance(pdfMetrics.tangibleNetWorth, lakhs2rupees(cmaTangibleNW)),
      unit: 'Rupees'
    },
    {
      metric: 'Paid-up Capital',
      pdf: pdfMetrics.paidUpCapital,
      cma: lakhs2rupees(cmaPaidUpCapital),
      variancePercent: pdfMetrics.paidUpCapital ? variance(pdfMetrics.paidUpCapital, lakhs2rupees(cmaPaidUpCapital)) : null,
      unit: 'Rupees'
    },
    {
      metric: 'Current Ratio',
      pdf: pdfMetrics.currentRatio,
      cma: cmaCurrentRatio,
      variancePercent: variance(pdfMetrics.currentRatio, cmaCurrentRatio),
      unit: 'Ratio'
    },
    {
      metric: 'DSCR',
      pdf: null, // calculated from P&L data
      cma: cmaDSCR,
      variancePercent: null,
      unit: 'Ratio'
    },
    {
      metric: 'Interest Coverage',
      pdf: null, // calculated from P&L data
      cma: cmaInterestCoverage,
      variancePercent: null,
      unit: 'Ratio'
    },
  ];
  
  // Print comparison
  console.log('COMPARISON MATRIX\n');
  console.log('Metric'.padEnd(25) + ' PDF (₹)'.padEnd(18) + ' CMA (₹)'.padEnd(18) + ' Variance %'.padEnd(15) + 'Status');
  console.log('─'.repeat(90));
  
  for (const row of comparison) {
    const pdfVal = row.pdf !== null ? row.pdf.toLocaleString('en-IN') : 'N/A';
    const cmaVal = row.cma !== null ? row.cma.toLocaleString('en-IN') : 'N/A';
    const varVal = row.variancePercent !== null ? `${row.variancePercent}%` : 'N/A';
    
    let status = '✓ MATCH';
    if (row.variancePercent !== null) {
      const absVar = Math.abs(row.variancePercent);
      if (absVar > 10) status = '✗ MISMATCH (>10%)';
      else if (absVar > 5) status = '⚠ CLOSE (5-10%)';
      else if (absVar > 0.5) status = '~ MINOR (<5%)';
    }
    
    console.log(
      row.metric.padEnd(25) +
      pdfVal.padEnd(18) +
      cmaVal.padEnd(18) +
      varVal.padEnd(15) +
      status
    );
  }
  
  // Write detailed JSON report
  const reportJson = {
    title: 'PDF vs CMA Financial Comparison Report',
    generatedAt: new Date().toISOString(),
    source: {
      pdf: 'Spar AY 26-27 Provisional 08.05.2026.pdf',
      cma: 'CMA Spar Coats.xls'
    },
    unitNote: 'CMA values converted from Lakhs to Rupees (1 Lakh = 100,000 Rupees)',
    comparison: comparison.map(c => ({
      metric: c.metric,
      pdfValue: c.pdf,
      cmaValue: c.cma,
      variancePercent: c.variancePercent,
      status: c.variancePercent === null ? 'N/A' : Math.abs(c.variancePercent) > 10 ? 'MISMATCH' : Math.abs(c.variancePercent) > 5 ? 'CLOSE' : 'MATCH',
      unit: c.unit
    })),
    summary: {
      totalMetrics: comparison.length,
      exactMatches: comparison.filter(c => c.variancePercent !== null && Math.abs(c.variancePercent) < 0.5).length,
      closeMatches: comparison.filter(c => c.variancePercent !== null && Math.abs(c.variancePercent) >= 0.5 && Math.abs(c.variancePercent) < 5).length,
      mismatches: comparison.filter(c => c.variancePercent !== null && Math.abs(c.variancePercent) >= 10).length
    }
  };
  
  fs.writeFileSync('tools/ocr/out/pdf-vs-cma-comparison.json', JSON.stringify(reportJson, null, 2));
  
  console.log('\n✅ Detailed JSON report: tools/ocr/out/pdf-vs-cma-comparison.json');
  console.log('\n');
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
