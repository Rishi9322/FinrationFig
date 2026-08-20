import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth"
import { auth, googleProvider } from "./firebaseClient"
import { apiCall, apiRequest } from "./apiSession"
import { RESTRICTED_FEATURES, type CalculatorFeature as CatalogFeature } from "./calculatorFeatures"

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

// Firebase resolves the initial auth state asynchronously. Cache the first
// resolution so route guards don't race the SDK on a hard refresh.
let firstAuthState: Promise<FirebaseUser | null> | null = null
function currentFirebaseUser(): Promise<FirebaseUser | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser)
  if (!firstAuthState) {
    firstAuthState = new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (u) => {
        unsub()
        resolve(u)
      })
    })
  }
  return firstAuthState
}

// The edge function verifies the Firebase token, auto-creates a default USER
// profile on first call, and returns it. isVerified reflects Firebase's own
// email-verification state.
async function loadProfile(user: FirebaseUser): Promise<User | null> {
  const data = await apiCall("/me")
  if (!data.user) return null
  const built: User = { ...(data.user as User), isVerified: user.emailVerified }
  setCurrentUser(built)
  return built
}

export async function signup(params: {
  name: string
  email: string
  password: string
  confirmPassword: string
}) {
  if (params.password !== params.confirmPassword) throw new Error("Passwords do not match")
  const cred = await createUserWithEmailAndPassword(auth, params.email, params.password)
  await updateProfile(cred.user, { displayName: params.name })
  await loadProfile(cred.user) // first /me call auto-creates the profile
  try {
    await sendEmailVerification(cred.user)
  } catch {
    // Verification email is best-effort; sign-in still works.
  }
  return { email: params.email }
}

export async function signin(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  const user = await loadProfile(cred.user)
  if (user?.status === "SUSPENDED") {
    await firebaseSignOut(auth)
    throw new Error("Account suspended")
  }
  return { user, needsVerification: !cred.user.emailVerified }
}

export async function signInWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider)
  const user = await loadProfile(cred.user)
  if (user?.status === "SUSPENDED") {
    await firebaseSignOut(auth)
    throw new Error("Account suspended")
  }
  return { user }
}

// Firebase verifies email via a link, not a 6-digit code. Resend that link.
export async function resendOTP(_email: string) {
  const user = auth.currentUser
  if (user) await sendEmailVerification(user)
  return { message: "Verification email sent" }
}

// Kept for API compatibility; there is no code entry with Firebase email links.
export async function verifyOTP(_email: string, _otp: string) {
  const user = auth.currentUser
  if (user) await user.reload()
  const loaded = user ? await loadProfile(user) : null
  return { user: loaded }
}

export type OAuthProvider = "google"
export const ENABLED_OAUTH_PROVIDERS: { provider: OAuthProvider; label: string }[] = [
  { provider: "google", label: "Google" },
]
export async function signInWithOAuth(_provider: OAuthProvider = "google") {
  await signInWithGoogle()
}

// Firebase has no built-in passwordless-code UI here; keep the export a no-op
// so callers don't break. Use Google or email/password instead.
export async function signInWithMagicLink(_email: string) {
  throw new Error("Use Google or email sign-in")
}

export async function submitOnboarding(businessConstitution: string) {
  await apiCall("/onboarding", { method: "POST", body: JSON.stringify({ businessConstitution }) })
  const user = auth.currentUser
  return { user: user ? await loadProfile(user) : null }
}

// Updates the profile row (name, business type). Firebase's own displayName is
// kept in sync too so it doesn't silently drift from what's shown here.
export async function updateOwnProfile(params: { name?: string; businessConstitution?: string }) {
  await apiCall("/me", { method: "PUT", body: JSON.stringify(params) })
  const firebaseUser = auth.currentUser
  if (firebaseUser && params.name) {
    await updateProfile(firebaseUser, { displayName: params.name })
  }
  return { user: firebaseUser ? await loadProfile(firebaseUser) : null }
}

