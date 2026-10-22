import type ParsedBalanceSheet from "./parsedBalanceSheet"
import type { LineItem, ReceivableItem, SourceFormat } from "./parsedBalanceSheet"
import { parseAmount, parseStatementLines, pdfItemsToRows, buildSections, buildIncomeStatement, statementRegion, statementBases, statementUnit, principalRepayments, type Basis, scoreExtraction, splitCsvLine, itemsFromRows } from "./statementParsing"
import { docxToText } from "./docxText"
import { looksParsed, sanitizeParsed } from "./sanitizeParsed"

const MAX_PDF_PAGES = 300

function parseCSVText(text: string): LineItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return []
  return itemsFromRowsWithHeader(lines.map(splitCsvLine))
}

/** An explicit "Name, Amount" header picks those columns; otherwise statement rules apply. */
function itemsFromRowsWithHeader(rows: string[][]): LineItem[] {
  const headers = rows[0].map((h) => h.toLowerCase())
  const idxName = headers.findIndex((h) => /name|account|description|particulars|head|item/.test(h))
  const idxValue = headers.findIndex((h) => /value|amount|balance|amt/.test(h))
  if (idxName === -1 || idxValue === -1 || idxName === idxValue) return itemsFromRows(rows)

  // An explicit Name/Amount layout: still honour section rows ("Current Assets" with no amount).
  return itemsFromRows(rows.slice(1).map((cols) => [cols[idxName] || cols[0] || "", cols[idxValue] ?? ""]))
}

async function parseXLSXBuffer(buffer: ArrayBuffer): Promise<{ items: LineItem[]; sheetNames: string[] }> {
  // dynamic import so app still builds if xlsx not installed; caller should have added dependency
  const XLSX = await import("xlsx")
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
  if (!rows || rows.length === 0) return { items: [], sheetNames: wb.SheetNames }
  const items = itemsFromRowsWithHeader(rows.map((r) => (Array.isArray(r) ? r : Object.values(r)).map((c) => String(c ?? "").trim())))
  return { items, sheetNames: wb.SheetNames }
}

/** Sections + totals + a confidence built from checks (see statementParsing.scoreExtraction). */
function fromItems(
  base: { name: string; format: SourceFormat; parsedAt: string },
  items: LineItem[],
  note: string,
  structured: boolean,
): ParsedBalanceSheet {
  const sections = buildSections(items)
  const score = scoreExtraction(items, sections, { structured })
  return {
    sourceFilename: base.name,
    originalFormat: base.format,
    parsedAt: base.parsedAt,
    accounts: items,
    balanceSheet: {
      assets: sections.assets,
      liabilities: sections.liabilities,
      equity: sections.equity,
      totals: sections.totals,
    },
    incomeStatement: buildIncomeStatement(sections.income),
    metadata: { confidence: score.confidence, notes: [note, ...score.notes].join(" ") },
  }
}

