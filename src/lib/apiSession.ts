import { projectId, publicAnonKey } from "../../utils/supabase/info"

export const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-bd792702`

// The session lives in an HttpOnly, Secure, SameSite=None cookie set by the edge
// function - it is never readable from JS and never travels in a URL. The CSRF
// cookie is readable on purpose: we echo it back in a header (double submit).
function readCookie(name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function getCsrfToken(): string | null {
  return readCookie("__Host-finratio_csrf") || readCookie("finratio_csrf")
}

export function apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || "GET").toUpperCase()
  const csrfToken = getCsrfToken()

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${publicAnonKey}`,
      ...(csrfToken && method !== "GET" ? { "X-CSRF-Token": csrfToken } : {}),
      ...options.headers,
    },
  })
}

export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const response = await apiRequest(endpoint, options)
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
