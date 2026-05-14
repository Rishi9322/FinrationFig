import { projectId, publicAnonKey } from "../../utils/supabase/info"

export type Role = "SUPER_ADMIN" | "ADMIN" | "USER"
export type AccountStatus = "ACTIVE" | "SUSPENDED"

export interface User {
  id: string
  email: string
  name: string
  phoneNumber: string
  role: Role
  status: AccountStatus
  isVerified: boolean
  createdAt: string
  calculatorAccess: string[]
  businessConstitution?: string
}

export interface CalculatorFeature {
  id: string
  slug: string
  name: string
  description?: string
}

const CURRENT_USER_KEY = "finratio_current_user"
const SESSION_TOKEN_KEY = "finratio_session_token"
const CSRF_TOKEN_KEY = "finratio_csrf_token"
const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-bd792702`

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

function setSessionTokens(session?: { sessionToken?: string; csrfToken?: string }): void {
  if (!session?.sessionToken || !session?.csrfToken) return
  localStorage.setItem(SESSION_TOKEN_KEY, session.sessionToken)
  localStorage.setItem(CSRF_TOKEN_KEY, session.csrfToken)
}

function clearSessionTokens(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY)
  localStorage.removeItem(CSRF_TOKEN_KEY)
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

export async function signup(params: {
  name: string
  email: string
  phoneNumber: string
  password: string
  confirmPassword: string
}) {
  clearSessionTokens()
  return apiCall("/auth/signup", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

export async function verifyOTP(email: string, otp: string) {
  clearSessionTokens()
  const data = await apiCall("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  })

  setSessionTokens(data.session)
  if (data.user) setCurrentUser(data.user)
  return data
}

export async function signin(email: string, password: string) {
  clearSessionTokens()
  const data = await apiCall("/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })

  setSessionTokens(data.session)
  if (data.user) setCurrentUser(data.user)
  return data
}

export async function resendOTP(email: string) {
  clearSessionTokens()
  return apiCall("/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function submitOnboarding(businessConstitution: string) {
  const data = await apiCall("/auth/onboarding", {
    method: "POST",
    body: JSON.stringify({ businessConstitution }),
  })

  if (data.user) setCurrentUser(data.user)
  return data
}

export async function forgotPassword(email: string) {
  clearSessionTokens()
  return apiCall("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(params: {
  email: string
  token: string
  password: string
  confirmPassword: string
}) {
  clearSessionTokens()
  return apiCall("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

export async function fetchCurrentUser() {
  const data = await apiCall("/auth/me")
  if (data.user) {
    setCurrentUser(data.user)
    return data.user as User
  }
  return null
}

export async function signout() {
  try {
    await apiCall("/auth/logout", { method: "POST" })
  } finally {
    clearCurrentUser()
    clearSessionTokens()
  }
}

export async function getCalculatorFeatures(): Promise<CalculatorFeature[]> {
  const data = await apiCall("/features")
  return data.features || []
}

export async function getAdminUsers(): Promise<User[]> {
  const data = await apiCall("/admin/users")
  return data.users || []
}

export async function updateUserRole(userId: string, role: Role) {
  return apiCall(`/admin/users/${encodeURIComponent(userId)}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  })
}

export async function updateUserSuspension(userId: string, suspended: boolean) {
  return apiCall(`/admin/users/${encodeURIComponent(userId)}/suspend`, {
    method: "PUT",
    body: JSON.stringify({ suspended }),
  })
}

export async function updateUserCalculatorAccess(userId: string, slugs: string[]) {
  return apiCall(`/admin/users/${encodeURIComponent(userId)}/calculator-access`, {
    method: "PUT",
    body: JSON.stringify({ slugs }),
  })
}

export function getCurrentUser(): User | null {
  const userJson = localStorage.getItem(CURRENT_USER_KEY)
  if (!userJson) return null

  try {
    return JSON.parse(userJson)
  } catch {
    localStorage.removeItem(CURRENT_USER_KEY)
    return null
  }
}

export function setCurrentUser(user: User): void {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user))
}

export function clearCurrentUser(): void {
  localStorage.removeItem(CURRENT_USER_KEY)
}
