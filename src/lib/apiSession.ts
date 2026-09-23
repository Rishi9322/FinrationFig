import { FUNCTIONS_BASE } from "./supabaseClient"
import { auth } from "./firebaseClient"

export const API_BASE = FUNCTIONS_BASE

// WhatsApp OTP sign-in has no Firebase session, so it gets its own token
// (issued by /auth/phone/verify-otp) stored separately from Firebase's SDK state.
const PHONE_TOKEN_KEY = "finratio_phone_token"
export function setPhoneSessionToken(token: string): void { localStorage.setItem(PHONE_TOKEN_KEY, token) }
export function clearPhoneSessionToken(): void { localStorage.removeItem(PHONE_TOKEN_KEY) }

// The edge routes that need the service role (AI proxy, admin, account ops)
// authenticate with a Bearer token: the caller's Firebase ID token, or - for a
// WhatsApp OTP session - the token above. The function verifies either kind.
export async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : localStorage.getItem(PHONE_TOKEN_KEY)

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
