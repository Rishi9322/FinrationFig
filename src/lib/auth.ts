import { projectId, publicAnonKey } from "../../utils/supabase/info";

export interface User {
  id: string
  email: string
  name: string
  isVerified: boolean
  createdAt: string
}

const CURRENT_USER_KEY = "finratio_current_user"
const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-bd792702`

async function apiCall(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${publicAnonKey}`,
      ...options.headers,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || "Request failed")
  }

  return data
}

export async function signup(name: string, email: string, password: string) {
  return apiCall("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  })
}

export async function verifyOTP(email: string, otp: string) {
  const data = await apiCall("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  })

  if (data.user) {
    setCurrentUser(data.user)
  }

  return data
}

export async function signin(email: string, password: string) {
  const data = await apiCall("/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })

  if (data.user) {
    setCurrentUser(data.user)
  }

  return data
}

export async function resendOTP(email: string) {
  return apiCall("/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export function getCurrentUser(): User | null {
  const userJson = localStorage.getItem(CURRENT_USER_KEY)
  return userJson ? JSON.parse(userJson) : null
}

export function setCurrentUser(user: User): void {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user))
}

export function clearCurrentUser(): void {
  localStorage.removeItem(CURRENT_USER_KEY)
}
