import { supabase, FUNCTIONS_BASE } from "./supabaseClient"

export const API_BASE = FUNCTIONS_BASE

// The only routes left on the edge function need the service role (AI proxy,
// admin, account export/delete). They authenticate with the Supabase access
// token as a Bearer header — no cookies, so nothing to CSRF-protect.
export async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

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
