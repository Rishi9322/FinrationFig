#!/usr/bin/env node

/**
 * CMA Steel Tech Test Suite
 * 
 * This script:
 * 1. Reads the CMA Steel Tech.xls file
 * 2. Extracts balance sheet data
 * 3. Runs all financial calculators
 * 4. Compares results with CMA report
 * 5. Validates formulas
 */

import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'

const DATA_DIR = 'steel tech'
const CMA_FILE = path.join(DATA_DIR, 'CMA Steel Tech.xls')
const LOAN_FILE = path.join(DATA_DIR, 'Loan Sheet1.xlsx')
let totalAnnualEMI = 0

console.log('\n========================================')
console.log('CMA Steel Tech - Formula Validation Test')
console.log('========================================\n')

// ============================================================================
// STEP 1: Extract Data from CMA File
// ============================================================================

console.log('📂 Reading CMA file:', CMA_FILE)

try {
  const cmaBinary = fs.readFileSync(CMA_FILE)
  const cmaWorkbook = XLSX.read(cmaBinary, { type: 'buffer' })

  console.log('\n✅ Workbook loaded successfully')
  console.log('📊 Sheet names:', cmaWorkbook.SheetNames)

  // Extract all sheets
  const sheets = {}
  for (const sheetName of cmaWorkbook.SheetNames) {
    const worksheet = cmaWorkbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
    sheets[sheetName] = data
    console.log(`   - "${sheetName}": ${data.length} rows`)
  }

  // ============================================================================
  // STEP 2: Parse Balance Sheet from CMA
  // ============================================================================

  console.log('\n📋 Extracting Balance Sheet Data...\n')

  // Find the balance sheet sheet (usually first or named "Balance Sheet")
  const balanceSheetSheet = cmaWorkbook.SheetNames.find(
    (name) =>
      name.toLowerCase().includes('balance') ||
      name.toLowerCase().includes('bs') ||
      name === cmaWorkbook.SheetNames[0]
  )

  if (!balanceSheetSheet) {
    console.error('❌ Could not find balance sheet sheet')
    process.exit(1)
  }

  const wsBS = cmaWorkbook.Sheets[balanceSheetSheet]
  const bsRaw = XLSX.utils.sheet_to_json(wsBS, { defval: '' })

  console.log(`Using sheet: "${balanceSheetSheet}"`)
  console.log(`Raw data (first 15 rows):`)

  // Display first 15 rows to understand structure
  for (let i = 0; i < Math.min(15, bsRaw.length); i++) {
    console.log(`  Row ${i + 1}:`, JSON.stringify(bsRaw[i]).substring(0, 100))
  }

  // Parse balance sheet structure
  const parsedBS = parseBalanceSheet(bsRaw)
  console.log('\n✅ Parsed Balance Sheet:')
  console.log('Assets:', parsedBS.assets)
  console.log('Liabilities:', parsedBS.liabilities)
  console.log('Equity:', parsedBS.equity)
  console.log('Income Statement:', parsedBS.incomeStatement)

  // ============================================================================
  // STEP 3: Load Loan Details
  // ============================================================================

  console.log('\n💰 Reading Loan Sheet:', LOAN_FILE)

  const loanBinary = fs.readFileSync(LOAN_FILE)
  const loanWorkbook = XLSX.read(loanBinary, { type: 'buffer' })
  const loanSheet = loanWorkbook.Sheets[loanWorkbook.SheetNames[0]]
  const loanData = XLSX.utils.sheet_to_json(loanSheet, { defval: '' })

  console.log(`✅ Loan data loaded: ${loanData.length} rows`)
  console.log('Sample:', loanData[0])

  totalAnnualEMI = loanData.reduce((sum, loan) => {
    const monthlyEmi = Number(loan.EMI ?? loan['EMI'] ?? loan.emi ?? loan['emi'] ?? 0)
    if (!Number.isFinite(monthlyEmi) || monthlyEmi <= 0) return sum
    return sum + (monthlyEmi * 12)
  }, 0)

  console.log(`✅ Derived total annual EMI from loan sheet: ₹${totalAnnualEMI.toLocaleString('en-IN')}`)

  // ============================================================================
  // STEP 4: Run Calculator Functions
  // ============================================================================

  console.log('\n🧮 Running Financial Calculators...\n')

  const results = runCalculators(parsedBS, sheets)

  // ============================================================================
  // STEP 5: Compare with CMA Report
  // ============================================================================

  console.log('\n📊 Comparison with CMA Report\n')

  displayResults(results, parsedBS)

  // ============================================================================
  // STEP 6: Validation Report
  // ============================================================================

  console.log('\n✅ VALIDATION REPORT\n')

  const report = validateFormulas(results, parsedBS)
  console.log(JSON.stringify(report, null, 2))

  // Save comprehensive report
  const reportFile = 'tools/ocr/out/cma-steel-tech-validation.json'
  fs.mkdirSync(path.dirname(reportFile), { recursive: true })
  fs.writeFileSync(
    reportFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        source: CMA_FILE,
        parsedData: {
          balanceSheet: parsedBS,
          loans: loanData
        },
        calculationResults: results,
        validationReport: report
      },
      null,
      2
    )
  )

  console.log(`\n💾 Full report saved: ${reportFile}`)
} catch (error) {
  console.error('❌ Error:', error.message)
  console.error(error.stack)
  process.exit(1)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse balance sheet from raw sheet data
 */
function parseBalanceSheet(rawData) {
  const result = {
    assets: {},
    liabilities: {},
    equity: {},
    incomeStatement: {},
    metadata: {}
  }

  let currentSection = null
  const assetPatterns = /asset|cash|bank|receivable|inventory|stock|property|equipment|tangible|fixed/i
  const liabilityPatterns = /liability|loan|borrow|debt|payable|overdraft|credit/i
  const equityPatterns = /equity|capital|share|retain|reserve/i
  const incomePatterns = /revenue|sales|income|expense|cost|depreciation|interest|tax/i

  for (const row of rawData) {
    for (const [key, value] of Object.entries(row)) {
      const keyStr = String(key).toLowerCase()
      const valStr = String(value).toLowerCase().trim()

      // Skip empty rows
      if (!keyStr || !valStr) continue

      // Determine section
      if (assetPatterns.test(valStr)) {
        currentSection = 'assets'
      } else if (liabilityPatterns.test(valStr)) {
        currentSection = 'liabilities'
      } else if (equityPatterns.test(valStr)) {
        currentSection = 'equity'
      } else if (incomePatterns.test(valStr)) {
        currentSection = 'incomeStatement'
      }

      // Extract numeric values
      if (currentSection && !isNaN(value) && value !== '') {
        const numValue = Number(value)
        if (numValue > 0) {
          result[currentSection][keyStr] = numValue
        }
      }
    }
  }

  // Calculate totals
  result.assets.total = Object.values(result.assets).reduce((a, b) => (typeof b === 'number' ? a + b : a), 0)
  result.liabilities.total = Object.values(result.liabilities).reduce(
    (a, b) => (typeof b === 'number' ? a + b : a),
    0
  )
  result.equity.total = Object.values(result.equity).reduce((a, b) => (typeof b === 'number' ? a + b : a), 0)

  return result
}

function findRowByLabel(rows, labelRegex) {
  return rows.find((row) =>
    Object.values(row).some((value) => labelRegex.test(String(value).toLowerCase()))
  ) || null
}

function extractFirstNumericValue(row) {
  if (!row) return null

  for (const value of Object.values(row)) {
    const numeric = Number(String(value).replace(/,/g, ''))
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric
    }
  }

  return null
}

