import { supabase } from "./supabaseClient"

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

// Uploads go straight to Postgres under RLS (file_uploads_owner → auth.uid()).
// Size/type are validated client-side here; the column types and RLS are the
// backstop. user_id is filled from the current session.
export async function uploadBalanceSheetFile(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit`)
  }
  const filename = file.name || "balance-sheet"
  if (!ALLOWED_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext))) {
    throw new Error("Unsupported file type")
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user.id
  if (!userId) throw new Error("Not signed in")

  const fileBase64 = await fileToBase64(file)

  const { data, error } = await supabase
    .from("file_uploads")
    .insert({
      user_id: userId,
      filename,
      content_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      file_base64: fileBase64,
    })
    .select("id")
    .single()

  if (error || !data) throw new Error(error?.message || "Upload failed")
  return { id: data.id }
}
