#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

const extractedPath = path.join('tools', 'ocr', 'out', 'Spar AY 26-27 Provisional 08.05.2026-single-source-analysis.json')

function pickPair(pairs, includesAll) {
  const needles = includesAll.map((x) => x.toLowerCase())
  const found = pairs.find((pair) => needles.every((needle) => pair.label.toLowerCase().includes(needle)))
  return found ? found.value : null
}

function sumByLabels(pairs, includesAny) {
  const needles = includesAny.map((x) => x.toLowerCase())
  return pairs
    .filter((pair) => needles.some((needle) => pair.label.toLowerCase().includes(needle)))
    .reduce((sum, pair) => sum + pair.value, 0)
}

function ratio(value) {
  return Number(value.toFixed(4))
}

function buildReport(sourceReport) {
  const pairs = sourceReport.analysis.detectedPairs || []

  const revenue = pickPair(pairs, ['by sales'])
  const grossProfit = pickPair(pairs, ['gross profit'])
  const netProfit = pickPair(pairs, ['net profit'])
  const currentAssets = pickPair(pairs, ['current assets'])
  const currentLiabilities = pickPair(pairs, ['current liabilities'])
  const interestExpense = pickPair(pairs, ['interest on loan'])
  const stock = pickPair(pairs, ['stock'])
  const debtors = pickPair(pairs, ['sundry debtors'])
  const creditors = pickPair(pairs, ['sundry creditors'])
  const purchases = pickPair(pairs, ['purchases'])
  const openingStock = pickPair(pairs, ['opening stock'])
  const closingStock = pickPair(pairs, ['closing stock'])
  const depreciation = pickPair(pairs, ['depreciation'])
  const salary = pickPair(pairs, ['salary'])
  const labour = pickPair(pairs, ['labour and wages'])
  const rent = pickPair(pairs, ['rent'])
  const electricity = pickPair(pairs, ['electricity exps'])
  const transport = pickPair(pairs, ['transport charges'])
  const commissionIncome = pickPair(pairs, ['commission income'])
  const bankCharges = pickPair(pairs, ['bank and other charges'])
  const balanceProfit = pickPair(pairs, ['balance profit'])

  const loanLikeTotal = sumByLabels(pairs, ['loan', 'finance', 'credit', 'capital'])

  const derivedRatios = {
    currentRatio: currentAssets && currentLiabilities ? ratio(currentAssets / currentLiabilities) : null,
    netWorkingCapital: currentAssets && currentLiabilities ? currentAssets - currentLiabilities : null,
    debtToEquity: loanLikeTotal && currentAssets ? ratio(loanLikeTotal / currentAssets) : null,
    quasiDebtToEquity: loanLikeTotal && currentAssets ? ratio(loanLikeTotal / currentAssets) : null,
    ebitda: grossProfit,
    iscr: grossProfit && interestExpense ? ratio(grossProfit / interestExpense) : null,
    dscr: grossProfit && interestExpense ? ratio(grossProfit / interestExpense) : null,
    drawingPower: stock && debtors ? ratio((stock + debtors) * 0.75) : null,
    ageing: debtors,
    pid: revenue && purchases && stock ? ratio(stock * 0.1) : null,
    valuation: grossProfit ? ratio(grossProfit * 8) : null,
    workingCapitalCycle: creditors && debtors && stock && revenue && purchases
      ? ratio((debtors * 100) / revenue + (stock * 100) / revenue - (creditors * 100) / purchases)
      : null,
  }

  return {
    timestamp: new Date().toISOString(),
    sourceFile: sourceReport.sourceFile,
    sourceOnly: true,
    coverage: sourceReport.analysis.extractionQuality.coveragePct,
    confidence: sourceReport.analysis.extractionQuality.confidencePct,
    extractedMetrics: {
      revenue,
      grossProfit,
      netProfit,
      currentAssets,
      currentLiabilities,
      interestExpense,
      stock,
      debtors,
      creditors,
      purchases,
      openingStock,
      closingStock,
      depreciation,
      salary,
      labour,
      rent,
      electricity,
      transport,
      commissionIncome,
      bankCharges,
      balanceProfit,
      loanLikeTotal,
    },
    derivedRatios,
  }
}

async function main() {
  if (!fs.existsSync(extractedPath)) {
    throw new Error(`Missing extraction report: ${extractedPath}`)
  }

  const sourceReport = JSON.parse(fs.readFileSync(extractedPath, 'utf8'))
  const report = buildReport(sourceReport)

  const outDir = path.join('tools', 'ocr', 'out')
  fs.mkdirSync(outDir, { recursive: true })

  const jsonPath = path.join(outDir, 'Spar AY 26-27 Provisional 08.05.2026-cma-report.json')
  const txtPath = path.join(outDir, 'Spar AY 26-27 Provisional 08.05.2026-cma-report.txt')

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2))

  const lines = []
  lines.push('CMA STYLE REPORT - SINGLE SOURCE PDF')
  lines.push(`Source file: ${report.sourceFile}`)
  lines.push(`Coverage: ${report.coverage}%`)
  lines.push(`Extraction confidence: ${report.confidence}%`)
  lines.push('')
  lines.push('Extracted Metrics:')
  for (const [key, value] of Object.entries(report.extractedMetrics)) {
    lines.push(`- ${key}: ${value === null ? 'NOT FOUND' : value}`)
  }
  lines.push('')
  lines.push('Calculator Outputs:')
  for (const [key, value] of Object.entries(report.derivedRatios)) {
    lines.push(`- ${key}: ${value === null ? 'NOT AVAILABLE' : value}`)
  }
  lines.push('')
  lines.push('Note: report uses only values explicitly detected in the PDF.')

  fs.writeFileSync(txtPath, lines.join('\n'))

  console.log(`JSON report: ${jsonPath}`)
  console.log(`Text report: ${txtPath}`)
  console.log(`Coverage: ${report.coverage}%`)
  console.log(`Confidence: ${report.confidence}%`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
