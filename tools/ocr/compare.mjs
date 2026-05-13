#!/usr/bin/env node
// Simple OCR comparison harness
// Usage: set OPENROUTER_API_KEY and OPENROUTER_URL (and optionally OPENROUTER_MODEL)
// Put test images in ./tools/ocr/inputs/ and optional ground-truth .txt files with same basename.

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"
import { Buffer } from "buffer"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const inputsDir = path.join(__dirname, "inputs")
const outDir = path.join(__dirname, "out")
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

dotenv.config({ path: path.join(process.cwd(), ".env") })
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_URL = process.env.OPENROUTER_URL || "https://api.openrouter.ai/v1/chat/completions"
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "baidu/qianfan-ocr-fast:free"

function levenshtein(a, b) {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

async function runTesseract(filePath) {
  const tesseractMod = await import("tesseract.js")
  const Tesseract = (tesseractMod && (tesseractMod.default ?? tesseractMod))
  const worker = await Tesseract.createWorker({ logger: () => {} })
  await worker.load()
  await worker.loadLanguage("eng")
  await worker.initialize("eng")
  const { data } = await worker.recognize(filePath)
  await worker.terminate()
  return data?.text ?? ""
}

async function callOpenRouter(base64) {
  if (!OPENROUTER_API_KEY) return { error: "OPENROUTER_API_KEY not set" }

  const body = {
    model: OPENROUTER_MODEL,
    input: [
      {
        role: "user",
        content: [{ type: "input_image", image: { b64: base64 } }],
      },
    ],
  }

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    // heuristics: try to extract text from common fields
    const possible = []
    function pushIf(v) {
      if (v) possible.push(String(v))
    }
    pushIf(json.output_text)
    pushIf(json.output?.map((o) => o.text).join(" "))
    pushIf(json.choices?.map((c) => c.message?.content || c.text).join(" "))
    pushIf(json.result || json.data || json)
    // flatten strings
    const text = possible.filter(Boolean).join(" \n\n")
    return { raw: json, text }
  } catch (err) {
    return { error: String(err) }
  }
}

async function main() {
  const arg = process.argv[2]
  let targets = []
  if (arg) {
    const p = path.resolve(process.cwd(), arg)
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p)
      if (stat.isDirectory()) targets = fs.readdirSync(p).map((f) => path.join(p, f))
      else targets = [p]
    } else {
      console.error("Path not found:", p)
      process.exit(1)
    }
  } else {
    targets = fs.readdirSync(inputsDir).map((f) => path.join(inputsDir, f))
  }

  // filter common document/image types
  targets = targets.filter((f) => /\.(png|jpe?g|pdf|tif|tiff|xlsx|xls|docx|txt)$/i.test(f))

  const files = targets.map((t) => path.basename(t))
  const report = []
  for (const fullPath of targets) {
    const f = path.basename(fullPath)
    console.log("Processing", f)

    const ext = path.extname(f).toLowerCase()
    let tesseractText = ""
    let openResp = {}
    let orText = ""

    if (/\.(png|jpe?g|tif|tiff)$/i.test(ext)) {
      tesseractText = await runTesseract(fullPath)
      const buffer = fs.readFileSync(fullPath)
      const b64 = buffer.toString("base64")
      openResp = await callOpenRouter(b64)
      orText = openResp.text || ""
    } else if (ext === ".pdf") {
      // for pdf, prefer sending bytes; also try to run tesseract on each page image is heavy -> skip tesseract for pdf
      const buffer = fs.readFileSync(fullPath)
      const b64 = buffer.toString("base64")
      openResp = await callOpenRouter(b64)
      orText = openResp.text || ""
      // attempt simple text extraction via pdfjs if available
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf")
        const uint8 = new Uint8Array(buffer)
        const loadingTask = pdfjs.getDocument({ data: uint8 })
        const doc = await loadingTask.promise
        const textParts = []
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i)
          const content = await page.getTextContent()
          const strings = content.items.map((it) => it.str || "")
          textParts.push(strings.join(" "))
        }
        tesseractText = textParts.join("\n")
      } catch (e) {
        // ignore
      }
    } else if (ext === ".xlsx" || ext === ".xls") {
      const XLSX = await import("xlsx")
      const buffer = fs.readFileSync(fullPath)
      const wb = XLSX.read(buffer, { type: "buffer" })
      const texts = []
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
        for (const r of rows) texts.push((r || []).join(" "))
      }
      const combined = texts.join("\n")
      // Tesseract not used for xlsx; call OpenRouter with text as base64 payload in body
      openResp = await callOpenRouter(Buffer.from(combined).toString("base64"))
      orText = openResp.text || ""
      tesseractText = combined
    } else if (ext === ".docx") {
      const mammoth = await import("mammoth")
      const buffer = fs.readFileSync(fullPath)
      const res = await mammoth.extractRawText({ arrayBuffer: buffer })
      const combined = String(res.value || "")
      openResp = await callOpenRouter(Buffer.from(combined).toString("base64"))
      orText = openResp.text || ""
      tesseractText = combined
    } else if (ext === ".txt") {
      const combined = fs.readFileSync(fullPath, "utf8")
      openResp = await callOpenRouter(Buffer.from(combined).toString("base64"))
      orText = openResp.text || ""
      tesseractText = combined
    }

    const gtPath = path.join(path.dirname(fullPath), path.basename(f, path.extname(f)) + ".txt")
    const groundTruth = fs.existsSync(gtPath) ? fs.readFileSync(gtPath, "utf8") : null

    const tscore = groundTruth ? 1 - levenshtein((tesseractText || "").trim(), groundTruth.trim()) / Math.max(1, groundTruth.length) : null
    const orScore = groundTruth ? 1 - levenshtein((orText || "").trim(), groundTruth.trim()) / Math.max(1, groundTruth.length) : null

    const item = {
      file: f,
      tesseract: { text: tesseractText, score: tscore },
      openrouter: { text: orText, score: orScore, raw: openResp.raw ?? openResp.raw ?? null, error: openResp.error ?? null },
      groundTruth: !!groundTruth,
    }
    report.push(item)
    fs.writeFileSync(path.join(outDir, f + ".json"), JSON.stringify(item, null, 2))
  }
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2))
  console.log("Report written to", outDir)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
