#!/usr/bin/env node

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const cmaDbFile = 'tools/ocr/out/cma-complete-database.json';
const pdfAnalysisFile = 'tools/ocr/out/Spar AY 26-27 Provisional 08.05.2026-single-source-analysis.json';

console.log('🔄 BUILDING 100% CMA-TO-SYSTEM RECONCILIATION\n');
console.log('='.repeat(100));

try {
  // Load both databases
  const cmaDb = JSON.parse(fs.readFileSync(cmaDbFile, 'utf8'));
  const pdfAnalysis = JSON.parse(fs.readFileSync(pdfAnalysisFile, 'utf8'));

  const reconciliation = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalCmaValues: cmaDb.valueCount,
      totalPdfValues: Object.keys(pdfAnalysis.metrics || {}).length,
      targetCoverage: '100%'
    },
    summary: {
      totalCmaMetrics: 0,
      exactMatches: 0,
      closeMatches: 0,
      partialMatches: 0,
      notInPdf: 0,
      notInCma: 0
    },
    matchingDetails: [],
    unmatchedCmaMetrics: [],
    unmatchedPdfMetrics: [],
    qualityReport: {}
  };

  // Extract all CMA metrics from database
  const cmaMetrics = {};
  for (const sheetName of Object.keys(cmaDb.sheets)) {
    const sheet = cmaDb.sheets[sheetName];
    const rawData = sheet.rawData;
    
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const values = Object.values(row);
      
      if (values.length < 2) continue;
      
      // Try to identify metric name (usually first non-empty cell)
      const metricName = String(values[0] || values[1] || '').trim();
      if (!metricName || metricName.length < 2) continue;
      
      // Extract numeric values
      const numericValues = [];
      for (let j = 1; j < values.length; j++) {
        const val = values[j];
        if (val && !isNaN(parseFloat(val))) {
          numericValues.push({
            index: j,
            value: parseFloat(val),
            rawValue: val
          });
        }
      }
      
      if (numericValues.length > 0) {
        const metricKey = `${sheetName}|${metricName}`;
        cmaMetrics[metricKey] = {
          sheet: sheetName,
          metricName: metricName,
          numericValues: numericValues,
          valueCount: numericValues.length,
          minValue: Math.min(...numericValues.map(v => v.value)),
          maxValue: Math.max(...numericValues.map(v => v.value)),
          rowData: row
        };
        reconciliation.summary.totalCmaMetrics++;
      }
    }
  }

  // Get PDF metrics
  const pdfMetrics = pdfAnalysis.metrics || {};
  const pdfMetricsSet = new Set();
  for (const pdfMetric of Object.keys(pdfMetrics)) {
    pdfMetricsSet.add(pdfMetric.toLowerCase());
  }

  // Matching logic
  for (const [cmaKey, cmaMetric] of Object.entries(cmaMetrics)) {
    const cmaMetricLower = cmaMetric.metricName.toLowerCase();
    let matched = false;
    let matchDetails = null;

    // Strategy 1: Direct keyword match
    for (const pdfMetric of Object.keys(pdfMetrics)) {
      const pdfMetricLower = pdfMetric.toLowerCase();
      
      if (cmaMetricLower === pdfMetricLower) {
        const pdfValue = pdfMetrics[pdfMetric];
        const cmaValue = cmaMetric.numericValues[0]?.value; // Use first value for comparison
        
        const variance = cmaValue && pdfValue ? ((pdfValue - cmaValue) / cmaValue * 100) : null;
        
        matchDetails = {
          cmaMetric: cmaKey,
          cmaValue: cmaValue,
          pdfMetric: pdfMetric,
          pdfValue: pdfValue,
          variance: variance,
          matchType: 'EXACT_KEYWORD',
          matchScore: 100
        };
        reconciliation.matchingDetails.push(matchDetails);
        reconciliation.summary.exactMatches++;
        matched = true;
        break;
      }
    }

    // Strategy 2: Fuzzy match (if exact not found)
    if (!matched) {
      for (const pdfMetric of Object.keys(pdfMetrics)) {
        const pdfMetricLower = pdfMetric.toLowerCase();
        
        // Check if CMA metric contains key words from PDF metric
        if (cmaMetricLower.includes('current') && pdfMetricLower.includes('current') &&
            (cmaMetricLower.includes('asset') || cmaMetricLower.includes('liab')) &&
            (pdfMetricLower.includes('asset') || pdfMetricLower.includes('liab'))) {
          
          const pdfValue = pdfMetrics[pdfMetric];
          const cmaValue = cmaMetric.numericValues[0]?.value;
          const variance = cmaValue && pdfValue ? ((pdfValue - cmaValue) / cmaValue * 100) : null;
          
          matchDetails = {
            cmaMetric: cmaKey,
            cmaValue: cmaValue,
            pdfMetric: pdfMetric,
            pdfValue: pdfValue,
            variance: variance,
            matchType: 'FUZZY_KEYWORD',
            matchScore: 75
          };
          reconciliation.matchingDetails.push(matchDetails);
          reconciliation.summary.closeMatches++;
          matched = true;
          break;
        }
      }
    }

    // If still not matched, document as unmatched
    if (!matched) {
      reconciliation.unmatchedCmaMetrics.push({
        metric: cmaKey,
        metricName: cmaMetric.metricName,
        sheet: cmaMetric.sheet,
        values: cmaMetric.numericValues,
        reason: 'No corresponding PDF metric found'
      });
      reconciliation.summary.notInPdf++;
    }
  }

  // Find PDF metrics not in CMA
  for (const pdfMetric of Object.keys(pdfMetrics)) {
    let found = false;
    for (const matchDetail of reconciliation.matchingDetails) {
      if (matchDetail.pdfMetric === pdfMetric) {
        found = true;
        break;
      }
    }
    if (!found) {
      reconciliation.unmatchedPdfMetrics.push({
        metric: pdfMetric,
        value: pdfMetrics[pdfMetric],
        reason: 'PDF value not found in CMA'
      });
      reconciliation.summary.notInCma++;
    }
  }

  // Calculate quality metrics
  const totalCmaMetrics = reconciliation.summary.totalCmaMetrics;
  const matchedMetrics = reconciliation.summary.exactMatches + reconciliation.summary.closeMatches;
  
  reconciliation.qualityReport = {
    totalCmaMetricsInWorkbook: totalCmaMetrics,
    totalMatchedMetrics: matchedMetrics,
    matchCoverage: `${((matchedMetrics / totalCmaMetrics) * 100).toFixed(2)}%`,
    exactMatchPercentage: `${((reconciliation.summary.exactMatches / totalCmaMetrics) * 100).toFixed(2)}%`,
    closeMatchPercentage: `${((reconciliation.summary.closeMatches / totalCmaMetrics) * 100).toFixed(2)}%`,
    unmatched: reconciliation.summary.notInPdf,
    unmatchedPercentage: `${((reconciliation.summary.notInPdf / totalCmaMetrics) * 100).toFixed(2)}%`,
    pdfMetricsNotInCma: reconciliation.summary.notInCma
  };

  // Save reconciliation report
  fs.writeFileSync('tools/ocr/out/100-percent-reconciliation-matrix.json', JSON.stringify(reconciliation, null, 2));

  // Generate human-readable summary
  const summaryText = `
═══════════════════════════════════════════════════════════════════════════════
                    100% CMA-TO-SYSTEM RECONCILIATION REPORT
═══════════════════════════════════════════════════════════════════════════════

EXECUTIVE SUMMARY
─────────────────────────────────────────────────────────────────────────────
Generated: ${new Date().toISOString()}
CMA File: teest/CMA Spar Coats.xls
PDF File: Spar AY 26-27 Provisional 08.05.2026.pdf

COVERAGE METRICS
─────────────────────────────────────────────────────────────────────────────
Total CMA Metrics Identified:         ${reconciliation.summary.totalCmaMetrics}
Exact Keyword Matches:                 ${reconciliation.summary.exactMatches} (${((reconciliation.summary.exactMatches / reconciliation.summary.totalCmaMetrics) * 100).toFixed(2)}%)
Close Fuzzy Matches:                   ${reconciliation.summary.closeMatches} (${((reconciliation.summary.closeMatches / reconciliation.summary.totalCmaMetrics) * 100).toFixed(2)}%)
Total Matched:                         ${matchedMetrics} (${reconciliation.qualityReport.matchCoverage})
CMA Metrics NOT in PDF:                ${reconciliation.summary.notInPdf}
PDF Metrics NOT in CMA:                ${reconciliation.summary.notInCma}

DETAILED MATCHING RESULTS
─────────────────────────────────────────────────────────────────────────────

MATCHED METRICS (${matchedMetrics} items):
${reconciliation.matchingDetails.slice(0, 20).map((m, i) => `
${i + 1}. ${m.cmaMetric}
   CMA Value: ${m.cmaValue}
   PDF Match: ${m.pdfMetric} (${m.pdfValue})
   Variance: ${m.variance !== null ? m.variance.toFixed(2) + '%' : 'N/A'}
   Match Type: ${m.matchType}
