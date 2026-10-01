import { apiCall, apiRequest } from "./apiSession"

export interface DayCount { date: string; count: number }

export interface AdminAnalytics {
  totals: {
    users: number
    activeUsers: number
    suspendedUsers: number
    calculations: number
    uploads: number
    feedback: number
    avgRating: number | null
  }
  signupsByDay: DayCount[]
  calculationsByDay: DayCount[]
  calculationsByType: { name: string; count: number }[]
}

export interface AdminUpload {
  id: string
  userId: string
  userEmail: string | null
  filename: string
  contentType: string | null
  sizeBytes: number | null
  createdAt: string
}

// SUPER_ADMIN only - the edge function enforces this server-side.
export function getAdminAnalytics(): Promise<AdminAnalytics> {
  return apiCall("/admin/analytics")
}

export async function getAdminUploads(): Promise<AdminUpload[]> {
  const data = await apiCall("/admin/uploads")
  return data.uploads || []
}

/** Fetches with the auth header (a plain <a href> can't), then saves via a temp link. */
export async function downloadAdminUpload(upload: AdminUpload): Promise<void> {
  const res = await apiRequest(`/admin/uploads/${upload.id}/download`)
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Download failed")
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement("a")
  a.href = url
  a.download = upload.filename
  a.click()
  URL.revokeObjectURL(url)
}
