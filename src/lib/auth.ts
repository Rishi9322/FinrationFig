import { supabase } from "./supabaseClient"
import { apiCall, apiRequest } from "./apiSession"
import {
  CALCULATOR_FEATURES,
  CALCULATOR_SLUGS,
  type CalculatorFeature as CatalogFeature,
} from "./calculatorFeatures"

export type Role = "SUPER_ADMIN" | "ADMIN" | "USER"
export type AccountStatus = "ACTIVE" | "SUSPENDED"
export type AccessMode = "FULL" | "CUSTOM"

export interface User {
  id: string
  email: string
  name: string
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

// Where email confirmation / magic-link / recovery links land. supabase-js reads
// the tokens out of the URL (detectSessionInUrl) on that route.
function redirectTo(path: string): string {
  if (typeof window === "undefined") return path
  return `${window.location.origin}${path}`
}

type ProfileRow = {
  id: string
  email: string
  name: string
  role: Role
  status: AccountStatus
  calculator_access_mode: AccessMode
  calculator_access: string[]
  business_constitution: string | null
  created_at: string
}

const isPrivileged = (role: Role) => role === "SUPER_ADMIN" || role === "ADMIN"

function toUser(profile: ProfileRow, emailConfirmed: boolean): User {
  const calculatorAccess =
    isPrivileged(profile.role) || profile.calculator_access_mode === "FULL"
      ? CALCULATOR_SLUGS
      : profile.calculator_access ?? []

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    status: profile.status,
    isVerified: emailConfirmed,
    calculatorAccessMode: profile.calculator_access_mode,
    createdAt: profile.created_at,
    calculatorAccess,
    businessConstitution: profile.business_constitution ?? undefined,
  }
}

// Loads the signed-in user's profile row (RLS returns only their own).
async function loadProfileForSession(): Promise<User | null> {
  const { data: sessionData } = await supabase.auth.getSession()
  const session = sessionData.session
  if (!session) return null

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, name, role, status, calculator_access_mode, calculator_access, business_constitution, created_at",
    )
    .eq("id", session.user.id)
    .single()

  if (error || !data) return null
  const user = toUser(data as ProfileRow, Boolean(session.user.email_confirmed_at))
  setCurrentUser(user)
  return user
}

export async function signup(params: {
  name: string
  email: string
  password: string
  confirmPassword: string
}) {
  if (params.password !== params.confirmPassword) {
    throw new Error("Passwords do not match")
  }

  const { error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: { name: params.name },
      emailRedirectTo: redirectTo("/dashboard"),
    },
  })

  if (error) throw new Error(error.message)
  return { email: params.email }
}

// Email OTP entered on the verify page. A code can come from either the signup
// confirmation ("signup") or a passwordless login ("email"); try login first and
// fall back, so one page handles both flows.
export async function verifyOTP(email: string, otp: string) {
  let result = await supabase.auth.verifyOtp({ email, token: otp, type: "email" })
  if (result.error) {
    result = await supabase.auth.verifyOtp({ email, token: otp, type: "signup" })
  }
  if (result.error) throw new Error(result.error.message)

  const user = await loadProfileForSession()
  return { user, session: result.data.session }
}

export async function signin(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    // GoTrue reports an unconfirmed address distinctly so the UI can route to OTP.
    if (/confirm/i.test(error.message)) {
      return { needsVerification: true, user: null }
    }
    throw new Error(error.message)
  }

  const user = await loadProfileForSession()
  if (user?.status === "SUSPENDED") {
    await supabase.auth.signOut()
    throw new Error("Account suspended")
  }
  return { user }
}

// Passwordless: emails a magic link + 6-digit code. Reused for "resend OTP".
export async function signInWithMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo("/dashboard") },
  })
  if (error) throw new Error(error.message)
  return { email }
}

export async function resendOTP(email: string) {
  return signInWithMagicLink(email)
}

// Providers currently enabled on this project (Authentication -> Providers).
// Add more here once enabled in the dashboard, or GoTrue 400s on the callback.
export type OAuthProvider = "discord" | "figma" | "linkedin_oidc" | "google" | "github" | "apple"

export const ENABLED_OAUTH_PROVIDERS: { provider: OAuthProvider; label: string }[] = [
  // Enable each in Supabase dashboard -> Authentication -> Providers first.
  { provider: "google", label: "Google" },
  { provider: "discord", label: "Discord" },
  { provider: "figma", label: "Figma" },
  { provider: "linkedin_oidc", label: "LinkedIn" },
]

// Redirects the browser to the provider, which returns to /dashboard with a
// session in the URL. The provider must be enabled in the Supabase dashboard
// (Authentication -> Providers) with its client id/secret, or GoTrue 400s.
export async function signInWithOAuth(provider: OAuthProvider = "discord") {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: redirectTo("/dashboard") },
  })
  if (error) throw new Error(error.message)
}

export async function submitOnboarding(businessConstitution: string) {
  const { error } = await supabase.rpc("set_business_constitution", {
    p_value: businessConstitution,
  })
  if (error) throw new Error(error.message)

  const user = await loadProfileForSession()
  return { user }
}

export async function forgotPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo("/auth/reset-password"),
  })
  // Do not surface provider errors: keep the response account-enumeration-safe.
  if (error) console.warn("[forgotPassword]", error.message)
  return { message: "If this email is registered, a reset link has been sent." }
}

// The recovery link already established a session (detectSessionInUrl), so the
// reset page only needs the new password — no token handling on the client.
export async function resetPassword(params: {
  password: string
  confirmPassword: string
}) {
  if (params.password !== params.confirmPassword) {
    throw new Error("Passwords do not match")
  }
  const { error } = await supabase.auth.updateUser({ password: params.password })
  if (error) throw new Error(error.message)
  return { message: "Password reset successful" }
}

export async function fetchCurrentUser(): Promise<User | null> {
  return loadProfileForSession()
}

export async function signout() {
  try {
    await supabase.auth.signOut()
  } finally {
    clearCurrentUser()
  }
}

// The catalog is static; expose it in the shape the admin UI expects.
export async function getCalculatorFeatures(): Promise<CalculatorFeature[]> {
  return CALCULATOR_FEATURES.map((f: CatalogFeature) => ({
    id: f.slug,
    slug: f.slug,
    name: f.name,
  }))
}

// ---- Admin operations: go through the service-role edge function. ----
export async function getAdminUsers(): Promise<User[]> {
  const data = await apiCall("/admin/users")
  return data.users || []
}

export async function createAdminUser(params: {
  name: string
  email: string
  password: string
  role: Role
  calculatorAccessMode: AccessMode
  calculatorAccess: string[]
}) {
  return apiCall("/admin/users", { method: "POST", body: JSON.stringify(params) })
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

export function canAccessAdmin(user: User | null | undefined): boolean {
  return user?.role === "SUPER_ADMIN"
}

export function hasAllCalculatorAccess(user: User | null | undefined): boolean {
  return user?.role === "SUPER_ADMIN" || user?.role === "ADMIN"
}

// Cached profile for instant first paint; the source of truth is the session.
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

/** Irreversible. Deletes the auth user and everything cascading from it. */
export async function deleteMyAccount(): Promise<void> {
  await apiCall("/me", { method: "DELETE" })
  await supabase.auth.signOut()
  clearCurrentUser()
}

/** Security audit trail. Super-admin only; the server enforces that. */
export async function fetchAuditEvents(limit = 100) {
  const data = await apiCall(`/admin/audit?limit=${limit}`)
  return Array.isArray(data.events) ? data.events : []
}