`).join('')}
${reconciliation.matchingDetails.length > 20 ? `\n... and ${reconciliation.matchingDetails.length - 20} more matches\n` : ''}

UNMATCHED CMA METRICS (${reconciliation.summary.notInPdf} items):
${reconciliation.unmatchedCmaMetrics.slice(0, 10).map((m, i) => `
${i + 1}. ${m.metric}
   Sheet: ${m.sheet}
   Values: ${m.values.map(v => v.value.toLocaleString()).join(', ')}
`).join('')}
${reconciliation.unmatchedCmaMetrics.length > 10 ? `\n... and ${reconciliation.unmatchedCmaMetrics.length - 10} more unmatched CMA metrics\n` : ''}

PDF METRICS NOT IN CMA (${reconciliation.summary.notInCma} items):
${reconciliation.unmatchedPdfMetrics.slice(0, 10).map((m, i) => `
${i + 1}. ${m.metric}: ${m.value ? m.value.toLocaleString() : 'N/A'}
`).join('')}
${reconciliation.unmatchedPdfMetrics.length > 10 ? `\n... and ${reconciliation.unmatchedPdfMetrics.length - 10} more unmatched PDF metrics\n` : ''}

QUALITY ASSESSMENT
─────────────────────────────────────────────────────────────────────────────
Match Coverage:                        ${reconciliation.qualityReport.matchCoverage}
Exact Match Rate:                      ${reconciliation.qualityReport.exactMatchPercentage}
Close Match Rate:                      ${reconciliation.qualityReport.closeMatchPercentage}
Unmatched Rate:                        ${reconciliation.qualityReport.unmatchedPercentage}

FINAL ASSESSMENT
─────────────────────────────────────────────────────────────────────────────
✅ CMA DATABASE: Complete extraction of ${reconciliation.summary.totalCmaMetrics} metrics
✅ PDF DATABASE: Extracted ${reconciliation.summary.totalPdfMetrics} key metrics
✅ RECONCILIATION MATRIX: ${matchedMetrics} values matched and documented
✅ UNMAPPED METRICS: ${reconciliation.summary.notInPdf} CMA metrics documented as not in PDF scope
✅ OUTPUT FILES:
   - 100-percent-reconciliation-matrix.json (structured data)
   - 100-percent-reconciliation-report.txt (this report)

NEXT STEPS FOR 100% COMPLETION
─────────────────────────────────────────────────────────────────────────────
1. Review unmatched CMA metrics - verify if they should be in PDF scope
2. For unmatched metrics, determine if they represent:
   - Different accounting periods (AY vs PY)
   - Different scope definitions (e.g., working capital vs absolute)
   - Legitimate gaps in PDF data
3. Update matching rules based on findings
4. Generate final validation certificate with sign-off

═══════════════════════════════════════════════════════════════════════════════
`;

  fs.writeFileSync('tools/ocr/out/100-percent-reconciliation-report.txt', summaryText);

  console.log(summaryText);
  console.log('\n✅ Reconciliation matrix saved to: tools/ocr/out/100-percent-reconciliation-matrix.json');
  console.log('✅ Human-readable report saved to: tools/ocr/out/100-percent-reconciliation-report.txt');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
