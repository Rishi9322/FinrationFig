#!/usr/bin/env node
// Standalone E2E test (no external dependencies except what's in src/lib)
// This demonstrates the full pipeline: Parse → Map → Calculate

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Mock a parsed balance sheet from an Excel file
const parsedBalanceSheet = {
  sourceFilename: "Stocks_PnL_Report_5718894801_01-04-2025_08-07-2025.xlsx",
  originalFormat: "xlsx",
  parsedAt: new Date().toISOString(),
  accounts: [
    { name: "Cash & Bank", value: 750000 },
    { name: "Receivables", value: 1500000 },
    { name: "Inventory", value: 2500000 },
    { name: "Fixed Assets", value: 4200000 },
    { name: "Trade Payables", value: 1200000 },
    { name: "Bank Loan", value: 2500000 },
    { name: "Short Term Borrowing", value: 1000000 },
    { name: "Shareholder Capital", value: 3000000 },
    { name: "Retained Earnings", value: 1250000 },
  ],
  balanceSheet: {
    assets: [
      { name: "Cash & Bank", amount: 750000 },
      { name: "Receivables", amount: 1500000 },
      { name: "Inventory", amount: 2500000 },
      { name: "Fixed Assets", amount: 4200000 },
    ],
    liabilities: [
      { name: "Trade Payables", amount: 1200000 },
      { name: "Bank Loan", amount: 2500000 },
      { name: "Short Term Borrowing", amount: 1000000 },
    ],
    equity: [
      { name: "Shareholder Capital", amount: 3000000 },
      { name: "Retained Earnings", amount: 1250000 },
    ],
    totals: {
      totalAssets: 8950000,
      totalLiabilities: 4700000,
      totalEquity: 4250000,
    },
  },
  incomeStatement: {
    revenue: 8500000,
    operatingExpenses: 5000000,
    ebit: 3500000,
    interestExpense: 300000,
    netOperatingIncome: 3200000,
    totalDebtService: 800000,
  },
  metadata: { confidence: 0.82, notes: "Sample PnL report parsed from Excel sheets" },
}

// Manual calculation functions (copying from financialCalculations.ts for demo)
function calculateDebtEquity(totalDebt, totalEquity) {
  if (totalDebt < 0 || totalEquity < 0) throw new Error("Values cannot be negative")
  if (totalEquity === 0) throw new Error("Equity cannot be zero")

  const ratio = totalDebt / totalEquity
  let risk = "low"
  let interpretation = "Low leverage — the business is conservatively financed with more equity than debt"

  if (ratio > 1 && ratio <= 2) {
    risk = "moderate"
    interpretation = "Moderate leverage — manageable debt levels relative to equity"
  } else if (ratio > 2) {
    risk = "high"
    interpretation = "High leverage — elevated financial risk due to significant debt relative to equity"
  }

  return {
    value: parseFloat(ratio.toFixed(2)),
    formatted: ratio.toFixed(2),
    interpretation,
    risk,
  }
}

function calculateCurrentRatio(currentAssets, currentLiabilities) {
  if (currentAssets < 0 || currentLiabilities < 0) throw new Error("Values cannot be negative")
  if (currentLiabilities === 0) throw new Error("Current liabilities cannot be zero")

  const ratio = currentAssets / currentLiabilities
  let risk = "low"
  let interpretation = "Strong liquidity position — comfortable short-term cushion"

  if (ratio < 1) {
    risk = "high"
    interpretation = "Below 1 — the business may struggle to meet short-term obligations"
  } else if (ratio <= 1.5) {
    risk = "moderate"
    interpretation = "Adequate liquidity — current obligations are covered"
  }

  return {
    value: parseFloat(ratio.toFixed(2)),
    formatted: ratio.toFixed(2),
    interpretation,
    risk,
  }
}

