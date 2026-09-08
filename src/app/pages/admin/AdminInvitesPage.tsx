import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Plus, X, Copy, Mail, Users, Ban, ChevronDown, ChevronUp } from "lucide-react"
import {
  listInvites, createInvite, revokeInvite, getInviteRedemptions, emailInvite,
  type Invite, type InviteRedemption, type CreateInviteInput,
} from "../../../lib/invites"

const EMPTY: CreateInviteInput = { code: "", note: "", email: "", startsAt: "", expiresAt: "", maxUses: 1 }

const STATUS_STYLE: Record<Invite["computedStatus"], string> = {
  ACTIVE: "bg-accent/15 text-accent",
  SCHEDULED: "bg-primary/15 text-link",
  EXPIRED: "bg-foreground/8 text-muted-foreground",
  EXHAUSTED: "bg-foreground/8 text-muted-foreground",
  REVOKED: "bg-destructive/15 text-destructive",
}

export default function AdminInvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateInviteInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [redemptions, setRedemptions] = useState<Record<string, InviteRedemption[]>>({})

  function load() {
    setIsLoading(true)
    listInvites().then(setInvites).catch((err) => toast.error(err.message || "Failed to load invites")).finally(() => setIsLoading(false))
  }
  useEffect(load, [])

  async function handleCreate() {
    setSaving(true)
    try {
      const payload: CreateInviteInput = {
        code: form.code?.trim() || undefined,
        note: form.note?.trim() || undefined,
        email: form.email?.trim() || undefined,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        maxUses: form.maxUses || 1,
      }
      const invite = await createInvite(payload)
      toast.success(`Invite ${invite.code} created`)
      setForm(EMPTY)
      setShowForm(false)
      load()
    } catch (err: any) {
      toast.error(err.message || "Could not create invite")
    } finally {
      setSaving(false)
    }
  }

  async function handleRevoke(invite: Invite) {
    if (!confirm(`Revoke invite ${invite.code}? It can no longer be redeemed.`)) return
    try {
      await revokeInvite(invite.id)
      toast.success("Invite revoked")
      load()
    } catch (err: any) {
      toast.error(err.message || "Could not revoke invite")
    }
  }

  async function handleEmail(invite: Invite) {
    const to = prompt(`Send invite ${invite.code} to which email address?`, invite.email || "")
    if (!to) return
    try {
      await emailInvite(invite.id, to.trim())
      toast.success(`Invite emailed to ${to.trim()}`)
    } catch (err: any) {
      toast.error(err.message || "Could not send invite email")
    }
  }

  async function toggleRedemptions(invite: Invite) {
    if (expandedId === invite.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(invite.id)
    if (!redemptions[invite.id]) {
      try {
        const r = await getInviteRedemptions(invite.id)
        setRedemptions((prev) => ({ ...prev, [invite.id]: r }))
      } catch (err: any) {
        toast.error(err.message || "Could not load redemptions")
      }
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => toast.success("Code copied")).catch(() => toast.error("Could not copy"))
  }

  return (
    <main className="min-h-screen bg-background py-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
          <h1 className="text-3xl font-normal text-foreground" style={{ fontFamily: "'Instrument Serif', serif" }}>Invites</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Invite
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-6">FinRatio is invite-only - signup requires one of these codes.</p>

        {showForm && (
          <div className="bg-card border border-foreground/10 rounded-xl p-5 mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">New Invite</h2>
              <button onClick={() => setShowForm(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Code (leave blank to auto-generate)</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. LAUNCH-2026"
                  className="w-full bg-background border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground placeholder:font-sans"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Restrict to email (optional)</label>
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="only this address may redeem it"
                  className="w-full bg-background border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Starts at (blank = immediately)</label>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  className="w-full bg-background border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Expires at (blank = never)</label>
                <input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="w-full bg-background border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Max uses</label>
                <input
                  type="number"
                  min={1}
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-full bg-background border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Note (admin-only)</label>
                <input
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="e.g. Batch for the CA partner referrals"
                  className="w-full bg-background border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="text-sm px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create Invite"}
            </button>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invites yet.</p>
        ) : (
          <div className="space-y-3">
            {invites.map((inv) => (
              <div key={inv.id} className="bg-card border border-foreground/8 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => copyCode(inv.code)}
                        title="Copy code"
                        className="flex items-center gap-1.5 text-sm font-mono text-foreground hover:text-link transition-colors"
                      >
                        {inv.code} <Copy className="h-3 w-3" />
                      </button>
                      <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLE[inv.computedStatus]}`}>{inv.computedStatus}</span>
                      {inv.email && <span className="text-xs px-2 py-0.5 rounded bg-foreground/5 text-muted-foreground">{inv.email}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {inv.useCount}/{inv.maxUses} used
                      {" - "}
                      {new Date(inv.startsAt).toLocaleString()} to {inv.expiresAt ? new Date(inv.expiresAt).toLocaleString() : "never"}
                      {inv.note ? ` - ${inv.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleEmail(inv)} title="Email this invite" className="p-1.5 text-muted-foreground hover:text-foreground">
                      <Mail className="h-4 w-4" />
                    </button>
                    <button onClick={() => toggleRedemptions(inv)} title="Who used this" className="p-1.5 text-muted-foreground hover:text-foreground">
                      <Users className="h-4 w-4" />
                      {expandedId === inv.id ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />}
                    </button>
                    {inv.status === "ACTIVE" && (
                      <button onClick={() => handleRevoke(inv)} title="Revoke" className="p-1.5 text-muted-foreground hover:text-destructive">
                        <Ban className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {expandedId === inv.id && (
                  <div className="mt-3 pt-3 border-t border-foreground/8">
                    {!redemptions[inv.id] ? (
                      <p className="text-xs text-muted-foreground">Loading…</p>
                    ) : redemptions[inv.id].length === 0 ? (
                      <p className="text-xs text-muted-foreground">No one has signed up with this code yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {redemptions[inv.id].map((r) => (
                          <li key={r.id} className="text-xs text-muted-foreground flex items-center justify-between">
                            <span className="text-foreground">{r.userEmail}</span>
                            <span>{new Date(r.redeemedAt).toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
