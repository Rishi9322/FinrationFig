import { apiCall } from "./apiSession"

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || "")
      const commaIndex = result.indexOf(",")
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".csv", ".xlsx", ".xls", ".txt"]

// Uploads go through the edge function (Firebase-token verified, service role).
export async function uploadBalanceSheetFile(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit`)
  }
  const filename = file.name || "balance-sheet"
  if (!ALLOWED_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext))) {
    throw new Error("Unsupported file type")
  }

  const fileBase64 = await fileToBase64(file)
  return apiCall("/uploads", {
    method: "POST",
    body: JSON.stringify({ filename, contentType: file.type || "application/octet-stream", fileBase64 }),
  })
}
