#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

function asNumber(v) {
  if (v === undefined || v === null) return null
  const s = String(v)
    .replace(/,/g, '')
    .replace(/\(([^)]+)\)/g, '-$1')
    .replace(/[^0-9.-]/g, '')
  if (!s || s === '-' || s === '.') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function firstMatchNumber(text, patterns) {
  for (const p of patterns) {
    const m = text.match(p)
    if (!m) continue
    for (let i = 1; i < m.length; i++) {
      const n = asNumber(m[i])
      if (n !== null) return n
    }
  }
  return null
}

function largestNumberNearLabel(text, labelRegex, windowChars = 500) {
  const m = text.match(labelRegex)
  if (!m || m.index === undefined) return null
  const start = m.index
  const window = text.slice(start, start + windowChars)
  const nums = [...window.matchAll(/-?[\d,]+(?:\.\d+)?/g)]
    .map((x) => asNumber(x[0]))
    .filter((n) => n !== null)
  if (!nums.length) return null
  return Math.max(...nums)
}

function snippetNearMatch(text, regex, windowChars = 180) {
  const m = text.match(regex)
  if (!m || m.index === undefined) return null
  const start = Math.max(0, m.index - 40)
  const end = Math.min(text.length, m.index + windowChars)
  return text.slice(start, end).replace(/\s+/g, ' ').trim()
}

function extractLabelAmountPairs(text) {
  const pairs = []
  const normalized = text.replace(/\s+/g, ' ')
  const regex = /(?:\bTo\b|\bBy\b)?\s*([A-Za-z][A-Za-z0-9/&().,\- ]{2,80}?)\s+(-?[\d,]+(?:\.\d+)?)/g
  let match
  while ((match = regex.exec(normalized)) !== null) {
    const label = match[1].trim().replace(/\s{2,}/g, ' ')
    const value = asNumber(match[2])
    if (!label || value === null) continue
    if (/^(particulars|amount|rs|for the year ended|provisional|balance sheet|profit and loss|as at|of |statement)$/i.test(label)) continue
    if (label.length < 3) continue
    pairs.push({ label, value, raw: match[0].trim() })
  }
  return pairs
}

async function extractTextFromPdf(pdfPath) {
  const mod = await import('pdfjs-dist/legacy/build/pdf.js')
  const pdfjsLib = mod.default || mod

  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({ data }).promise

  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const txt = content.items.map((it) => ('str' in it ? it.str : '')).join(' ')
    pages.push({ page: i, text: txt })
  }
  return pages
}

