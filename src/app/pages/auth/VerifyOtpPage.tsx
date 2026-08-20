import React, { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { Loader2, Mail } from "lucide-react"
import { toast } from "sonner"
import { otpSchema } from "../../../lib/validations"
import { resendOTP, verifyOTP } from "../../../lib/auth"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../../components/ui/input-otp"

export default function VerifyOtpPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState(searchParams.get("email") || "")
  const [otp, setOtp] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const parsed = otpSchema.safeParse({ email, otp })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Please enter a valid OTP")
      return
    }

    setIsLoading(true)
    try {
      await verifyOTP(email, otp)
      toast.success("Email verified successfully")
      navigate("/dashboard")
    } catch (err: any) {
      setError(err.message || "Verification failed")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResend() {
    if (!email) {
      setError("Email is required")
      return
    }

    setIsResending(true)
    try {
      await resendOTP(email)
      toast.success("A new OTP has been sent to your email")
    } catch (err: any) {
      toast.error(err.message || "Failed to resend OTP")
    } finally {
      setIsResending(false)
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
          <p className="text-sm text-[#94A3B8] mt-3">Verify your email to continue</p>
        </div>

        <div className="bg-[#0D1726] border border-white/8 rounded-2xl p-8">
          <div className="flex items-start gap-3 mb-5 p-3 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/25">
            <Mail className="w-4 h-4 text-[#60A5FA] mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-white font-medium">Check your inbox</p>
              <p className="text-xs text-[#93C5FD] break-all">{email || "Enter your email below"}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#F1F5F9]">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-4 py-2.5 bg-[#050A14] border border-white/10 rounded-lg text-[#F1F5F9] text-sm placeholder:text-[#94A3B8]/50 focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#F1F5F9]">6-digit OTP</label>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp} containerClassName="justify-center">
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="h-11 w-11 bg-[#050A14] border-white/10 text-white" />
                    <InputOTPSlot index={1} className="h-11 w-11 bg-[#050A14] border-white/10 text-white" />
                    <InputOTPSlot index={2} className="h-11 w-11 bg-[#050A14] border-white/10 text-white" />
                    <InputOTPSlot index={3} className="h-11 w-11 bg-[#050A14] border-white/10 text-white" />
                    <InputOTPSlot index={4} className="h-11 w-11 bg-[#050A14] border-white/10 text-white" />
                    <InputOTPSlot index={5} className="h-11 w-11 bg-[#050A14] border-white/10 text-white" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            {error && <p className="text-sm text-[#ef4444] text-center">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-colors mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Email"
              )}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="text-sm text-[#60A5FA] hover:text-white transition-colors disabled:opacity-60"
            >
              {isResending ? "Resending OTP..." : "Resend OTP"}
            </button>
            <p className="text-sm text-[#94A3B8]">
              Back to{" "}
              <Link to="/auth/signin" className="text-[#60A5FA] hover:text-white transition-colors font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
