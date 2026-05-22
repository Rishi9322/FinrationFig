import { projectId, publicAnonKey } from "../../utils/supabase/info"

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-bd792702`
const SESSION_TOKEN_KEY = "finratio_session_token"
const CSRF_TOKEN_KEY = "finratio_csrf_token"

function readCookie(name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function getCsrfTokenFromCookie(): string | null {
  return readCookie("__Host-finratio_csrf") || readCookie("finratio_csrf")
}

function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_TOKEN_KEY)
}

function getCsrfToken(): string | null {
  return localStorage.getItem(CSRF_TOKEN_KEY) || getCsrfTokenFromCookie()
}

async function apiCall(endpoint: string, options: RequestInit = {}) {
  const method = (options.method || "GET").toUpperCase()
  const csrfToken = getCsrfToken()
  const sessionToken = getSessionToken()
  const url = new URL(`${API_BASE}${endpoint}`)

  if (sessionToken) {
    url.searchParams.set("sessionToken", sessionToken)
    if (csrfToken && method !== "GET") {
      url.searchParams.set("csrfToken", csrfToken)
    }
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${publicAnonKey}`,
      ...(sessionToken ? { "X-Session-Token": sessionToken } : {}),
      ...(csrfToken && method !== "GET" ? { "X-CSRF-Token": csrfToken } : {}),
      ...options.headers,
    },
  })

  const raw = await response.text()
  let data: any = null

  if (raw) {
    try {
      data = JSON.parse(raw)
    } catch {
      data = { message: raw }
    }
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Request failed")
  }

  return data ?? {}
}

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