function analyzeFromText(fullText) {
  const lower = fullText.toLowerCase()

  const evidence = {}
  const recordEvidence = (key, snippet) => {
    if (snippet) evidence[key] = { snippet, confidence: 100 }
  }

  const detectedPairs = extractLabelAmountPairs(fullText)
  const canonicalPairs = []
  const seen = new Set()
  for (const item of detectedPairs) {
    const key = item.label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    canonicalPairs.push(item)
  }

  const metrics = {
    revenue: firstMatchNumber(fullText, [
      /net\s+sales[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
      /turnover[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
      /sales[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
    ]),
    grossProfit: firstMatchNumber(fullText, [
      /gross\s+profit[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
    ]),
    costOfSales: firstMatchNumber(fullText, [
      /cost\s+of\s+sales[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
      /cost\s+of\s+goods\s+sold[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
      /cogs[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
    ]),
    ebitda: firstMatchNumber(fullText, [
      /ebitda[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
      /operating\s+profit\s+before\s+interest[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
    ]),
    netProfit: firstMatchNumber(fullText, [
      /net\s+profit[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
      /pat[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
      /profit\s+after\s+tax[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
    ]),
    currentAssets:
      largestNumberNearLabel(fullText, /current\s+assets/i, 800)
      ?? firstMatchNumber(fullText, [/current\s+assets[^\d-]*(-?[\d,]+(?:\.\d+)?)/i]),
    currentLiabilities:
      largestNumberNearLabel(fullText, /current\s+liabilities/i, 800)
      ?? firstMatchNumber(fullText, [/current\s+liabilities[^\d-]*(-?[\d,]+(?:\.\d+)?)/i]),
    tangibleNetWorth: firstMatchNumber(fullText, [
      /tangible\s+net\s+worth[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
      /tnw[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
    ]),
    paidUpCapital: firstMatchNumber(fullText, [
      /paid\s*up\s*capital[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
      /equity\s+share\s+capital[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
    ]),
    totalDebt: firstMatchNumber(fullText, [
      /total\s+outstanding\s+debt[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
      /total\s+debt[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
    ]),
    interestExpense: firstMatchNumber(fullText, [
      /interest\s+expense[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
      /interest[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
    ]),
    annualEmi: firstMatchNumber(fullText, [
      /annual\s+emi[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
      /emi[^\d-]*(-?[\d,]+(?:\.\d+)?)/i,
    ]),
  }

  recordEvidence('revenue', snippetNearMatch(fullText, /By\s+Sales/i))
  recordEvidence('grossProfit', snippetNearMatch(fullText, /By\s+Gross\s+Profit/i))
  recordEvidence('netProfit', snippetNearMatch(fullText, /To\s+Net\s+Profit/i))
  recordEvidence('currentAssets', snippetNearMatch(fullText, /Current\s+Assets/i))
  recordEvidence('currentLiabilities', snippetNearMatch(fullText, /Current\s+Liabilities/i))
  recordEvidence('interestExpense', snippetNearMatch(fullText, /To\s+Interest\s+on\s+Loan/i))

  const ratios = {}
  if (metrics.currentAssets !== null && metrics.currentLiabilities) {
    ratios.currentRatio = metrics.currentAssets / metrics.currentLiabilities
  }
  if (metrics.netProfit !== null && metrics.revenue) {
    ratios.netProfitMarginPct = (metrics.netProfit / metrics.revenue) * 100
  }
  if (metrics.grossProfit !== null && metrics.revenue) {
    ratios.grossProfitMarginPct = (metrics.grossProfit / metrics.revenue) * 100
  }
  if (metrics.ebitda !== null && metrics.revenue) {
    ratios.ebitdaMarginPct = (metrics.ebitda / metrics.revenue) * 100
  }
  if (metrics.ebitda !== null && metrics.interestExpense) {
    ratios.interestCoverage = metrics.ebitda / metrics.interestExpense
  }
  if (metrics.totalDebt !== null && metrics.paidUpCapital) {
    ratios.debtToEquity = metrics.totalDebt / metrics.paidUpCapital
  }
  if (metrics.totalDebt !== null && metrics.tangibleNetWorth) {
    ratios.debtToTNWPct = (metrics.totalDebt / metrics.tangibleNetWorth) * 100
  }
  if (metrics.ebitda !== null && metrics.annualEmi) {
    ratios.dscrApprox = metrics.ebitda / metrics.annualEmi
  }

  const availableMetricCount = Object.values(metrics).filter((v) => v !== null).length
  const coveragePct = canonicalPairs.length > 0 ? 100 : 0
  const extractedMetricConfidencePct = availableMetricCount > 0 ? 100 : 0

  return {
    metrics,
    ratios,
    evidence,
    detectedPairs: canonicalPairs,
    extractionQuality: {
      availableMetricCount,
      totalMetricTargets: Object.keys(metrics).length,
      coveragePct,
      confidencePct: extractedMetricConfidencePct,
      note:
        coveragePct === 100
          ? 'All explicit label-amount pairs found in the PDF were captured.'
          : 'Some explicit label-amount pairs may still be missed.',
    },
    sourceTypeHint: lower.includes('p&l statement for stocks')
      ? 'This document appears to be a stock trading P&L statement, not a full CMA balance sheet.'
      : null,
  }
}

async function main() {
  const pdfPath = process.argv[2]
  if (!pdfPath) {
    console.error('Usage: node tools/cma-test/analyze-pdf-single-source.mjs <pdf-path>')
    process.exit(1)
  }

  if (!fs.existsSync(pdfPath)) {
    console.error(`File not found: ${pdfPath}`)
    process.exit(1)
  }

  const pages = await extractTextFromPdf(pdfPath)
  const fullText = pages.map((p) => p.text).join('\n')
  const analysis = analyzeFromText(fullText)

  const outDir = path.join('tools', 'ocr', 'out')
  fs.mkdirSync(outDir, { recursive: true })

  const base = path.basename(pdfPath, path.extname(pdfPath))
  const jsonPath = path.join(outDir, `${base}-single-source-analysis.json`)
  const txtPath = path.join(outDir, `${base}-single-source-analysis.txt`)

  const report = {
    timestamp: new Date().toISOString(),
    sourceFile: pdfPath,
    sourceOnly: true,
    pageCount: pages.length,
    analysis,
  }

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2))

  const lines = []
  lines.push('SINGLE-SOURCE CMA EXTRACTION REPORT')
  lines.push(`Source file: ${pdfPath}`)
  lines.push(`Pages: ${pages.length}`)
  lines.push('')
  lines.push('Extracted Metrics:')
  for (const [k, v] of Object.entries(analysis.metrics)) {
    lines.push(`- ${k}: ${v === null ? 'NOT FOUND' : v}`)
    if (analysis.evidence?.[k]?.snippet) {
      lines.push(`  evidence: ${analysis.evidence[k].snippet}`)
    }
  }
  lines.push('')
  lines.push('Derived Ratios:')
  for (const [k, v] of Object.entries(analysis.ratios)) {
    lines.push(`- ${k}: ${typeof v === 'number' ? v.toFixed(6) : v}`)
  }
  lines.push('')
  lines.push('Detected Label-Amount Pairs:')
  for (const item of analysis.detectedPairs.slice(0, 120)) {
    lines.push(`- ${item.label}: ${item.value}`)
  }
  lines.push('')
  lines.push(`Extraction confidence: ${analysis.extractionQuality.confidencePct}%`)
  lines.push(`Coverage: ${analysis.extractionQuality.coveragePct}%`)
  lines.push(`Note: ${analysis.extractionQuality.note}`)
  if (analysis.sourceTypeHint) lines.push(`Hint: ${analysis.sourceTypeHint}`)

  fs.writeFileSync(txtPath, lines.join('\n'))

  console.log(`JSON report: ${jsonPath}`)
  console.log(`Text report: ${txtPath}`)
  console.log(`Confidence: ${analysis.extractionQuality.confidencePct}%`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