function calculateEBITDA(profit, depreciation, financeCost, sales) {
  if (depreciation < 0 || financeCost < 0 || sales < 0) throw new Error("Values cannot be negative")
  const ebitda = profit + depreciation + financeCost
  const margin = sales > 0 ? ((ebitda * 100) / sales) : 0
  let risk = "low"
  let interpretation = "Healthy operating margin — strong profitability"

  if (ebitda < 0) {
    risk = "high"
    interpretation = "Negative EBITDA — the business is operating at a loss"
  } else if (margin <= 20) {
    risk = "moderate"
    interpretation = "Thin operating margin — limited profitability buffer"
  }

  return {
    value: ebitda,
    formatted: "₹" + ebitda.toLocaleString("en-IN"),
    interpretation,
    risk,
    details: `EBITDA Margin: ${margin.toFixed(1)}%`,
  }
}

function calculateNetWorkingCapital(currentAssets, currentLiabilities) {
  const nwc = currentAssets - currentLiabilities
  let risk = "low"
  let interpretation = "Strong working capital cushion — well-positioned for operations"

  if (nwc < 0) {
    risk = "high"
    interpretation = "Negative NWC — short-term insolvency risk, liabilities exceed assets"
  } else if (nwc <= 500000) {
    risk = "moderate"
    interpretation = "Minimal working capital buffer — limited financial flexibility"
  }

  return {
    value: nwc,
    formatted: "₹" + nwc.toLocaleString("en-IN"),
    interpretation,
    risk,
  }
}

function calculateDSCR(netOperatingIncome, totalDebtService) {
  if (totalDebtService === 0) throw new Error("Total debt service cannot be zero")

  const ratio = netOperatingIncome / totalDebtService
  let risk = "low"
  let interpretation = "Healthy debt service capacity — strong cash flow relative to obligations"

  if (ratio < 1) {
    risk = "high"
    interpretation = "Insufficient cash flow to cover debt obligations — high default risk"
  } else if (ratio <= 1.5) {
    risk = "moderate"
    interpretation = "Marginally adequate coverage — limited buffer for cash flow fluctuations"
  }

  return {
    value: parseFloat(ratio.toFixed(2)),
    formatted: ratio.toFixed(2),
    interpretation,
    risk,
  }
}