export async function parseFile(file: File, options: { basis?: Basis } = {}): Promise<ParsedBalanceSheet> {
  const name = file.name || "upload"
  const lower = name.toLowerCase()
  const parsedAt = new Date().toISOString()

  // Nothing to read. Also keeps the PDF / Word readers away from a zero-byte buffer, which they can stall on.
  if (file.size === 0) {
    return {
      sourceFilename: name, originalFormat: "other", parsedAt, accounts: [],
      balanceSheet: { assets: [], liabilities: [], equity: [] },
      metadata: { confidence: 0, notes: "This file is empty." },
    }
  }

  try {
    if (lower.endsWith(".json")) {
      const text = await file.text()
      const obj = JSON.parse(text)
      // Already in parsed shape: rebuild it from scratch - a JSON upload is user input like any other.
      if (looksParsed(obj)) return sanitizeParsed(obj, { name, parsedAt })

      // try to turn arrays into line items
      const items: LineItem[] = []
      if (Array.isArray(obj)) {
        for (const row of obj) {
          if (typeof row === "object" && row !== null && !Array.isArray(row)) {
            const keys = Object.keys(row)
            const nameKey = keys.find((k) => /name|account|description/i.test(k))
            const valueKey = keys.find((k) => /value|amount|balance|amt/i.test(k))
            const nameV = (nameKey ? String(row[nameKey]) : JSON.stringify(row)).slice(0, 300)
            const valueV = valueKey ? Number(row[valueKey]) : NaN
            items.push({ name: nameV, value: isNaN(valueV) ? 0 : valueV })
          }
        }
      }

      return fromItems({ name, format: "json", parsedAt }, items, "Parsed generic JSON.", true)
    }

    if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) {
      const text = await file.text()
      // A .txt statement is usually "label  amount" lines rather than delimited
      // columns (and the CSV reader would split "1,000" at its comma), so try that first.
      let items = lower.endsWith(".txt") ? parseStatementLines(text) : []
      if (items.filter((i) => i.value !== 0).length < 3) items = parseCSVText(text)
      return fromItems({ name, format: "csv", parsedAt }, items, "Parsed CSV/TSV text.", !lower.endsWith(".txt"))
    }

    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const buffer = await file.arrayBuffer()
      const { items, sheetNames } = await parseXLSXBuffer(buffer)
      const note = sheetNames.length > 1
        ? `Only the first sheet ("${sheetNames[0]}") was read; this workbook has ${sheetNames.length} sheets (${sheetNames.join(", ")}). Move the statement to the first sheet if it is elsewhere.`
        : "Parsed the workbook's sheet."
      return fromItems({ name, format: "xlsx", parsedAt }, items, note, true)
    }

    // For PDF, images, and DOCX attempt to extract text (OCR / PDF text / DOCX parser)
    if (lower.endsWith(".pdf") || lower.match(/\.png$|\.jpg$|\.jpeg$/) || lower.endsWith(".docx") || lower.endsWith(".doc")) {
      try {
        let extracted = ""
        let pageCapNote = ""

        if (lower.endsWith(".docx")) {
          // Table rows stay together as "label | amount" lines (raw text split every cell onto its own line).
          extracted = await docxToText(await file.arrayBuffer())
        } else if (lower.endsWith(".pdf")) {
          // use pdfjs to extract text from PDF pages
          await import("./pdfWorker")
          const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
          const buffer = await file.arrayBuffer()
          const uint8 = new Uint8Array(buffer)
          const loadingTask = pdfjs.getDocument({ data: uint8 })
          const doc = await loadingTask.promise
          // A statement pack is dozens of pages, not thousands: stop there rather than lock the tab for minutes.
          const maxPages = Math.min(doc.numPages, MAX_PDF_PAGES)
          if (doc.numPages > MAX_PDF_PAGES) pageCapNote = ` Only the first ${MAX_PDF_PAGES} of ${doc.numPages} pages were read.`
          const textParts: string[] = []
          for (let i = 1; i <= maxPages; i++) {
            try {
              const page = await doc.getPage(i)
              const content = await page.getTextContent()
              textParts.push(pdfItemsToRows(content.items as any[]).join("\n"))
            } catch (e) {
              // continue on page errors
            }
          }
          extracted = textParts.join("\n")
        } else if (lower.match(/\.png$|\.jpg$|\.jpeg$/)) {
          // use tesseract.js for OCR on images
          const tesseractMod = await import("tesseract.js")
          const Tesseract = (tesseractMod && (tesseractMod.default ?? tesseractMod))
          try {
            const worker = await Tesseract.createWorker({ logger: () => {} })
            await worker.load()
            await worker.loadLanguage("eng")
            await worker.initialize("eng")
            const { data } = await worker.recognize(file)
            extracted = data?.text ?? ""
            await worker.terminate()
          } catch (e) {
            // fallback to simple recognize if createWorker not available
            try {
              const resp = await Tesseract.recognize(file, "eng")
              extracted = resp?.data?.text ?? ""
            } catch (err) {
              extracted = ""
            }
          }
        } else if (lower.endsWith(".doc")) {
          // legacy .doc not supported in-browser reliably
          return {
            sourceFilename: name,
            originalFormat: "other",
            parsedAt,
            accounts: [],
            balanceSheet: { assets: [], liabilities: [], equity: [] },
            metadata: { confidence: 0.0, notes: "Legacy .doc files are not supported in-browser; please convert to .docx or PDF" },
          }
        }

        // parse extracted text into label/amount line items
        const bases = statementBases(extracted)
        const region = statementRegion(extracted, options.basis)
        const items = extracted ? parseStatementLines(region) : []
        const unit = statementUnit(extracted)
        const format = (lower.endsWith(".pdf") ? "pdf" : lower.endsWith(".docx") ? "docx" : "other") as SourceFormat
        const note = extracted.trim()
          ? `Text read from the document${region.length < extracted.length ? " (statements only - notes and cash flow skipped)" : ""}; please verify the classification.${unit ? ` Amounts are in ${unit}.` : ""}`
          : "No text could be read - this looks like a scanned document."
        const result = fromItems({ name, format, parsedAt }, items, note + pageCapNote, false)
        if (unit) result.metadata = { ...result.metadata, unit }
        // A report with both consolidated and standalone statements: say which was read, so the user can switch.
        if (bases.length > 1) result.metadata = { ...result.metadata, bases, basis: options.basis && bases.includes(options.basis) ? options.basis : bases[0] }
        const repaid = principalRepayments(extracted)
        if (repaid !== undefined) result.incomeStatement = { ...(result.incomeStatement ?? {}), principalRepayment: repaid }
        return result
      } catch (err: any) {
        return {
          sourceFilename: name,
          originalFormat: "other",
          parsedAt,
          accounts: [],
          balanceSheet: { assets: [], liabilities: [], equity: [] },
          metadata: { confidence: 0, notes: `Text extraction error: ${err?.message || String(err)}` },
        }
      }
    }

    // unknown -> try text
    const text = await file.text()
    let items = parseStatementLines(text)
    if (items.filter((i) => i.value !== 0).length < 3) items = parseCSVText(text)
    return fromItems({ name, format: "other", parsedAt }, items, "Best-effort parse as delimited text.", false)
  } catch (err: any) {
    return {
      sourceFilename: name,
      originalFormat: "other",
      parsedAt,
      accounts: [],
      balanceSheet: { assets: [], liabilities: [], equity: [] },
      metadata: { confidence: 0, notes: `Parse error: ${err?.message || String(err)}` },
    }
  }
}

export default parseFile
