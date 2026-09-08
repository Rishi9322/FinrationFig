import { apiCall } from "./apiSession"

export type InviteStatus = "ACTIVE" | "REVOKED"
export type InviteComputedStatus = "ACTIVE" | "SCHEDULED" | "EXPIRED" | "EXHAUSTED" | "REVOKED"

export interface Invite {
  id: string
  code: string
  note?: string | null
  email?: string | null
  createdBy: string
  startsAt: string
  expiresAt?: string | null
  maxUses: number
  useCount: number
  status: InviteStatus
  computedStatus: InviteComputedStatus
  createdAt: string
}

export interface InviteRedemption {
  id: string
  userId: string
  userEmail: string
  redeemedAt: string
}

export interface CreateInviteInput {
  code?: string
  note?: string
  email?: string
  startsAt?: string
  expiresAt?: string
  maxUses?: number
}

export async function listInvites(): Promise<Invite[]> {
  const data = await apiCall("/admin/invites")
  return data.invites || []
}

export async function createInvite(input: CreateInviteInput): Promise<Invite> {
  const data = await apiCall("/admin/invites", { method: "POST", body: JSON.stringify(input) })
  return data.invite
}

export async function revokeInvite(id: string): Promise<Invite> {
  const data = await apiCall(`/admin/invites/${encodeURIComponent(id)}/revoke`, { method: "PUT" })
  return data.invite
}

export async function getInviteRedemptions(id: string): Promise<InviteRedemption[]> {
  const data = await apiCall(`/admin/invites/${encodeURIComponent(id)}/redemptions`)
  return data.redemptions || []
}

export async function emailInvite(id: string, to: string): Promise<void> {
  await apiCall(`/admin/invites/${encodeURIComponent(id)}/email`, { method: "POST", body: JSON.stringify({ to }) })
}
