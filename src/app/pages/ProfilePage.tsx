import { useState } from "react"
import { UserCircle, Loader2 } from "lucide-react"
import { getCurrentUser, updateOwnProfile } from "../../lib/auth"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select"

const CONSTITUTIONS = [
  "Sole Proprietorship",
  "Partnership Firm",
  "Limited Liability Partnership (LLP)",
  "Private Limited Company",
  "Public Limited Company",
  "One Person Company (OPC)",
  "Section 8 Company (Non-Profit)",
  "Trust",
  "Society",
  "Hindu Undivided Family (HUF)",
  "Cooperative Society",
  "Government Entity / PSU",
  "Other",
]

export default function ProfilePage() {
  const user = getCurrentUser()
  const [name, setName] = useState(user?.name ?? "")
  const [constitution, setConstitution] = useState(user?.businessConstitution ?? "")
  const [isSaving, setIsSaving] = useState(false)

  if (!user) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Name cannot be empty")
      return
    }
    setIsSaving(true)
    try {
      await updateOwnProfile({ name: name.trim(), businessConstitution: constitution })
      toast.success("Profile updated")
    } catch (err) {
      toast.error((err as Error).message || "Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050A14] py-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-normal text-white mb-6" style={{ fontFamily: "'Instrument Serif', serif" }}>
          Your Profile
        </h1>

        <div className="bg-[#0D1726] border border-white/8 rounded-xl p-8">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/8">
            <div className="w-14 h-14 bg-[#2563EB]/10 border border-[#2563EB]/20 rounded-2xl flex items-center justify-center">
              <UserCircle className="w-7 h-7 text-[#2563EB]" />
            </div>
            <div>
              <div className="text-white font-medium">{user.name || user.email}</div>
              <div className="text-xs text-[#94A3B8]">{user.email}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="name" className="block text-sm font-medium text-[#F1F5F9]">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#050A14] border border-white/10 rounded-lg text-[#F1F5F9] text-sm focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#F1F5F9]">Business Constitution</label>
              <Select value={constitution} onValueChange={setConstitution}>
                <SelectTrigger className="w-full px-4 py-3 h-auto bg-[#050A14] border-white/10 rounded-lg text-[#F1F5F9] text-sm data-[placeholder]:text-[#94A3B8]">
                  <SelectValue placeholder="Select your business type" />
                </SelectTrigger>
                <SelectContent className="bg-[#0D1726] border-white/10 text-[#F1F5F9]">
                  {CONSTITUTIONS.map((c) => (
                    <SelectItem key={c} value={c} className="text-sm focus:bg-white/5">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#F1F5F9]">Role</label>
              <div className="px-4 py-2.5 bg-white/3 border border-white/5 rounded-lg text-sm text-[#94A3B8]">
                {user.role}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
