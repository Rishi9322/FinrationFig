import React, { Fragment, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  createAdminUser,
  getAdminUsers,
  getCalculatorFeatures,
  updateUserAccessMode,
  updateUserCalculatorAccess,
  updateUserRole,
  updateUserSuspension,
  type AccessMode,
  type CalculatorFeature,
  type Role,
  type User,
} from "../../../lib/auth"

export default function UsersAdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [features, setFeatures] = useState<CalculatorFeature[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [editingAccessFor, setEditingAccessFor] = useState<string | null>(null)
  const [draftAccess, setDraftAccess] = useState<string[]>([])
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "ADMIN" as Role,
    accessMode: "FULL" as AccessMode,
    calculatorAccess: ["pid"],
  })

  async function loadAll() {
    setIsLoading(true)
    try {
      const [usersData, featuresData] = await Promise.all([getAdminUsers(), getCalculatorFeatures()])
      setUsers(usersData)
      setFeatures(featuresData)
    } catch (err: any) {
      toast.error(err.message || "Failed to load admin data")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const featureMap = useMemo(() => {
    return new Map(features.map((feature) => [feature.slug, feature.name]))
  }, [features])

  const allFeatureSlugs = useMemo(() => features.map((feature) => feature.slug), [features])

  const stats = useMemo(() => {
    const activeUsers = users.filter((user) => user.status === "ACTIVE").length
    const suspendedUsers = users.filter((user) => user.status === "SUSPENDED").length
    const adminUsers = users.filter((user) => user.role === "SUPER_ADMIN" || user.role === "ADMIN").length
    const fullAccessUsers = users.filter((user) => user.calculatorAccessMode === "FULL" || user.role === "SUPER_ADMIN" || user.role === "ADMIN").length

    return [
      { label: "Total Users", value: users.length },
      { label: "Active", value: activeUsers },
      { label: "Suspended", value: suspendedUsers },
      { label: "Admins", value: adminUsers },
      { label: "Full Access", value: fullAccessUsers },
    ]
  }, [users])

  function generatePassword() {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    const lower = "abcdefghijkmnopqrstuvwxyz"
    const digits = "23456789"
    const symbols = "!@#$%"
    const pool = `${upper}${lower}${digits}${symbols}`

    const required = [
      upper[Math.floor(Math.random() * upper.length)],
      lower[Math.floor(Math.random() * lower.length)],
      digits[Math.floor(Math.random() * digits.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
    ]

    const remaining = Array.from({ length: 6 }, () => pool[Math.floor(Math.random() * pool.length)])
    const password = [...required, ...remaining].sort(() => Math.random() - 0.5).join("")
    setCreateForm((current) => ({ ...current, password }))
  }

  async function handleCreateUser() {
    if (!createForm.name || !createForm.email || !createForm.password) {
      toast.error("Fill in name, email, and password")
      return
    }

    if (createForm.accessMode === "CUSTOM" && createForm.calculatorAccess.length === 0) {
      toast.error("Select at least one calculator for custom access")
      return
    }

    setIsSaving("create-user")
    try {
      const payloadAccess = createForm.accessMode === "FULL" ? allFeatureSlugs : createForm.calculatorAccess
      await createAdminUser({
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        role: createForm.role,
        calculatorAccessMode: createForm.role === "ADMIN" || createForm.role === "SUPER_ADMIN" ? "FULL" : createForm.accessMode,
        calculatorAccess: payloadAccess,
      })
      await loadAll()
      setCreateForm({
        name: "",
        email: "",
        password: "",
        role: "ADMIN",
        accessMode: "FULL",
        calculatorAccess: ["pid"],
      })
      toast.success("User created")
    } catch (err: any) {
      toast.error(err.message || "Failed to create user")
    } finally {
      setIsSaving(null)
    }
  }

  async function handleRoleChange(userId: string, role: Role) {
    setIsSaving(`role-${userId}`)
    try {
      await updateUserRole(userId, role)
      await loadAll()
      toast.success("Role updated")
    } catch (err: any) {
      toast.error(err.message || "Failed to update role")
    } finally {
      setIsSaving(null)
    }
  }

  async function handleAccessModeChange(user: User, accessMode: AccessMode) {
    setIsSaving(`mode-${user.id}`)
    try {
      await updateUserAccessMode(user.id, accessMode)
      await loadAll()
      toast.success(accessMode === "FULL" ? "Full access enabled" : "Custom access enabled")
    } catch (err: any) {
      toast.error(err.message || "Failed to update access mode")
    } finally {
      setIsSaving(null)
    }
  }

  async function handleSuspendToggle(user: User) {
    setIsSaving(`suspend-${user.id}`)
    try {
      await updateUserSuspension(user.id, user.status !== "SUSPENDED")
      await loadAll()
      toast.success(user.status === "SUSPENDED" ? "User reactivated" : "User suspended")
    } catch (err: any) {
      toast.error(err.message || "Failed to update status")
    } finally {
      setIsSaving(null)
    }
  }

  function openAccessEditor(user: User) {
    setEditingAccessFor(user.id)
    // calculatorAccess also carries the always-open calculators; only the
    // grantable tools belong in the editor.
    setDraftAccess(user.calculatorAccess.filter((slug) => allFeatureSlugs.includes(slug)))
  }

  /** The restricted tools this user holds, ignoring the always-open calculators. */
  function grantedFeatures(user: User) {
    return user.calculatorAccess.filter((slug) => allFeatureSlugs.includes(slug))
  }

  function closeAccessEditor() {
    setEditingAccessFor(null)
    setDraftAccess([])
  }

  function toggleDraftAccess(slug: string) {
    setDraftAccess((current) =>
      current.includes(slug) ? current.filter((value) => value !== slug) : [...current, slug],
    )
  }

  /** One request per save, not one per chip. */
  async function handleSaveAccess(user: User) {
    setIsSaving(`access-${user.id}`)
    try {
      await updateUserCalculatorAccess(user.id, draftAccess)
      await loadAll()
      closeAccessEditor()
      toast.success("Calculator access updated")
    } catch (err: any) {
      toast.error(err.message || "Failed to update calculator access")
    } finally {
      setIsSaving(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050A14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050A14] py-8 font-dm-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs font-['Geist_Mono'] text-[#2563EB] uppercase tracking-widest mb-2">Admin</p>
          <h1 className="text-3xl font-normal text-white font-instrument-serif">
            Admin Panel
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1.5 max-w-lg">
            Manage roles, calculator feature access, and account status.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {stats.map((item) => (
            <div key={item.label} className="rounded-lg border border-white/8 bg-[#0D1726] px-4 py-3">
              <p className="text-xs text-[#94A3B8] uppercase tracking-wider font-['Geist_Mono']">{item.label}</p>
              <p className="text-2xl text-white mt-1">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 rounded-xl border border-white/8 bg-[#0D1726] p-5">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <p className="text-xs font-['Geist_Mono'] uppercase tracking-widest text-[#94A3B8]">Create User</p>
              <h2 className="text-xl text-white mt-1">New admin or limited-access user</h2>
              <p className="text-sm text-[#94A3B8] mt-1.5 max-w-2xl">
                Set the role, choose full or custom access, and generate a 10-character password for first sign-in.
              </p>
            </div>
            <button
              onClick={generatePassword}
              className="px-4 py-2 rounded-lg border border-white/10 text-[#E2E8F0] hover:border-white/30 transition-colors"
            >
              Generate 10-char password
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 mt-5">
            <input
              value={createForm.name}
              onChange={(e) => setCreateForm((current) => ({ ...current, name: e.target.value }))}
              placeholder="Full name"
              className="bg-[#050A14] border border-white/10 text-white rounded-lg px-3 py-2.5"
            />
            <input
              value={createForm.email}
              onChange={(e) => setCreateForm((current) => ({ ...current, email: e.target.value }))}
              placeholder="Email address"
              className="bg-[#050A14] border border-white/10 text-white rounded-lg px-3 py-2.5"
            />
            <input
              value={createForm.password}
              onChange={(e) => setCreateForm((current) => ({ ...current, password: e.target.value }))}
              placeholder="Temporary password"
              className="bg-[#050A14] border border-white/10 text-white rounded-lg px-3 py-2.5"
            />
            <select
              value={createForm.role}
              onChange={(e) =>
                setCreateForm((current) => ({
                  ...current,
                  role: e.target.value as Role,
                  accessMode: e.target.value === "USER" ? current.accessMode : "FULL",
                }))
              }
              aria-label="User role"
              title="User role"
              className="bg-[#050A14] border border-white/10 text-white rounded-lg px-3 py-2.5"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              <option value="USER">USER</option>
            </select>
            <select
              value={createForm.accessMode}
              onChange={(e) => setCreateForm((current) => ({ ...current, accessMode: e.target.value as AccessMode }))}
              disabled={createForm.role !== "USER"}
              aria-label="Access mode"
              title="Access mode"
              className="bg-[#050A14] border border-white/10 text-white rounded-lg px-3 py-2.5 disabled:opacity-60"
            >
              <option value="FULL">Full access</option>
              <option value="CUSTOM">Custom access</option>
            </select>
          </div>

          {createForm.role === "USER" && createForm.accessMode === "CUSTOM" && (
            <div className="mt-4">
              <p className="text-xs font-['Geist_Mono'] uppercase tracking-widest text-[#94A3B8] mb-2">Custom calculators</p>
              <div className="flex flex-wrap gap-2">
                {features.map((feature) => {
                  const active = createForm.calculatorAccess.includes(feature.slug)
                  return (
                    <button
                      key={feature.slug}
                      type="button"
                      onClick={() =>
                        setCreateForm((current) => ({
                          ...current,
                          calculatorAccess: active
                            ? current.calculatorAccess.filter((slug) => slug !== feature.slug)
                            : [...current.calculatorAccess, feature.slug],
                        }))
                      }
                      className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                        active
                          ? "bg-[#2563EB]/15 border-[#2563EB]/40 text-[#93C5FD]"
                          : "bg-transparent border-white/15 text-[#94A3B8] hover:border-white/30"
                      }`}
                    >
                      {feature.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-3">
            <span className="text-xs text-[#94A3B8]">
              {createForm.role === "USER" && createForm.accessMode === "CUSTOM"
                ? `${createForm.calculatorAccess.length} feature(s) selected`
                : "Full access enabled"}
            </span>
            <button
              onClick={handleCreateUser}
              disabled={isSaving === "create-user"}
              className="px-5 py-2.5 rounded-lg bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-60"
            >
              {isSaving === "create-user" ? "Creating..." : "Create user"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/8 bg-[#0D1726]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left py-3.5 px-4 text-xs text-[#94A3B8] uppercase tracking-wider font-['Geist_Mono']">Name</th>
                <th className="text-left py-3.5 px-4 text-xs text-[#94A3B8] uppercase tracking-wider font-['Geist_Mono']">Email</th>
                <th className="text-left py-3.5 px-4 text-xs text-[#94A3B8] uppercase tracking-wider font-['Geist_Mono']">Role</th>
                <th className="text-left py-3.5 px-4 text-xs text-[#94A3B8] uppercase tracking-wider font-['Geist_Mono']">Access Tier</th>
                <th className="text-left py-3.5 px-4 text-xs text-[#94A3B8] uppercase tracking-wider font-['Geist_Mono']">Enabled Calculators</th>
                <th className="text-left py-3.5 px-4 text-xs text-[#94A3B8] uppercase tracking-wider font-['Geist_Mono']">Status</th>
                <th className="text-left py-3.5 px-4 text-xs text-[#94A3B8] uppercase tracking-wider font-['Geist_Mono']">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const locked = user.role !== "USER" || (user.calculatorAccessMode || "CUSTOM") === "FULL"
                const isEditing = editingAccessFor === user.id
                return (
                <Fragment key={user.id}>
                <tr className="border-b border-white/5 align-middle">
                  <td className="py-4 px-4 text-[#F1F5F9]">{user.name}</td>
                  <td className="py-4 px-4 text-[#cbd5e1]">{user.email}</td>
                  <td className="py-4 px-4">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                      disabled={isSaving === `role-${user.id}`}
                      aria-label={`Role for ${user.name}`}
                      title={`Role for ${user.name}`}
                      className="bg-[#050A14] border border-white/10 text-white rounded-lg px-3 py-1.5 text-xs"
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    </select>
                  </td>
                  <td className="py-4 px-4">
                    {user.role === "USER" ? (
                      <select
                        value={user.calculatorAccessMode || "CUSTOM"}
                        onChange={(e) => handleAccessModeChange(user, e.target.value as AccessMode)}
                        disabled={isSaving === `mode-${user.id}`}
                        aria-label={`Access tier for ${user.name}`}
                        title={`Access tier for ${user.name}`}
                        className="bg-[#050A14] border border-white/10 text-white rounded-lg px-3 py-1.5 text-xs"
                      >
                        <option value="FULL">FULL</option>
                        <option value="CUSTOM">CUSTOM</option>
                      </select>
                    ) : (
                      <span className="px-2 py-1 rounded-md text-[11px] border bg-[#2563EB]/15 border-[#2563EB]/40 text-[#93C5FD]">
                        FULL
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    {locked ? (
                      <span className="text-[11px] text-[#94A3B8]" title="Full access covers current and future calculators.">
                        All calculators
                      </span>
                    ) : (
                      <button
                        onClick={() => (isEditing ? closeAccessEditor() : openAccessEditor(user))}
                        aria-expanded={isEditing}
                        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-white/15 text-[#e2e8f0] text-xs hover:border-white/30 transition-colors"
                        title={
                          grantedFeatures(user).length
                            ? grantedFeatures(user).map((slug) => featureMap.get(slug) || slug).join(", ")
                            : "No restricted tools enabled"
                        }
                      >
                        <span className="text-[#93C5FD] font-['Geist_Mono']">
                          {grantedFeatures(user).length}/{features.length}
                        </span>
                        <span className="text-[#94A3B8]">{isEditing ? "Close" : "Edit"}</span>
                      </button>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2 py-1 rounded-md text-[11px] border ${
                        user.status === "SUSPENDED"
                          ? "bg-[#ef4444]/15 border-[#ef4444]/40 text-[#fca5a5]"
                          : "bg-[#10b981]/15 border-[#10b981]/40 text-[#86efac]"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() => handleSuspendToggle(user)}
                      disabled={isSaving === `suspend-${user.id}`}
                      className="px-3 py-1.5 text-xs rounded-lg border border-white/15 text-[#e2e8f0] hover:border-white/30 transition-colors"
                    >
                      {user.status === "SUSPENDED" ? "Unsuspend" : "Suspend"}
                    </button>
                  </td>
                </tr>

                {isEditing ? (
                  <tr className="border-b border-white/5 bg-[#050A14]/60">
                    <td colSpan={8} className="px-4 py-4">
                      <p className="text-[11px] text-[#94A3B8] mb-2.5">
                        All calculators are open to every user. Select the restricted tools for{" "}
                        <span className="text-[#e2e8f0]">{user.name}</span>, then save. Nothing changes until you do.
                      </p>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {features.map((feature) => {
                          const active = draftAccess.includes(feature.slug)
                          return (
                            <button
                              key={feature.slug}
                              onClick={() => toggleDraftAccess(feature.slug)}
                              aria-pressed={active}
                              className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${
                                active
                                  ? "bg-[#2563EB]/15 border-[#2563EB]/40 text-[#93C5FD]"
                                  : "bg-transparent border-white/15 text-[#94A3B8] hover:border-white/30"
                              }`}
                              title={featureMap.get(feature.slug) || feature.slug}
                            >
                              {feature.name}
                            </button>
                          )
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveAccess(user)}
                          disabled={isSaving === `access-${user.id}`}
                          className="px-3 py-1.5 text-xs rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
                        >
                          {isSaving === `access-${user.id}` ? "Saving..." : "Save access"}
                        </button>
                        <button
                          onClick={closeAccessEditor}
                          className="px-3 py-1.5 text-xs rounded-lg border border-white/15 text-[#e2e8f0] hover:border-white/30 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => setDraftAccess(draftAccess.length === allFeatureSlugs.length ? [] : allFeatureSlugs)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-white/15 text-[#94A3B8] hover:border-white/30 transition-colors ml-auto"
                        >
                          {draftAccess.length === allFeatureSlugs.length ? "Clear all" : "Select all"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null}
                </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
