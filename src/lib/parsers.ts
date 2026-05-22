import type ParsedBalanceSheet from "./parsedBalanceSheet"
import type { LineItem, ReceivableItem } from "./parsedBalanceSheet"

function parseCSVText(text: string): LineItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return []

  // detect header
  const headers = lines[0].split(/,|\t/).map((h) => h.trim().toLowerCase())
  const hasHeaderName = headers.some((h) => /name|account|description/.test(h))
  const hasHeaderValue = headers.some((h) => /value|amount|balance|amt/.test(h))

  const rows = hasHeaderName && hasHeaderValue ? lines.slice(1) : lines

  const items: LineItem[] = rows.map((r) => {
    const cols = r.split(/,|\t/).map((c) => c.trim())
    if (hasHeaderName && hasHeaderValue) {
      const idxName = headers.findIndex((h) => /name|account|description/.test(h))
      const idxValue = headers.findIndex((h) => /value|amount|balance|amt/.test(h))
      return { name: cols[idxName] || cols[0] || "", value: Number(cols[idxValue]) || 0 }
    }

    // fallback: last column numeric
    const last = cols[cols.length - 1]
    const value = Number(last.replace(/[^0-9.-]+/g, ""))
    const name = cols.slice(0, -1).join(" ") || cols[0]
    return { name: name || "item", value: isNaN(value) ? 0 : value }
  })

  return items.filter((it) => it && (typeof it.value === "number"))
}

async function parseXLSXBuffer(buffer: ArrayBuffer): Promise<LineItem[]> {
  // dynamic import so app still builds if xlsx not installed; caller should have added dependency
  const XLSX = await import("xlsx")
  const data = new Uint8Array(buffer)
  const wb = XLSX.read(data, { type: "array" })
  const first = wb.SheetNames[0]
  const ws = wb.Sheets[first]
  // try to get rows as arrays
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 })
  if (!rows || rows.length === 0) return []

  const header = rows[0].map((h: any) => String(h).toLowerCase())
  const hasName = header.some((h: string) => /name|account|description/.test(h))
  const hasValue = header.some((h: string) => /value|amount|balance|amt/.test(h))

  const dataRows = hasName && hasValue ? rows.slice(1) : rows

  const items: LineItem[] = dataRows.map((r) => {
    if (!Array.isArray(r)) r = Object.values(r)
    if (hasName && hasValue) {
      const idxName = header.findIndex((h: string) => /name|account|description/.test(h))
      const idxValue = header.findIndex((h: string) => /value|amount|balance|amt/.test(h))
      return { name: String(r[idxName] ?? "").trim(), value: Number(r[idxValue]) || 0 }
    }
    const last = String(r[r.length - 1] ?? "").replace(/[^0-9.-]+/g, "")
    const value = Number(last)
    const name = r.slice(0, -1).join(" ")
    return { name: name || String(r[0] ?? ""), value: isNaN(value) ? 0 : value }
  })

  return items
}

function tryExtractTotals(items: LineItem[]) {
  const assets: LineItem[] = []
  const liabilities: LineItem[] = []
  const equity: LineItem[] = []

  for (const it of items) {
    const n = it.name.toLowerCase()
    if (/asset|cash|bank|receivable|inventory|stock|sundry debtors/.test(n)) assets.push(it)
    else if (/liabilit|payable|creditor|loan|overdraft|debt|tax payable/.test(n)) liabilities.push(it)
    else if (/equity|capital|reserves|share/.test(n)) equity.push(it)
    else {
      // heuristics: amounts > 0.9*max maybe assets
      assets.push(it)
    }
  }

  return { assets, liabilities, equity }
}