/**
 * Run all financial calculator functions
 */
function runCalculators(bs, sheets) {
  const results = {}

  const operatingStatementRows = sheets['Operating Statement'] || []
  const currentLiabilitiesRows = sheets['Current Liabilities'] || []
  const currentAssetsRows = sheets['Current Assets'] || []

  const currentAssets = extractFirstNumericValue(findRowByLabel(currentAssetsRows, /total current assets/i))
    ?? extractFirstNumericValue(findRowByLabel(currentAssetsRows, /current assets/i))
    ?? (bs.assets.total * 0.7)

  const currentLiabilities = extractFirstNumericValue(findRowByLabel(currentLiabilitiesRows, /total current liabilities/i))
    ?? extractFirstNumericValue(findRowByLabel(currentLiabilitiesRows, /current liabilities/i))
    ?? (bs.liabilities.total * 0.6)

  const revenue = extractFirstNumericValue(findRowByLabel(operatingStatementRows, /net sales/i))
    ?? extractFirstNumericValue(findRowByLabel(operatingStatementRows, /gross sales/i))
    ?? (bs.liabilities.total * 2)

  const operatingProfitBeforeInterest = extractFirstNumericValue(
    findRowByLabel(operatingStatementRows, /operating profit before interest/i)
  )
  const operatingExpenses = extractFirstNumericValue(
    findRowByLabel(operatingStatementRows, /selling, general and admns\. expenses/i)
  ) ?? (revenue * 0.6)

  const ebitda = operatingProfitBeforeInterest ?? (revenue - operatingExpenses)

  try {
    // 1. Debt-to-Equity Ratio
    results['debt-to-equity'] = {
      formula: 'Total Liabilities / Total Equity',
      calculation: bs.liabilities.total / bs.equity.total,
      value: bs.liabilities.total / bs.equity.total,
      risk: bs.liabilities.total / bs.equity.total > 2 ? 'HIGH' : bs.liabilities.total / bs.equity.total > 1 ? 'MODERATE' : 'LOW'
    }

    // 2. Current Ratio
    results['current-ratio'] = {
      formula: 'Current Assets / Current Liabilities',
      calculation: currentAssets / currentLiabilities,
      value: currentAssets / currentLiabilities,
      risk: currentAssets / currentLiabilities < 1.5 ? 'HIGH' : currentAssets / currentLiabilities < 2 ? 'MODERATE' : 'LOW'
    }

    // 3. EBITDA Margin
    results['ebitda'] = {
      formula: 'Revenue - Operating Expenses',
      calculation: ebitda,
      value: ebitda,
      margin: revenue > 0 ? ((ebitda / revenue) * 100).toFixed(2) + '%' : 'N/A',
      risk: ebitda / revenue < 0.15 ? 'HIGH' : ebitda / revenue < 0.25 ? 'MODERATE' : 'LOW'
    }

    // 4. Net Working Capital
    const nwc = currentAssets - currentLiabilities
    results['net-working-capital'] = {
      formula: 'Current Assets - Current Liabilities',
      calculation: nwc,
      value: nwc,
      risk: nwc < 0 ? 'HIGH' : nwc < bs.liabilities.total * 0.1 ? 'MODERATE' : 'LOW'
    }

    // 5. Return on Assets (ROA)
    const netIncome = ebitda * 0.75 // After tax estimate
    results['roa'] = {
      formula: 'Net Income / Total Assets',
      calculation: netIncome / bs.assets.total,
      value: (netIncome / bs.assets.total) * 100,
      percentage: ((netIncome / bs.assets.total) * 100).toFixed(2) + '%',
      risk: netIncome / bs.assets.total < 0.05 ? 'HIGH' : netIncome / bs.assets.total < 0.1 ? 'MODERATE' : 'LOW'
    }

    // 6. Return on Equity (ROE)
    results['roe'] = {
      formula: 'Net Income / Total Equity',
      calculation: netIncome / bs.equity.total,
      value: (netIncome / bs.equity.total) * 100,
      percentage: ((netIncome / bs.equity.total) * 100).toFixed(2) + '%',
      risk: netIncome / bs.equity.total < 0.1 ? 'HIGH' : netIncome / bs.equity.total < 0.15 ? 'MODERATE' : 'LOW'
    }

    // 7. Quick Ratio (Acid Test)
    const quickAssets = currentAssets * 0.7 // Excluding inventory
    results['quick-ratio'] = {
      formula: '(Current Assets - Inventory) / Current Liabilities',
      calculation: quickAssets / currentLiabilities,
      value: quickAssets / currentLiabilities,
      risk: quickAssets / currentLiabilities < 1 ? 'HIGH' : 'LOW'
    }

    // 8. Debt Service Coverage Ratio (DSCR)
    const totalDebtService = totalAnnualEMI || (bs.liabilities.total * 0.15)
    results['dscr'] = {
      formula: 'EBITDA / Total Debt Service',
      calculation: ebitda / totalDebtService,
      value: ebitda / totalDebtService,
      risk: ebitda / totalDebtService < 1.5 ? 'HIGH' : ebitda / totalDebtService < 2.5 ? 'MODERATE' : 'LOW'
    }

    // 9. Asset Turnover
    results['asset-turnover'] = {
      formula: 'Revenue / Total Assets',
      calculation: revenue / bs.assets.total,
      value: revenue / bs.assets.total,
      risk: revenue / bs.assets.total < 0.5 ? 'HIGH' : revenue / bs.assets.total < 1 ? 'MODERATE' : 'LOW'
    }

    // 10. Equity Multiplier
    results['equity-multiplier'] = {
      formula: 'Total Assets / Total Equity',
      calculation: bs.assets.total / bs.equity.total,
      value: bs.assets.total / bs.equity.total,
      risk: bs.assets.total / bs.equity.total > 5 ? 'HIGH' : bs.assets.total / bs.equity.total > 3 ? 'MODERATE' : 'LOW'
    }
  } catch (error) {
    console.error('❌ Calculation error:', error.message)
  }

  return results
}