export async function forgotPassword(email: string) {
  try {
    await sendPasswordResetEmail(auth, email)
  } catch (error) {
    console.warn("[forgotPassword]", error)
  }
  return { message: "If this email is registered, a reset link has been sent." }
}

// Firebase handles the reset via its emailed link; this page-level call is unused.
export async function resetPassword(_params: { password: string; confirmPassword: string }) {
  return { message: "Password reset is handled via the emailed link." }
}

export async function fetchCurrentUser(): Promise<User | null> {
  const user = await currentFirebaseUser()
  if (!user) {
    clearCurrentUser()
    return null
  }
  return loadProfile(user)
}

export async function signout() {
  try {
    await firebaseSignOut(auth)
  } finally {
    clearCurrentUser()
  }
}

// Only the restricted tools are grantable now - every calculator is open to any
// signed-in user, so listing them as toggles would imply control that no longer
// exists.
export async function getCalculatorFeatures(): Promise<CalculatorFeature[]> {
  return RESTRICTED_FEATURES.map((f: CatalogFeature) => ({ id: f.slug, slug: f.slug, name: f.name }))
}

// ---- Admin operations: service-role edge function (Firebase-token authed). ----
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
  return apiCall(`/admin/users/${encodeURIComponent(userId)}/role`, { method: "PUT", body: JSON.stringify({ role }) })
}

export async function updateUserAccessMode(userId: string, accessMode: AccessMode) {
  return apiCall(`/admin/users/${encodeURIComponent(userId)}/access-mode`, { method: "PUT", body: JSON.stringify({ accessMode }) })
}

export async function updateUserSuspension(userId: string, suspended: boolean) {
  return apiCall(`/admin/users/${encodeURIComponent(userId)}/suspend`, { method: "PUT", body: JSON.stringify({ suspended }) })
}

export async function updateUserCalculatorAccess(userId: string, slugs: string[]) {
  return apiCall(`/admin/users/${encodeURIComponent(userId)}/calculator-access`, { method: "PUT", body: JSON.stringify({ slugs }) })
}

export function canAccessAdmin(user: User | null | undefined): boolean {
  return user?.role === "SUPER_ADMIN"
}

export function hasAllCalculatorAccess(user: User | null | undefined): boolean {
  return user?.role === "SUPER_ADMIN" || user?.role === "ADMIN"
}

// Parsing on every call returned a fresh object each time, so `[user]` in a
// React dependency array never compared equal and any effect depending on it
// re-ran forever. Cache by the raw JSON so repeat calls share one reference,
// while a genuine change to the stored user still yields a new object.
let cachedUserJson: string | null = null
let cachedUser: User | null = null

export function getCurrentUser(): User | null {
  const userJson = localStorage.getItem(CURRENT_USER_KEY)
  if (!userJson) {
    cachedUserJson = null
    cachedUser = null
    return null
  }
  if (userJson === cachedUserJson) return cachedUser
  try {
    cachedUser = JSON.parse(userJson)
    cachedUserJson = userJson
    return cachedUser
  } catch {
    localStorage.removeItem(CURRENT_USER_KEY)
    cachedUserJson = null
    cachedUser = null
    return null
  }
}

export function setCurrentUser(user: User): void {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user))
}

export function clearCurrentUser(): void {
  localStorage.removeItem(CURRENT_USER_KEY)
}

export async function exportMyData(): Promise<Blob> {
  const response = await apiRequest("/me/export")
  if (!response.ok) throw new Error("Export failed")
  return new Blob([await response.text()], { type: "application/json" })
}

export async function deleteMyAccount(): Promise<void> {
  await apiCall("/me", { method: "DELETE" })
  await firebaseSignOut(auth)
  clearCurrentUser()
}

export async function fetchAuditEvents(limit = 100) {
  const data = await apiCall(`/admin/audit?limit=${limit}`)
  return Array.isArray(data.events) ? data.events : []
}
