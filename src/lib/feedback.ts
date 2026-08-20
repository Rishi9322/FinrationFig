import { apiCall } from "./apiSession"

export type FeedbackType = "REVIEW" | "FEATURE_REQUEST" | "BUG"

export interface FeedbackEntry {
  id: string
  userEmail: string
  type: FeedbackType
  message: string
  rating: number | null
  createdAt: string
}

export async function submitFeedback(params: { type: FeedbackType; message: string; rating?: number }) {
  return apiCall("/feedback", { method: "POST", body: JSON.stringify(params) })
}

// SUPER_ADMIN only — the edge function enforces this server-side.
export async function getAdminFeedback(): Promise<FeedbackEntry[]> {
  const data = await apiCall("/admin/feedback")
  return data.feedback || []
}
