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
// A stalled connection (common on mobile data) makes fetch wait forever, which looks
// like an endless spinner. The AI route may legitimately take ~2 minutes (the server
// gives up at 130s); everything else should answer quickly.
export const REQUEST_TIMEOUT_MS = 30_000
export const AI_REQUEST_TIMEOUT_MS = 150_000

export async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : localStorage.getItem(PHONE_TOKEN_KEY)

  const controller = new AbortController()
  const limit = endpoint.startsWith("/ai/") ? AI_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS
  const timer = setTimeout(() => controller.abort(), limit)
  // Honour a caller's own signal (e.g. a Cancel button) as well as our time limit.
  if (options.signal?.aborted) controller.abort() // cancelled while we were fetching the token
  options.signal?.addEventListener("abort", () => controller.abort(), { once: true })

  try {
    return await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    if ((error as Error)?.name === "AbortError" && !options.signal?.aborted) {
      const timeout = new Error("The request took too long. Please check your connection and try again.")
      timeout.name = "TimeoutError"
      throw timeout
    }
    throw error
  } finally {
    // The body of a streamed AI reply keeps flowing after this returns; only the wait for headers is limited.
    clearTimeout(timer)
  }
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
