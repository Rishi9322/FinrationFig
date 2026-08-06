import { apiCall, apiRequest } from "./apiSession"

export type Role = "SUPER_ADMIN" | "ADMIN" | "USER"
export type AccountStatus = "ACTIVE" | "SUSPENDED"
export type AccessMode = "FULL" | "CUSTOM"

export interface User {
  id: string
  email: string
  name: string
  phoneNumber: string
  role: Role
  status: AccountStatus
  isVerified: boolean
  calculatorAccessMode?: AccessMode
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

// No session/CSRF token is stored in localStorage any more - both live in cookies.
function clearSessionTokens(): void {
  localStorage.removeItem("finratio_session_token")
  localStorage.removeItem("finratio_csrf_token")
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

  if (data.user) setCurrentUser(data.user)
  return data
}

export async function signin(email: string, password: string) {
  clearSessionTokens()
  const data = await apiCall("/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })

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

export async function createAdminUser(params: {
  name: string
  email: string
  phoneNumber: string
  password: string
  role: Role
  calculatorAccessMode: AccessMode
  calculatorAccess: string[]
}) {
  return apiCall("/admin/users", {
    method: "POST",
    body: JSON.stringify(params),
  })
}

export async function updateUserRole(userId: string, role: Role) {
  return apiCall(`/admin/users/${encodeURIComponent(userId)}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  })
}

export async function updateUserAccessMode(userId: string, accessMode: AccessMode) {
  return apiCall(`/admin/users/${encodeURIComponent(userId)}/access-mode`, {
    method: "PUT",
    body: JSON.stringify({ accessMode }),
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

/**
 * Single source of truth for admin-surface visibility.
 *
 * Nav links, the route guard, and AdminLayout must all use this — when they
 * disagree, a role either sees a link it can't open or has access it can't find.
 */
export function canAccessAdmin(user: User | null | undefined): boolean {
  return user?.role === "SUPER_ADMIN"
}

/** Roles that bypass per-calculator grants and see every calculator. */
export function hasAllCalculatorAccess(user: User | null | undefined): boolean {
  return user?.role === "SUPER_ADMIN" || user?.role === "ADMIN"
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

/** GDPR/CCPA subject access request: downloads everything held about the user. */
export async function exportMyData(): Promise<Blob> {
  const response = await apiRequest("/me/export")
  if (!response.ok) throw new Error("Export failed")
  return new Blob([await response.text()], { type: "application/json" })
}

/** Irreversible. Deletes the account and everything cascading from it. */
export async function deleteMyAccount(): Promise<void> {
  await apiCall("/me", { method: "DELETE" })
  clearSessionTokens()
  clearCurrentUser()
}

/** Security audit trail. Super-admin only; the server enforces that. */
export async function fetchAuditEvents(limit = 100) {
  const data = await apiCall(`/admin/audit?limit=${limit}`)
  return Array.isArray(data.events) ? data.events : []
}
