import { apiCall } from "./apiSession"

export interface NewsItem {
  id: string
  title: string
  url: string
  author: string | null
  snippet: string | null
  publishedAt: string | null
  status: "pending" | "approved" | "rejected"
  sourceId: string
  sourceName: string
}

export interface NewsSource {
  id: string
  name: string
  kind: "rss" | "gdelt"
  url: string
  enabled: boolean
  display: "headline" | "snippet"
  note: string | null
  lastFetchedAt: string | null
  lastStatus: string | null
}

export async function listApprovedNews(): Promise<NewsItem[]> {
  const data = await apiCall("/news")
  return data.items || []
}

// Admin-only - the edge function enforces ADMIN/SUPER_ADMIN server-side.
export async function getAdminNews(status?: NewsItem["status"]): Promise<{ items: NewsItem[]; sources: NewsSource[] }> {
  const data = await apiCall(`/admin/news${status ? `?status=${status}` : ""}`)
  return { items: data.items || [], sources: data.sources || [] }
}

export async function setNewsStatus(id: string, status: NewsItem["status"]): Promise<void> {
  await apiCall(`/admin/news/${id}`, { method: "PUT", body: JSON.stringify({ status }) })
}

export async function setNewsSourceEnabled(id: string, enabled: boolean): Promise<void> {
  await apiCall(`/admin/news/sources/${id}`, { method: "PUT", body: JSON.stringify({ enabled }) })
}

export async function refreshNewsNow(): Promise<{ added: number; sources: number }> {
  return apiCall("/admin/news/refresh", { method: "POST" })
}
