import React, { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  getAdminUsers,
  getCalculatorFeatures,
  updateUserCalculatorAccess,
  updateUserRole,
  updateUserSuspension,
  type CalculatorFeature,
  type Role,
  type User,
} from "../../../lib/auth"

export default function UsersAdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [features, setFeatures] = useState<CalculatorFeature[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)

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

  const stats = useMemo(() => {
    const activeUsers = users.filter((user) => user.status === "ACTIVE").length
    const suspendedUsers = users.filter((user) => user.status === "SUSPENDED").length
    const adminUsers = users.filter((user) => user.role === "SUPER_ADMIN" || user.role === "ADMIN").length

    return [
      { label: "Total Users", value: users.length },
      { label: "Active", value: activeUsers },
      { label: "Suspended", value: suspendedUsers },
      { label: "Admins", value: adminUsers },
    ]
  }, [users])

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

  async function handleAccessToggle(user: User, slug: string) {
    setIsSaving(`access-${user.id}-${slug}`)
    try {
      const hasAccess = user.calculatorAccess.includes(slug)
      const next = hasAccess
        ? user.calculatorAccess.filter((value) => value !== slug)
        : [...user.calculatorAccess, slug]

      await updateUserCalculatorAccess(user.id, next)
      await loadAll()
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
    <div className="min-h-screen bg-[#050A14] py-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs font-['Geist_Mono'] text-[#2563EB] uppercase tracking-widest mb-2">Admin</p>
          <h1 className="text-3xl font-normal text-white" style={{ fontFamily: "'Instrument Serif', serif" }}>
            Admin Panel
          </h1>
          <p className="text-sm text-[#64748B] mt-1.5 max-w-lg">
            Manage roles, calculator feature access, and account status.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {stats.map((item) => (
            <div key={item.label} className="rounded-lg border border-white/8 bg-[#0D1726] px-4 py-3">
              <p className="text-xs text-[#64748B] uppercase tracking-wider font-['Geist_Mono']">{item.label}</p>
              <p className="text-2xl text-white mt-1">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/8 bg-[#0D1726]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left py-3.5 px-4 text-xs text-[#64748B] uppercase tracking-wider font-['Geist_Mono']">Name</th>
                <th className="text-left py-3.5 px-4 text-xs text-[#64748B] uppercase tracking-wider font-['Geist_Mono']">Email</th>
                <th className="text-left py-3.5 px-4 text-xs text-[#64748B] uppercase tracking-wider font-['Geist_Mono']">Phone</th>
                <th className="text-left py-3.5 px-4 text-xs text-[#64748B] uppercase tracking-wider font-['Geist_Mono']">Role</th>
                <th className="text-left py-3.5 px-4 text-xs text-[#64748B] uppercase tracking-wider font-['Geist_Mono']">Enabled Calculators</th>
                <th className="text-left py-3.5 px-4 text-xs text-[#64748B] uppercase tracking-wider font-['Geist_Mono']">Status</th>
                <th className="text-left py-3.5 px-4 text-xs text-[#64748B] uppercase tracking-wider font-['Geist_Mono']">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-white/5 align-top">
                  <td className="py-4 px-4 text-[#F1F5F9]">{user.name}</td>
                  <td className="py-4 px-4 text-[#cbd5e1]">{user.email}</td>
                  <td className="py-4 px-4 text-[#cbd5e1]">{user.phoneNumber}</td>
                  <td className="py-4 px-4">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                      disabled={isSaving === `role-${user.id}`}
                      className="bg-[#050A14] border border-white/10 text-white rounded-lg px-3 py-1.5 text-xs"
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    </select>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-wrap gap-1.5 max-w-sm">
                      {features.map((feature) => {
                        const active = user.calculatorAccess.includes(feature.slug)
                        const key = `access-${user.id}-${feature.slug}`
                        return (
                          <button
                            key={feature.slug}
                            onClick={() => handleAccessToggle(user, feature.slug)}
                            disabled={isSaving === key}
                            className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${
                              active
                                ? "bg-[#2563EB]/15 border-[#2563EB]/40 text-[#93C5FD]"
                                : "bg-transparent border-white/15 text-[#94A3B8] hover:border-white/30"
                            }`}
                            title={featureMap.get(feature.slug) || feature.slug}
                          >
                            {feature.slug}
                          </button>
                        )
                      })}
                    </div>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