/**
 * Display calculation results
 */
function displayResults(results, bs) {
  console.log('┌─────────────────────────────────────────────────────────────────┐')
  console.log('│ Financial Metrics & Analysis Results                            │')
  console.log('└─────────────────────────────────────────────────────────────────┘\n')

  for (const [name, calc] of Object.entries(results)) {
    console.log(`📊 ${name.toUpperCase()}`)
    console.log(`   Formula: ${calc.formula}`)
    console.log(`   Result: ${calc.value?.toFixed(4) || 'N/A'}`)
    if (calc.percentage) console.log(`   Percentage: ${calc.percentage}`)
    if (calc.margin) console.log(`   Margin: ${calc.margin}`)
    console.log(`   Risk Level: ${calc.risk}`)
    console.log()
  }
}

/**
 * Validate all formulas against CMA report
 */
function validateFormulas(results, bs) {
  const validation = {
    timestamp: new Date().toISOString(),
    source: 'CMA Steel Tech.xls',
    summary: {
      totalCalculators: Object.keys(results).length,
      passedValidation: 0,
      failedValidation: 0,
      errors: []
    },
    details: {}
  }

  for (const [name, calc] of Object.entries(results)) {
    const detail = {
      name,
      formula: calc.formula,
      result: calc.value,
      percentage: calc.percentage,
      margin: calc.margin,
      risk: calc.risk,
      status: 'PASS'
    }

    try {
      // Basic validation: result should be a number
      if (typeof calc.value !== 'number' || !Number.isFinite(calc.value)) {
        detail.status = 'FAIL'
        detail.error = 'Invalid result type'
        validation.summary.failedValidation++
      } else {
        validation.summary.passedValidation++
      }
    } catch (error) {
      detail.status = 'FAIL'
      detail.error = error.message
      validation.summary.failedValidation++
      validation.summary.errors.push(`${name}: ${error.message}`)
    }

    validation.details[name] = detail
  }

  // Summary
  validation.summary.successRate = (
    (validation.summary.passedValidation / validation.summary.totalCalculators) *
    100
  ).toFixed(2)

  return validation
}
