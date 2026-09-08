import React, { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { Loader2, Mail } from "lucide-react"
import { toast } from "sonner"
import { otpSchema } from "../../../lib/validations"
import { resendOTP, verifyOTP } from "../../../lib/auth"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../../components/ui/input-otp"
import { ThemeToggle } from "../../components/ThemeToggle"

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
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <ThemeToggle className="fixed top-4 right-4 z-10" />
      <div className="fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.09) 0%, transparent 65%)" }} />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src="/logo-mark.png" alt="FinRatio" className="h-14 w-auto sm:h-16" />
            <span className="text-xl font-semibold text-foreground tracking-tight">FinRatio</span>
          </Link>
          <p className="text-sm text-muted-foreground mt-3">Verify your email to continue</p>
        </div>

        <div className="bg-card border border-foreground/8 rounded-2xl p-8">
          <div className="flex items-start gap-3 mb-5 p-3 rounded-lg bg-primary/10 border border-primary/25">
            <Mail className="w-4 h-4 text-link mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-foreground font-medium">Check your inbox</p>
              <p className="text-xs text-link break-all">{email || "Enter your email below"}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-4 py-2.5 bg-background border border-foreground/10 rounded-lg text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">6-digit OTP</label>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp} containerClassName="justify-center">
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="h-11 w-11 bg-background border-foreground/10 text-foreground" />
                    <InputOTPSlot index={1} className="h-11 w-11 bg-background border-foreground/10 text-foreground" />
                    <InputOTPSlot index={2} className="h-11 w-11 bg-background border-foreground/10 text-foreground" />
                    <InputOTPSlot index={3} className="h-11 w-11 bg-background border-foreground/10 text-foreground" />
                    <InputOTPSlot index={4} className="h-11 w-11 bg-background border-foreground/10 text-foreground" />
                    <InputOTPSlot index={5} className="h-11 w-11 bg-background border-foreground/10 text-foreground" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-colors mt-2"
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
              className="text-sm text-link hover:text-foreground transition-colors disabled:opacity-60"
            >
              {isResending ? "Resending OTP..." : "Resend OTP"}
            </button>
            <p className="text-sm text-muted-foreground">
              Back to{" "}
              <Link to="/auth/signin" className="text-link hover:text-foreground transition-colors font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
