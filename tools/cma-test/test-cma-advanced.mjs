#!/usr/bin/env node

/**
 * CMA Steel Tech - Advanced Data Extractor
 * 
 * Extracts balance sheet, income statement, and financial data
 * from the CMA report and validates against financial calculators
 */

import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'

const DATA_DIR = 'steel tech'
const CMA_FILE = path.join(DATA_DIR, 'CMA Steel Tech.xls')
const LOAN_FILE = path.join(DATA_DIR, 'Loan Sheet1.xlsx')

console.log('\n' + '='.repeat(70))
console.log('CMA Steel Tech Engineering - Comprehensive Analysis')
console.log('='.repeat(70) + '\n')

try {
  // Read CMA file
  const cmaBinary = fs.readFileSync(CMA_FILE)
  const cmaWorkbook = XLSX.read(cmaBinary, { type: 'buffer' })

  // Read Loan file
  const loanBinary = fs.readFileSync(LOAN_FILE)
  const loanWorkbook = XLSX.read(loanBinary, { type: 'buffer' })

  // ========================================================================
  // EXTRACT DATA FROM EACH SHEET
  // ========================================================================

  console.log('📊 SHEET CONTENTS:\n')

  const sheetData = {}
  for (const sheetName of cmaWorkbook.SheetNames) {
    const ws = cmaWorkbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
    sheetData[sheetName] = data

    console.log(`\n📄 ${sheetName} (${data.length} rows)`)
    console.log('─'.repeat(70))

    if (data.length > 0) {
      // Show first 8 rows with clean output
      for (let i = 0; i < Math.min(8, data.length); i++) {
        const row = data[i]
        const cleanRow = Object.entries(row)
          .filter(([k, v]) => v !== '' && v !== null)
          .slice(0, 4)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ')

        if (cleanRow) {
          console.log(`  Row ${i + 1}: ${cleanRow}`)
        }
      }
      if (data.length > 8) console.log(`  ... and ${data.length - 8} more rows`)
    }
  }

  // ========================================================================
  // EXTRACT BALANCE SHEET FROM "Financial Position" SHEET
  // ========================================================================

  console.log('\n\n' + '='.repeat(70))
  console.log('💼 BALANCE SHEET EXTRACTION')
  console.log('='.repeat(70) + '\n')

  const fpData = sheetData['Financial Position']
  const balanceSheet = extractBalanceSheet(fpData)

  console.log('✅ Assets:')
  for (const [name, amount] of Object.entries(balanceSheet.assets)) {
    if (typeof amount === 'number') {
      console.log(`   ${name.padEnd(40)} ₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`)
    }
  }

  console.log('\n✅ Liabilities:')
  for (const [name, amount] of Object.entries(balanceSheet.liabilities)) {
    if (typeof amount === 'number') {
      console.log(`   ${name.padEnd(40)} ₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`)
    }
  }

  console.log('\n✅ Equity:')
  for (const [name, amount] of Object.entries(balanceSheet.equity)) {
    if (typeof amount === 'number') {
      console.log(`   ${name.padEnd(40)} ₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`)
    }
  }

  // ========================================================================
  // EXTRACT INCOME STATEMENT FROM "Operating Statement" SHEET
  // ========================================================================

  console.log('\n\n' + '='.repeat(70))
  console.log('📈 INCOME STATEMENT EXTRACTION')
  console.log('='.repeat(70) + '\n')

  const osData = sheetData['Operating Statement']
  const incomeStatement = extractIncomeStatement(osData)

  console.log('Revenue & Sales:')
  for (const [name, amount] of Object.entries(incomeStatement.revenue)) {
    if (typeof amount === 'number') {
      console.log(`   ${name.padEnd(40)} ₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`)
    }
  }

  console.log('\nExpenses & Costs:')
  for (const [name, amount] of Object.entries(incomeStatement.expenses)) {
    if (typeof amount === 'number') {
      console.log(`   ${name.padEnd(40)} ₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`)
    }
  }

  console.log('\nProfitability:')
  for (const [name, amount] of Object.entries(incomeStatement.profitability)) {
    if (typeof amount === 'number') {
      console.log(`   ${name.padEnd(40)} ₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`)
    }
  }

  // ========================================================================
  // EXTRACT LOAN/DEBT DETAILS
  // ========================================================================

  console.log('\n\n' + '='.repeat(70))
  console.log('💰 LOAN & DEBT DETAILS')
  console.log('='.repeat(70) + '\n')

  const loanSheet = loanWorkbook.Sheets[loanWorkbook.SheetNames[0]]
  const loanData = XLSX.utils.sheet_to_json(loanSheet, { defval: '' })

  const debtSummary = extractDebtDetails(loanData)

  console.log(`Total Loan Amount: ₹${debtSummary.totalSanctioned.toLocaleString('en-IN')}`)
  console.log(`Total Outstanding: ₹${debtSummary.totalOutstanding.toLocaleString('en-IN')}`)
  console.log(`Total Annual EMI: ₹${debtSummary.totalAnnualEMI.toLocaleString('en-IN')}`)
  console.log(`Number of Loans: ${debtSummary.loanCount}`)

  console.log('\n📋 Loan Details:')
  for (const loan of debtSummary.loans) {
    console.log(`\n   Bank: ${loan.bankName}`)
    console.log(`   Type: ${loan.loanType}`)
    console.log(`   Amount: ₹${loan.sanctionAmount.toLocaleString('en-IN')}`)
    console.log(`   Outstanding: ₹${loan.outstanding.toLocaleString('en-IN')}`)
    console.log(`   EMI: ₹${loan.emi.toLocaleString('en-IN')} | ROI: ${loan.roi}% | Tenure: ${loan.tenure} months`)
  }

  // ========================================================================
  // RUN FINANCIAL CALCULATORS
  // ========================================================================

  console.log('\n\n' + '='.repeat(70))
  console.log('🧮 FINANCIAL RATIO ANALYSIS')
  console.log('='.repeat(70) + '\n')

  const results = runCalculators(balanceSheet, incomeStatement, debtSummary)

  for (const [name, calc] of Object.entries(results)) {
    console.log(`\n📊 ${name.toUpperCase()}`)
    console.log(`   Formula: ${calc.formula}`)
    console.log(
      `   Value: ${typeof calc.value === 'number' ? calc.value.toFixed(2) : calc.value || 'N/A'}`
    )
    if (calc.percentage) console.log(`   Percentage: ${calc.percentage}`)
    console.log(`   Risk: ${calc.risk}`)
    if (calc.interpretation) console.log(`   Interpretation: ${calc.interpretation}`)
  }

  // ========================================================================
  // SAVE COMPREHENSIVE REPORT
  // ========================================================================

  console.log('\n\n' + '='.repeat(70))
  console.log('💾 SAVING COMPREHENSIVE REPORT')
  console.log('='.repeat(70) + '\n')

  const reportDir = 'tools/ocr/out'
  fs.mkdirSync(reportDir, { recursive: true })

  const fullReport = {
    company: 'Steel Tech Engineering',
    timestamp: new Date().toISOString(),
    source: CMA_FILE,
    balanceSheet,
    incomeStatement,
    debtSummary,
    financialRatios: results,
    validation: validateAllCalculations(balanceSheet, incomeStatement, debtSummary, results)
  }

  fs.writeFileSync(path.join(reportDir, 'cma-steel-tech-complete.json'), JSON.stringify(fullReport, null, 2))

  // ========================================================================
  // GENERATE CMA REPORT MATCHING THE ORIGINAL FORMAT
  // ========================================================================

  console.log('\n' + '='.repeat(70))
  console.log('📑 CMA REPORT SUMMARY')
  console.log('='.repeat(70) + '\n')

  generateCMAReport(fullReport)

  console.log(`\n✅ Reports saved:`)
  console.log(`   - ${path.join(reportDir, 'cma-steel-tech-complete.json')}`)
  console.log(`   - ${path.join(reportDir, 'cma-steel-tech-report.txt')}`)
} catch (error) {
  console.error('❌ Error:', error.message)
  console.error(error.stack)
  process.exit(1)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract balance sheet data from Financial Position sheet
 */
function extractBalanceSheet(data) {
  const bs = {
    assets: {},
    liabilities: {},
    equity: {},
    metadata: { extractedAt: new Date().toISOString(), rows: data.length }
  }

  let currentSection = null
  const numericColumns = ['__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6']

  for (const row of data) {
    const label = String(row.__EMPTY_1 || '').toLowerCase().trim()

    // Detect sections
    if (label.includes('assets')) currentSection = 'assets'
    else if (label.includes('liabilities')) currentSection = 'liabilities'
    else if (label.includes('equity') || label.includes('capital')) currentSection = 'equity'

    // Extract latest values from numeric columns
    if (currentSection && label && !label.includes('total')) {
      let latestValue = 0
      for (const col of numericColumns) {
        const val = Number(row[col])
        if (!isNaN(val) && val > 0) latestValue = val
      }

      if (latestValue > 0) {
        bs[currentSection][label] = latestValue
      }
    }
  }

  // Calculate totals
  bs.assets.total = Object.values(bs.assets).reduce((a, b) => (typeof b === 'number' ? a + b : a), 0)
  bs.liabilities.total = Object.values(bs.liabilities).reduce((a, b) => (typeof b === 'number' ? a + b : a), 0)
  bs.equity.total = Object.values(bs.equity).reduce((a, b) => (typeof b === 'number' ? a + b : a), 0)

  return bs
}

/**
 * Extract income statement data from Operating Statement sheet
 */
function extractIncomeStatement(data) {
  const is = {
    revenue: {},
    expenses: {},
    profitability: {},
    metadata: { extractedAt: new Date().toISOString(), rows: data.length }
  }

  let currentSection = null
  const numericColumns = ['__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6']

  for (const row of data) {
    const label = String(row.__EMPTY_1 || '').toLowerCase().trim()

    // Detect sections
    if (label.includes('sales') || label.includes('revenue') || label.includes('gross')) {
      currentSection = 'revenue'
    } else if (
      label.includes('expense') ||
      label.includes('cost') ||
      label.includes('material') ||
      label.includes('labor')
    ) {
      currentSection = 'expenses'
    } else if (label.includes('profit') || label.includes('ebit') || label.includes('ebdit')) {
      currentSection = 'profitability'
    }

    // Extract values
    if (currentSection && label && label.length > 3) {
      let latestValue = 0
      for (const col of numericColumns) {
        const val = Number(row[col])
        if (!isNaN(val) && val > 0) latestValue = val
      }

      if (latestValue > 0) {
        is[currentSection][label] = latestValue
      }
    }
  }

  return is
}

/**
 * Extract debt/loan details
 */
function extractDebtDetails(loanData) {
  let totalSanctioned = 0
  let totalOutstanding = 0
  let totalAnnualEMI = 0
  const loans = []

  for (const loan of loanData) {
    const sanctionAmount = Number(loan['Sanction Amt ']) || 0
    const outstanding = Number(loan['Otstanding ']) || 0
    const emi = Number(loan['EMI']) || 0

    if (sanctionAmount > 0) {
      totalSanctioned += sanctionAmount
      totalOutstanding += outstanding
      totalAnnualEMI += emi * 12 // EMI is monthly

      loans.push({
        bankName: loan['Name Of Bank'] || 'Unknown',
        loanType: loan['Type of Loan'] || 'Unknown',
        sanctionAmount,
        outstanding,
        emi,
        roi: Number(loan['Roi ']) || 0,
        tenure: Number(loan['Tenure ']) || 0
      })
    }
  }

  return {
    totalSanctioned,
    totalOutstanding,
    totalAnnualEMI,
    loanCount: loans.length,
    loans
  }
}

/**
 * Run financial calculators with actual data
 */
function runCalculators(bs, is, debt) {
  const results = {}

  try {
    // 1. Debt-to-Equity Ratio
    const de = bs.liabilities.total / (bs.equity.total || 1)
    results['debt-to-equity'] = {
      formula: 'Total Liabilities / Total Equity',
      value: de,
      risk: de > 2 ? 'HIGH' : de > 1 ? 'MODERATE' : 'LOW',
      interpretation: `${de.toFixed(2)}:1 leverage ratio. ${de > 1 ? 'High debt' : 'Balanced'} capital structure.`
    }

    // 2. Current Ratio (using debt/equity as proxy for current vs fixed)
    const cr = bs.assets.total / (bs.liabilities.total || 1)
    results['current-ratio'] = {
      formula: 'Total Assets / Total Liabilities',
      value: cr,
      risk: cr < 1.5 ? 'HIGH' : cr < 2 ? 'MODERATE' : 'LOW',
      interpretation: `${cr.toFixed(2)}x coverage. Asset coverage ${cr > 2 ? 'strong' : 'adequate'}.`
    }

    // 3. EBITDA & Margin
    const totalRevenue = Object.values(is.revenue).reduce((a, b) => a + b, 0) || 1
    const totalExpenses = Object.values(is.expenses).reduce((a, b) => a + b, 0) || 0
    const ebitda = totalRevenue - totalExpenses
    const margin = (ebitda / totalRevenue) * 100

    results['ebitda-margin'] = {
      formula: '(Revenue - Operating Expenses) / Revenue * 100',
      value: ebitda,
      percentage: margin.toFixed(2) + '%',
      risk: margin < 15 ? 'HIGH' : margin < 25 ? 'MODERATE' : 'LOW',
      interpretation: `${margin.toFixed(2)}% operating margin. ${margin > 25 ? 'Excellent' : margin > 15 ? 'Healthy' : 'Below target'} profitability.`
    }

    // 4. Net Working Capital
    const nwc = bs.assets.total - bs.liabilities.total
    results['net-working-capital'] = {
      formula: 'Total Assets - Total Liabilities',
      value: nwc,
      risk: nwc < 0 ? 'HIGH' : nwc < bs.liabilities.total * 0.1 ? 'MODERATE' : 'LOW',
      interpretation: `₹${nwc.toLocaleString('en-IN')}. ${nwc > 0 ? 'Positive' : 'Negative'} working capital indicates ${nwc > 0 ? 'operational flexibility' : 'liquidity stress'}.`
    }

    // 5. ROA (Return on Assets)
    const netIncome = ebitda * 0.75 // After tax estimate
    const roa = (netIncome / bs.assets.total) * 100

    results['roa'] = {
      formula: 'Net Income / Total Assets * 100',
      value: roa,
      percentage: roa.toFixed(2) + '%',
      risk: roa < 5 ? 'HIGH' : roa < 10 ? 'MODERATE' : 'LOW',
      interpretation: `${roa.toFixed(2)}% return on assets. ${roa > 10 ? 'Excellent' : roa > 5 ? 'Satisfactory' : 'Below target'} asset utilization.`
    }

    // 6. ROE (Return on Equity)
    const roe = (netIncome / (bs.equity.total || 1)) * 100

    results['roe'] = {
      formula: 'Net Income / Total Equity * 100',
      value: roe,
      percentage: roe.toFixed(2) + '%',
      risk: roe < 10 ? 'HIGH' : roe < 15 ? 'MODERATE' : 'LOW',
      interpretation: `${roe.toFixed(2)}% return on equity. Investor returns are ${roe > 15 ? 'excellent' : roe > 10 ? 'good' : 'below expectations'}.`
    }

    // 7. DSCR (Debt Service Coverage Ratio)
    const annualDebtService = debt.totalAnnualEMI || 1
    const dscr = ebitda / annualDebtService

    results['dscr'] = {
      formula: 'EBITDA / Total Annual Debt Service',
      value: dscr,
      risk: dscr < 1.5 ? 'HIGH' : dscr < 2.5 ? 'MODERATE' : 'LOW',
      interpretation: `${dscr.toFixed(2)}x coverage. Debt servicing capacity is ${dscr > 2.5 ? 'strong' : dscr > 1.5 ? 'adequate' : 'at risk'}.`
    }

    // 8. Loan to Value Ratio
    const ltv = (debt.totalOutstanding / bs.assets.total) * 100

    results['loan-to-value'] = {
      formula: 'Total Outstanding Debt / Total Assets * 100',
      value: ltv,
      percentage: ltv.toFixed(2) + '%',
      risk: ltv > 70 ? 'HIGH' : ltv > 50 ? 'MODERATE' : 'LOW',
      interpretation: `${ltv.toFixed(2)}% LTV. Asset coverage for debt is ${ltv < 50 ? 'strong' : ltv < 70 ? 'adequate' : 'high'}.`
    }

    // 9. Interest Coverage Ratio
    const debtExpense = debt.loans.reduce((sum, l) => sum + l.emi * 12 * (l.roi / 100), 0)
    const icr = ebitda / (debtExpense || 1)

    results['interest-coverage'] = {
      formula: 'EBITDA / Annual Interest Expense',
      value: icr,
      risk: icr < 2 ? 'HIGH' : icr < 3 ? 'MODERATE' : 'LOW',
      interpretation: `${icr.toFixed(2)}x coverage. Interest servicing capacity is ${icr > 3 ? 'strong' : icr > 2 ? 'adequate' : 'stressed'}.`
    }

    // 10. Asset Turnover
    const assetTurnover = totalRevenue / bs.assets.total

    results['asset-turnover'] = {
      formula: 'Revenue / Total Assets',
      value: assetTurnover,
      risk: assetTurnover < 0.5 ? 'HIGH' : assetTurnover < 1 ? 'MODERATE' : 'LOW',
      interpretation: `${assetTurnover.toFixed(2)}x turnover. Asset efficiency is ${assetTurnover > 1 ? 'excellent' : assetTurnover > 0.5 ? 'satisfactory' : 'below par'}.`
    }
  } catch (error) {
    console.error('❌ Calculation error:', error.message)
  }

  return results
}

/**
 * Validate all calculations
 */
function validateAllCalculations(bs, is, debt, results) {
  const validation = {
    timestamp: new Date().toISOString(),
    balanceSheetValidation: validateBalanceSheet(bs),
    ratioValidation: validateRatios(results),
    debtValidation: validateDebt(debt)
  }

  return validation
}

function validateBalanceSheet(bs) {
  return {
    assetsEquation: bs.assets.total === bs.liabilities.total + bs.equity.total ? 'PASS' : 'ALERT',
    totalAssets: bs.assets.total,
    totalLiabilities: bs.liabilities.total,
    totalEquity: bs.equity.total,
    equityPercent: ((bs.equity.total / bs.assets.total) * 100).toFixed(2) + '%'
  }
}

function validateRatios(results) {
  return Object.entries(results).map(([name, calc]) => ({
    name,
    value: calc.value,
    risk: calc.risk,
    isValid: typeof calc.value === 'number' && !isNaN(calc.value) && isFinite(calc.value)
  }))
}

function validateDebt(debt) {
  return {
    totalOutstandingDebt: debt.totalOutstanding,
    totalAnnualEMI: debt.totalAnnualEMI,
    monthlyEMI: debt.totalAnnualEMI / 12,
    loanCount: debt.loanCount,
    avgLoanSize: debt.totalSanctioned / (debt.loanCount || 1)
  }
}

/**
 * Generate CMA format report
 */
function generateCMAReport(report) {
  const txt = `
CMA REPORT - STEEL TECH ENGINEERING
Generated: ${new Date().toISOString()}

═══════════════════════════════════════════════════════════════════════
BALANCE SHEET SUMMARY
═══════════════════════════════════════════════════════════════════════

Total Assets:                    ₹${report.balanceSheet.assets.total.toLocaleString('en-IN')}
Total Liabilities:               ₹${report.balanceSheet.liabilities.total.toLocaleString('en-IN')}
Total Equity:                    ₹${report.balanceSheet.equity.total.toLocaleString('en-IN')}

═══════════════════════════════════════════════════════════════════════
INCOME STATEMENT SUMMARY
═══════════════════════════════════════════════════════════════════════

Total Revenue:                   ₹${Object.values(report.incomeStatement.revenue).reduce((a, b) => a + b, 0).toLocaleString('en-IN')}
Total Operating Expenses:        ₹${Object.values(report.incomeStatement.expenses).reduce((a, b) => a + b, 0).toLocaleString('en-IN')}

═══════════════════════════════════════════════════════════════════════
FINANCIAL RATIOS & ANALYSIS
═══════════════════════════════════════════════════════════════════════

${Object.entries(report.financialRatios)
  .map(
    ([name, calc]) =>
      `${name.toUpperCase().padEnd(30)} : ${(typeof calc.value === 'number' ? calc.value.toFixed(2) : calc.value).padEnd(15)} [${calc.risk}]`
  )
  .join('\n')}

═══════════════════════════════════════════════════════════════════════
DEBT SUMMARY
═══════════════════════════════════════════════════════════════════════

Total Outstanding Debt:          ₹${report.debtSummary.totalOutstanding.toLocaleString('en-IN')}
Total Annual EMI:                ₹${report.debtSummary.totalAnnualEMI.toLocaleString('en-IN')}
Number of Loans:                 ${report.debtSummary.loanCount}

═══════════════════════════════════════════════════════════════════════
VALIDATION STATUS
═══════════════════════════════════════════════════════════════════════

Balance Sheet Equation:          ${report.validation.balanceSheetValidation.assetsEquation}
Equity to Assets Ratio:          ${report.validation.balanceSheetValidation.equityPercent}
Valid Financial Ratios:          ${report.validation.ratioValidation.filter((r) => r.isValid).length}/${report.validation.ratioValidation.length}
`

  fs.writeFileSync('tools/ocr/out/cma-steel-tech-report.txt', txt)
}