// Mapping logic (simplified from parsedToCalculatorMapper.ts)
function mapInputs(calcType, parsed) {
  const totalAssets = parsed.balanceSheet.totals?.totalAssets || 0
  const totalLiab = parsed.balanceSheet.totals?.totalLiabilities || 0
  const totalEq = parsed.balanceSheet.totals?.totalEquity || 0
  const income = parsed.incomeStatement || {}

  // Extract current assets/liabilities (rough heuristic)
  const currentAssets = (parsed.balanceSheet.assets || [])
    .filter((a) => /cash|bank|receivable|inventory/i.test(a.name || ""))
    .reduce((s, a) => s + a.amount, 0)

  const currentLiabilities = (parsed.balanceSheet.liabilities || [])
    .filter((l) => /payable|overdraft|short.*term/i.test(l.name || ""))
    .reduce((s, l) => s + l.amount, 0)

  const inputs = {
    "debt-equity": { totalDebt: totalLiab, totalEquity: totalEq },
    "current-ratio": { currentAssets, currentLiabilities },
    "ebitda": { revenue: income.revenue || 0, operatingExpenses: income.operatingExpenses || 0 },
    "net-working-capital": { currentAssets, currentLiabilities },
    "dscr": { netOperatingIncome: income.netOperatingIncome || 0, totalDebtService: income.totalDebtService || 0 },
  }

  return inputs[calcType] || {}
}

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════════╗")
  console.log("║        END-TO-END BALANCE SHEET ANALYSIS PIPELINE          ║")
  console.log("╚════════════════════════════════════════════════════════════╝\n")

  // Step 1: Display parsed data
  console.log("📄 STEP 1: PARSE & EXTRACT")
  console.log("─".repeat(60))
  console.log(`File: ${parsedBalanceSheet.sourceFilename}`)
  console.log(`Format: ${parsedBalanceSheet.originalFormat}`)
  console.log(`Confidence: ${(parsedBalanceSheet.metadata.confidence * 100).toFixed(0)}%`)
  console.log(`Notes: ${parsedBalanceSheet.metadata.notes}`)
  console.log()

  // Display summary of parsed balance sheet
  console.log("Balance Sheet Summary:")
  const totalAssets = parsedBalanceSheet.balanceSheet.totals?.totalAssets || 0
  const totalLiab = parsedBalanceSheet.balanceSheet.totals?.totalLiabilities || 0
  const totalEq = parsedBalanceSheet.balanceSheet.totals?.totalEquity || 0
  console.log(`  Total Assets:      ₹${totalAssets.toLocaleString("en-IN")}`)
  console.log(`  Total Liabilities: ₹${totalLiab.toLocaleString("en-IN")}`)
  console.log(`  Total Equity:      ₹${totalEq.toLocaleString("en-IN")}`)
  console.log()

  // Step 2: Map & Calculate
  console.log("🔧 STEP 2: MAP & CALCULATE")
  console.log("─".repeat(60))

  const calculators = ["debt-equity", "current-ratio", "ebitda", "net-working-capital", "dscr"]
  const results = []

  for (const calcType of calculators) {
    const inputs = mapInputs(calcType, parsedBalanceSheet)
    let result = {}

    try {
      switch (calcType) {
        case "debt-equity":
          result = calculateDebtEquity(inputs.totalDebt, inputs.totalEquity)
          break
        case "current-ratio":
          result = calculateCurrentRatio(inputs.currentAssets, inputs.currentLiabilities)
          break
        case "ebitda":
          result = calculateEBITDA(inputs.profit, inputs.depreciation, inputs.financeCost, inputs.sales)
          break
        case "net-working-capital":
          result = calculateNetWorkingCapital(inputs.currentAssets, inputs.currentLiabilities)
          break
        case "dscr":
          result = calculateDSCR(inputs.netOperatingIncome, inputs.totalDebtService)
          break
      }
    } catch (err) {
      result = { error: err.message }
    }

    console.log(`\n${calcType.toUpperCase()}`)
    console.log(`  Inputs: ${JSON.stringify(inputs, null, 0)}`)
    if (result.error) {
      console.log(`  ❌ Error: ${result.error}`)
    } else {
      console.log(`  ✅ Result: ${result.formatted}`)
      console.log(`  Risk Level: ${result.risk}`)
      console.log(`  ${result.interpretation}`)
      if (result.details) console.log(`  Details: ${result.details}`)
    }

    results.push({ calcType, inputs, result })
  }

  // Step 3: Summary
  console.log("\n" + "═".repeat(60))
  console.log("📊 SUMMARY")
  console.log("═".repeat(60))
  console.log(`✅ Parsed: ${parsedBalanceSheet.sourceFilename}`)
  console.log(`✅ Calculators run: ${results.length}`)
  console.log(`✅ High Risk: ${results.filter((r) => r.result.risk === "high").length}`)
  console.log(`✅ Moderate Risk: ${results.filter((r) => r.result.risk === "moderate").length}`)
  console.log(`✅ Low Risk: ${results.filter((r) => r.result.risk === "low").length}`)

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    source: parsedBalanceSheet.sourceFilename,
    confidence: parsedBalanceSheet.metadata.confidence,
    balanceSheet: parsedBalanceSheet.balanceSheet.totals,
    results: results.map((r) => ({
      calculator: r.calcType,
      value: r.result.value,
      formatted: r.result.formatted,
      risk: r.result.risk,
      interpretation: r.result.interpretation,
    })),
  }

  const outDir = path.join(__dirname, "../../tools/ocr/out")
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, "e2e-pipeline-result.json")
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))

  console.log(`\n📁 Full report saved to: ${outPath}`)
  console.log("✨ Pipeline complete!\n")
}

main().catch((e) => {
  console.error("❌ Pipeline failed:", e)
  process.exit(1)
})
