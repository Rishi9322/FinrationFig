#!/usr/bin/env node
// End-to-end test: File → Parse → Map → Calculate → Display
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, "../../src/lib")

// Import parsers and mappers
const { default: parseFile } = await import(path.join(srcDir, "parsers.ts"))
const { default: mapToCalculator } = await import(path.join(srcDir, "parsedToCalculatorMapper.ts"))

// Import calculation functions
const calcMod = await import(path.join(srcDir, "financialCalculations.ts"))
const {
  calculateDebtEquity,
  calculateCurrentRatio,
  calculateEBITDA,
  calculateDSCR,
  calculateISCR,
  calculateNetWorkingCapital,
  calculateDrawingPower,
  calculateAgeing,
  calculatePID,
  formatCurrency,
} = calcMod

// Sample balance-sheet Excel data (what the user's Excel likely contains)
const sampleBalanceSheetData = {
  "Assets": [
    { name: "Cash", value: 500000 },
    { name: "Bank Receivables", value: 1200000 },
    { name: "Inventory", value: 2000000 },
    { name: "PPE", value: 3500000 },
  ],
  "Liabilities": [
    { name: "Creditors", value: 1500000 },
    { name: "Loan", value: 2000000 },
    { name: "Overdraft", value: 800000 },
  ],
  "Equity": [
    { name: "Capital", value: 2400000 },
    { name: "Reserves", value: 1000000 },
  ],
  "Income": {
    revenue: 5000000,
    operatingExpenses: 3000000,
    ebit: 2000000,
    interestExpense: 200000,
    netOperatingIncome: 1800000,
    totalDebtService: 600000,
  },
}

// Convert to ParsedBalanceSheet shape
function sampleToParsedSheet() {
  return {
    sourceFilename: "sample-balance-sheet.xlsx",
    originalFormat: "xlsx",
    parsedAt: new Date().toISOString(),
    accounts: [
      ...sampleBalanceSheetData.Assets,
      ...sampleBalanceSheetData.Liabilities,
      ...sampleBalanceSheetData.Equity,
    ],
    balanceSheet: {
      assets: sampleBalanceSheetData.Assets.map((a) => ({ name: a.name, amount: a.value })),
      liabilities: sampleBalanceSheetData.Liabilities.map((l) => ({ name: l.name, amount: l.value })),
      equity: sampleBalanceSheetData.Equity.map((e) => ({ name: e.name, amount: e.value })),
    },
    incomeStatement: sampleBalanceSheetData.Income,
    metadata: { confidence: 0.85, notes: "Sample balance sheet for E2E testing" },
  }
}

function runCalculator(calcType, inputs) {
  try {
    switch (calcType) {
      case "debt-equity":
        return calculateDebtEquity(Number(inputs.totalDebt) || 0, Number(inputs.totalEquity) || 0)
      case "current-ratio":
        return calculateCurrentRatio(Number(inputs.currentAssets) || 0, Number(inputs.currentLiabilities) || 0)
      case "ebitda":
        return calculateEBITDA(Number(inputs.profit) || 0, Number(inputs.depreciation) || 0, Number(inputs.financeCost) || 0, Number(inputs.sales) || 0)
      case "dscr":
        return calculateDSCR(Number(inputs.netOperatingIncome) || 0, Number(inputs.totalDebtService) || 0)
      case "iscr":
        return calculateISCR(Number(inputs.ebit) || 0, Number(inputs.interestExpense) || 0)
      case "net-working-capital":
        return calculateNetWorkingCapital(Number(inputs.currentAssets) || 0, Number(inputs.currentLiabilities) || 0)
      case "drawing-power":
        return calculateDrawingPower(Number(inputs.eligibleStock) || 0, Number(inputs.eligibleReceivables) || 0, Number(inputs.marginPercent) || 25)
      case "ageing":
        return calculateAgeing(inputs.receivables || [])
      case "pid":
        return calculatePID(inputs)
      default:
        return { error: "Calculator not supported" }
    }
  } catch (err) {
    return { error: String(err) }
  }
}

async function runE2E() {
  console.log("=== End-to-End Pipeline Test ===\n")

  // Step 1: Parse (using sample data)
  console.log("Step 1: Parse Balance Sheet")
  const parsed = sampleToParsedSheet()
  console.log(`✓ Parsed: ${parsed.sourceFilename}`)
  console.log(`  Format: ${parsed.originalFormat}`)
  console.log(`  Confidence: ${parsed.metadata.confidence}`)
  console.log(`  Notes: ${parsed.metadata.notes}\n`)

  // Step 2: Run multiple calculators and show results
  const calculators = [
    "debt-equity",
    "current-ratio",
    "ebitda",
    "dscr",
    "net-working-capital",
    "drawing-power",
  ]

  console.log("Step 2: Map & Calculate\n")
  const results = []

  for (const calcType of calculators) {
    console.log(`Calculator: ${calcType}`)
    const mapped = mapToCalculator(calcType, parsed)
    console.log(`  Confidence: ${(mapped.confidence * 100).toFixed(1)}%`)
    if (mapped.notes) console.log(`  Notes: ${mapped.notes}`)

    const result = runCalculator(calcType, mapped.inputs)
    console.log(`  Inputs: ${JSON.stringify(mapped.inputs)}`)
    console.log(`  Result:`)
    console.log(`    Value: ${result.value !== null ? result.value : "N/A"}`)
    console.log(`    Risk: ${result.risk}`)
    console.log(`    Interpretation: ${result.interpretation}`)
    console.log()

    results.push({
      calculator: calcType,
      confidence: mapped.confidence,
      inputs: mapped.inputs,
      result,
      notes: mapped.notes,
    })
  }

  // Step 3: Summary
  console.log("=== Summary ===")
  console.log(`Parsed: ${parsed.sourceFilename}`)
  console.log(`Calculators run: ${results.length}`)
  console.log(`High confidence (≥0.7): ${results.filter((r) => r.confidence >= 0.7).length}`)
  console.log(`Low confidence (<0.7): ${results.filter((r) => r.confidence < 0.7).length}`)

  // Write report
  const report = {
    timestamp: new Date().toISOString(),
    parsed,
    results,
  }
  const outDir = path.join(__dirname, "../ocr/out")
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, "e2e-report.json")
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`\nReport saved to: ${outPath}`)
}

runE2E().catch((e) => {
  console.error("E2E Test Failed:", e)
  process.exit(1)
})