export async function parseFile(file: File): Promise<ParsedBalanceSheet> {
  const name = file.name || "upload"
  const lower = name.toLowerCase()
  const parsedAt = new Date().toISOString()

  try {
    if (lower.endsWith(".json")) {
      const text = await file.text()
      const obj = JSON.parse(text)
      // If already in parsed shape, trust it
      if (obj && obj.balanceSheet) {
        return { ...obj, originalFormat: "json", parsedAt }
      }

      // try to turn arrays into line items
      const items: LineItem[] = []
      if (Array.isArray(obj)) {
        for (const row of obj) {
          if (typeof row === "object") {
            const keys = Object.keys(row)
            const nameKey = keys.find((k) => /name|account|description/i.test(k))
            const valueKey = keys.find((k) => /value|amount|balance|amt/i.test(k))
            const nameV = nameKey ? String(row[nameKey]) : JSON.stringify(row)
            const valueV = valueKey ? Number(row[valueKey]) : NaN
            items.push({ name: nameV, value: isNaN(valueV) ? 0 : valueV })
          }
        }
      }

      const sections = tryExtractTotals(items)
      return {
        sourceFilename: name,
        originalFormat: "json",
        parsedAt,
        accounts: items,
        balanceSheet: { assets: sections.assets, liabilities: sections.liabilities, equity: sections.equity },
        metadata: { confidence: 0.6, notes: "Parsed generic JSON" },
      }
    }

    if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) {
      const text = await file.text()
      const items = parseCSVText(text)
      const sections = tryExtractTotals(items)
      return {
        sourceFilename: name,
        originalFormat: "csv",
        parsedAt,
        accounts: items,
        balanceSheet: { assets: sections.assets, liabilities: sections.liabilities, equity: sections.equity },
        metadata: { confidence: 0.6, notes: "Parsed CSV/TSV text" },
      }
    }

    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const buffer = await file.arrayBuffer()
      const items = await parseXLSXBuffer(buffer)
      const sections = tryExtractTotals(items)
      return {
        sourceFilename: name,
        originalFormat: "xlsx",
        parsedAt,
        accounts: items,
        balanceSheet: { assets: sections.assets, liabilities: sections.liabilities, equity: sections.equity },
        metadata: { confidence: 0.7, notes: "Parsed first sheet of Excel workbook" },
      }
    }

    // For PDF, images, and DOCX attempt to extract text (OCR / PDF text / DOCX parser)
    if (lower.endsWith(".pdf") || lower.match(/\.png$|\.jpg$|\.jpeg$/) || lower.endsWith(".docx") || lower.endsWith(".doc")) {
      try {
        let extracted = ""

        if (lower.endsWith(".docx")) {
          // mammoth works well in-browser for docx
          const mammoth = await import("mammoth")
          const buffer = await file.arrayBuffer()
          const res = await mammoth.extractRawText({ arrayBuffer: buffer })
          extracted = String(res.value || "")
        } else if (lower.endsWith(".pdf")) {
          // use pdfjs to extract text from PDF pages
          const pdfjs = await import("pdfjs-dist/legacy/build/pdf")
          const buffer = await file.arrayBuffer()
          const uint8 = new Uint8Array(buffer)
          const loadingTask = pdfjs.getDocument({ data: uint8 })
          const doc = await loadingTask.promise
          const maxPages = doc.numPages
          const textParts: string[] = []
          for (let i = 1; i <= maxPages; i++) {
            try {
              const page = await doc.getPage(i)
              const content = await page.getTextContent()
              const strings = content.items.map((it: any) => (it as any).str || "")
              textParts.push(strings.join(" "))
            } catch (e) {
              // continue on page errors
            }
          }
          extracted = textParts.join(" \n")
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

        // parse extracted text into line items
        const items = extracted ? parseCSVText(extracted) : []
        const sections = tryExtractTotals(items)
        const confidenceNote = extracted ? 0.5 : 0.2
        return {
          sourceFilename: name,
          originalFormat: lower.endsWith(".pdf") ? "pdf" : lower.endsWith(".docx") ? "docx" : "other",
          parsedAt,
          accounts: items,
          balanceSheet: { assets: sections.assets, liabilities: sections.liabilities, equity: sections.equity },
          metadata: { confidence: confidenceNote, notes: "Text extracted via OCR/PDF/DOCX parser; please verify classification" },
        }
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
    const items = parseCSVText(text)
    const sections = tryExtractTotals(items)
    return {
      sourceFilename: name,
      originalFormat: "other",
      parsedAt,
      accounts: items,
      balanceSheet: { assets: sections.assets, liabilities: sections.liabilities, equity: sections.equity },
      metadata: { confidence: 0.5, notes: "Best-effort parsed as delimited text" },
    }
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
