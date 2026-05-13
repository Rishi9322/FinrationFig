#!/usr/bin/env node

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const cmaFilePath = 'teest/CMA Spar Coats.xls';

console.log('🔍 COMPREHENSIVE CMA WORKBOOK EXTRACTION - COMPLETE INVENTORY\n');
console.log('=' .repeat(80));

try {
  const wb = XLSX.readFile(cmaFilePath);
  
  const masterDatabase = {
    metadata: {
      fileName: 'CMA Spar Coats.xls',
      extractionDate: new Date().toISOString(),
      totalSheets: wb.SheetNames.length,
      sheetNames: wb.SheetNames
    },
    sheets: {},
    allMetrics: {}, // Consolidated all metrics
    columnStructure: {}, // Track which columns are which period
    valueCount: 0
  };

  // Process each sheet completely
  for (const sheetName of wb.SheetNames) {
    console.log(`\n📋 SHEET: ${sheetName}`);
    console.log('-'.repeat(80));
    
    const sheet = wb.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    
    // Also get cell-by-cell data for complete fidelity
    const cellData = {};
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    
    let valueCount = 0;
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({r: row, c: col});
        const cell = sheet[cellRef];
        if (cell && cell.v !== undefined && cell.v !== '') {
          valueCount++;
          cellData[cellRef] = {
            value: cell.v,
            type: cell.t,
            formula: cell.f || null
          };
          masterDatabase.valueCount++;
        }
      }
    }
    
    masterDatabase.sheets[sheetName] = {
      rowCount: rawData.length,
      valueCount: valueCount,
      rawData: rawData,
      cellData: cellData,
      ref: sheet['!ref']
    };
    
    console.log(`  • Values extracted: ${valueCount}`);
    console.log(`  • Rows (JSON): ${rawData.length}`);
    console.log(`  • Range: ${sheet['!ref']}`);
    
    // Extract key metrics from each sheet
    extractSheetMetrics(sheetName, rawData, masterDatabase);
  }
  
  // Identify column structure (periods)
  identifyPeriods(masterDatabase);
  
  // Save complete database
  fs.writeFileSync('tools/ocr/out/cma-complete-database.json', JSON.stringify(masterDatabase, null, 2));
  console.log(`\n✅ Complete database saved: cma-complete-database.json`);
  
  // Generate statistics
  console.log(`\n📊 EXTRACTION STATISTICS`);
  console.log('='.repeat(80));
  console.log(`Total Sheets: ${masterDatabase.metadata.totalSheets}`);
  console.log(`Total Values Extracted: ${masterDatabase.valueCount}`);
  console.log(`Total Metrics Identified: ${Object.keys(masterDatabase.allMetrics).length}`);
  
  // Print consolidated metrics
  console.log(`\n📈 ALL METRICS FOUND (${Object.keys(masterDatabase.allMetrics).length} unique metrics)`);
  console.log('-'.repeat(80));
  
  const metricsArray = Object.entries(masterDatabase.allMetrics).sort();
  metricsArray.forEach(([metricName, data], idx) => {
    console.log(`${idx + 1}. ${metricName}`);
    if (data.values && data.values.length > 0) {
      const vals = data.values.map(v => v.toLocaleString('en-IN')).join(' → ');
      console.log(`   Values: ${vals}`);
    }
  });
  
  // Create a human-readable metrics report
  const metricsReport = {
    title: 'CMA Complete Metrics Inventory',
    generatedAt: new Date().toISOString(),
    totalMetrics: Object.keys(masterDatabase.allMetrics).length,
    metrics: metricsArray.map(([name, data]) => ({
      metricName: name,
      source: data.source,
      periods: data.periods || [],
      values: data.values || [],
      units: data.unit || 'Unknown'
    }))
  };
  
  fs.writeFileSync('tools/ocr/out/cma-metrics-inventory.json', JSON.stringify(metricsReport, null, 2));
  
  console.log(`\n✅ Metrics inventory: cma-metrics-inventory.json`);
  console.log(`\n✅ COMPLETE EXTRACTION SUCCESSFUL`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

// Extract metrics from sheet data
function extractSheetMetrics(sheetName, data, masterDB) {
  for (const row of data) {
    const values = Object.values(row);
    const keys = Object.keys(row);
    
    // First column usually contains the metric name
    const metricName = String(values[0] || '').trim();
    if (!metricName || metricName.length < 2) continue;
    
    // Collect numeric values from this row
    const numericValues = [];
    const periods = [];
    
    for (let i = 1; i < values.length; i++) {
      const val = values[i];
      const num = parseFloat(val);
      if (!isNaN(num) && num !== 0) {
        numericValues.push(num);
        periods.push(keys[i] || `Column ${i}`);
      }
    }
    
    // Store in consolidated metrics
    if (numericValues.length > 0) {
      const key = `${sheetName} | ${metricName}`;
      masterDB.allMetrics[key] = {
        source: sheetName,
        metricName: metricName,
        periods: periods,
        values: numericValues,
        rowData: row
      };
    }
  }
}

// Identify time periods/columns
function identifyPeriods(masterDB) {
  const periods = new Set();
  
  // Get column headers from Financial Position sheet (usually has year info)
  if (masterDB.sheets['Financial Position']) {
    const fpData = masterDB.sheets['Financial Position'].rawData;
    if (fpData.length > 3) {
      const headerRow = fpData[3]; // Row 4 usually has year headers
      Object.entries(headerRow).forEach(([key, val]) => {
        const str = String(val).trim();
        if (str.match(/202[0-9]|20[0-9]{2}|Actual|Provisional|Projected/i)) {
          periods.add(str);
        }
      });
    }
  }
  
  masterDB.columnStructure.identifiedPeriods = Array.from(periods);
}
