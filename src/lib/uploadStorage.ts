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

export async function uploadBalanceSheetFile(file: File) {
  const base64 = await fileToBase64(file)
  const payload = {
    filename: file.name || "balance-sheet",
    contentType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    fileBase64: base64,
  }

  return apiCall("/uploads", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
