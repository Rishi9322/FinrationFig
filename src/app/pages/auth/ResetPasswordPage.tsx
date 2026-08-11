import React, { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { resetPassword } from "../../../lib/auth"
import { resetPasswordSchema } from "../../../lib/validations"
import { supabase } from "../../../lib/supabaseClient"

export default function ResetPasswordPage() {
  const navigate = useNavigate()

  // The recovery link establishes a session (detectSessionInUrl). No session on
  // this page means the link was expired, already used, or opened directly.
  const [linkValid, setLinkValid] = useState<boolean | null>(null)

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true
    // Wait for supabase-js to parse the recovery token out of the URL.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === "PASSWORD_RECOVERY" || session) setLinkValid(true)
    })
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && linkValid === null) setLinkValid(Boolean(data.session))
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Please check your input")
      return
    }

    setIsLoading(true)
    try {
      await resetPassword({ password, confirmPassword })
      await supabase.auth.signOut()
      toast.success("Password reset successful. Please sign in.")
      navigate("/auth/signin")
    } catch (err: any) {
      setError(err.message || "Failed to reset password")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050A14] flex items-center justify-center px-4 py-12" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.09) 0%, transparent 65%)" }} />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src="/logoo.png" alt="FinRatio" className="h-14 w-auto sm:h-16" />
          </Link>
          <p className="text-sm text-[#94A3B8] mt-3">Create a new password</p>
        </div>

        <div className="bg-[#0D1726] border border-white/8 rounded-2xl p-8">
          {linkValid === false ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-[#F1F5F9]">
                This reset link has expired or was already used.
              </p>
              <Link
                to="/auth/forgot-password"
                className="inline-block w-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white py-3 rounded-xl text-sm font-medium transition-colors"
              >
                Request a new link
              </Link>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#F1F5F9]">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 bg-[#050A14] border border-white/10 rounded-lg text-[#F1F5F9] text-sm placeholder:text-[#94A3B8]/50 focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#F1F5F9]">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 bg-[#050A14] border border-white/10 rounded-lg text-[#F1F5F9] text-sm placeholder:text-[#94A3B8]/50 focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white transition-colors">
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-[#ef4444]">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resetting password...
                </>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>
          )}

          <p className="text-sm text-center text-[#94A3B8] mt-6">
            Back to{" "}
            <Link to="/auth/signin" className="text-[#2563EB] hover:text-white transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
