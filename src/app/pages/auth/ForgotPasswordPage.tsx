import React, { useState } from "react"
import { Link } from "react-router"
import { Loader2, Mail } from "lucide-react"
import { toast } from "sonner"
import { forgotPassword } from "../../../lib/auth"
import { forgotPasswordSchema } from "../../../lib/validations"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const parsed = forgotPasswordSchema.safeParse({ email })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Please enter a valid email")
      return
    }

    setIsLoading(true)
    try {
      await forgotPassword(email)
      toast.success("If this email exists, a reset link has been sent.")
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset link")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050A14] flex items-center justify-center px-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.09) 0%, transparent 65%)" }} />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src="/logoo.png" alt="FinRatio" className="h-14 w-auto sm:h-16" />
          </Link>
          <p className="text-sm text-[#64748B] mt-3">Recover your account</p>
        </div>

        <div className="bg-[#0D1726] border border-white/8 rounded-2xl p-8">
          <div className="flex items-center gap-2 mb-4 text-[#93C5FD] text-sm">
            <Mail className="h-4 w-4" />
            Password reset by email link
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#F1F5F9]">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-4 py-2.5 bg-[#050A14] border border-white/10 rounded-lg text-[#F1F5F9] text-sm placeholder:text-[#64748B]/50 focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
              />
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
                  Sending reset link...
                </>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>

          <p className="text-sm text-center text-[#64748B] mt-6">
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
