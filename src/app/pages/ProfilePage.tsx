import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { UserCircle, Loader2, Check } from "lucide-react"
import { getCurrentUser, updateOwnProfile, linkGoogleAccount, isGoogleLinked, exportMyData, deleteMyAccount } from "../../lib/auth"
import { toast } from "sonner"
import { ConfirmDialog } from "../components/admin/ConfirmDialog"
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
  const navigate = useNavigate()
  const [isExporting, setIsExporting] = useState(false)
  const [name, setName] = useState(user?.name ?? "")
  const [constitution, setConstitution] = useState(user?.businessConstitution ?? "")
  const [isSaving, setIsSaving] = useState(false)
  const [googleLinked, setGoogleLinked] = useState(isGoogleLinked())
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false)

  if (!user) return null

  async function handleLinkGoogle() {
    setIsLinkingGoogle(true)
    try {
      await linkGoogleAccount()
      setGoogleLinked(true)
      toast.success("Google account linked")
    } catch (err) {
      toast.error((err as Error).message || "Could not link Google account")
    } finally {
      setIsLinkingGoogle(false)
    }
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      const url = URL.createObjectURL(await exportMyData())
      const a = document.createElement("a")
      a.href = url
      a.download = "finratio-my-data.json"
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error((err as Error).message || "Could not export your data")
    } finally {
      setIsExporting(false)
    }
  }

  async function handleDeleteAccount() {
    try {
      await deleteMyAccount()
      toast.success("Your account and data have been deleted")
      navigate("/")
    } catch (err) {
      toast.error((err as Error).message || "Could not delete your account")
    }
  }

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
    <div className="min-h-screen bg-background py-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-normal text-foreground mb-6" style={{ fontFamily: "'Instrument Serif', serif" }}>
          Your Profile
        </h1>

        <div className="bg-card border border-foreground/8 rounded-xl p-8">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-foreground/8">
            <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center">
              <UserCircle className="w-7 h-7 text-link" />
            </div>
            <div>
              <div className="text-foreground font-medium">{user.name || user.email}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="name" className="block text-sm font-medium text-foreground">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-foreground/10 rounded-lg text-foreground text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Business Constitution</label>
              <Select value={constitution} onValueChange={setConstitution}>
                <SelectTrigger className="w-full px-4 py-3 h-auto bg-background border-foreground/10 rounded-lg text-foreground text-sm data-[placeholder]:text-muted-foreground">
                  <SelectValue placeholder="Select your business type" />
                </SelectTrigger>
                <SelectContent className="bg-card border-foreground/10 text-foreground">
                  {CONSTITUTIONS.map((c) => (
                    <SelectItem key={c} value={c} className="text-sm focus:bg-foreground/5">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Role</label>
              <div className="px-4 py-2.5 bg-foreground/3 border border-foreground/5 rounded-lg text-sm text-muted-foreground">
                {user.role}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Sign-in methods</label>
              {googleLinked ? (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-foreground/3 border border-foreground/5 rounded-lg text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-emerald-500" />
                  Google account linked
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleLinkGoogle}
                  disabled={isLinkingGoogle}
                  className="w-full flex items-center justify-center gap-2 bg-background border border-foreground/10 hover:border-primary/60 disabled:opacity-60 text-foreground py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {isLinkingGoogle ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Linking...
                    </>
                  ) : (
                    "Link Google account"
                  )}
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-colors"
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

        <div className="bg-card border border-foreground/8 rounded-xl p-8 mt-6">
          <h2 className="text-lg font-medium text-foreground mb-1">Your data</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Download a copy of the data we hold about you, or permanently delete your account. See our{" "}
            <Link to="/privacy" className="text-link underline">Privacy Policy</Link>.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 flex items-center justify-center gap-2 bg-background border border-foreground/10 hover:border-primary/60 disabled:opacity-60 text-foreground py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Export my data
            </button>
            <ConfirmDialog
              title="Delete your account?"
              description="This permanently deletes your login, profile, saved calculations and uploaded files. It cannot be undone."
              confirmLabel="Delete account"
              destructive
              onConfirm={handleDeleteAccount}
              trigger={
                <button
                  type="button"
                  className="flex-1 bg-background border border-destructive/40 hover:bg-destructive/10 text-destructive py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Delete account
                </button>
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
