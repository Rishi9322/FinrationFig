import { FUNCTIONS_BASE } from "./supabaseClient"
import { auth } from "./firebaseClient"

export const API_BASE = FUNCTIONS_BASE

// The edge routes that need the service role (AI proxy, admin, account ops)
// authenticate with the caller's Firebase ID token as a Bearer header. The
// function verifies it against Google's public keys.
export async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
