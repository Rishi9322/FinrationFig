import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { signinSchema } from "../../../lib/validations"
import { signin, sendWhatsAppOTP, confirmWhatsAppOTP } from "../../../lib/auth"
import { OAuthButtons } from "../../components/auth/OAuthButtons"
import { toast } from "sonner"
import { ThemeToggle } from "../../components/ThemeToggle"

// WhatsApp OTP delivery isn't confirmed working yet on the provider side (see
// the messaginghub.solutions relay debugging). The tab is wired up end-to-end
// underneath; flip this once real sends verify to re-expose it in the UI.
const WHATSAPP_OTP_ENABLED = false

export default function SigninPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get("redirect") || "/dashboard"

  const [mode, setMode] = useState<"email" | "phone">("email")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)

  function goToDestination(role: string | undefined) {
    toast.success("Signed in successfully")
    navigate(redirect === "/dashboard" && role === "SUPER_ADMIN" ? "/admin" : redirect)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const result = signinSchema.safeParse({ email, password })
    if (!result.success) {
      setError(result.error.issues[0].message)
      return
    }
    setIsLoading(true)
    try {
      const data = await signin(email, password)
      // Firebase allows sign-in before the email link is clicked; don't block on it.
      goToDestination(data.user?.role)
    } catch (err: any) {
      setError(err.message || "Invalid credentials")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      await sendWhatsAppOTP(phone)
      setOtpSent(true)
      toast.success("OTP sent on WhatsApp")
    } catch (err: any) {
      setError(err.message || "Could not send OTP")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      const data = await confirmWhatsAppOTP(phone, otp.trim())
      goToDestination(data.user?.role)
    } catch (err: any) {
      setError(err.message || "Invalid OTP")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center px-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <ThemeToggle className="fixed top-4 right-4 z-10" />
      {/* Radial glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.09) 0%, transparent 65%)" }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src="/logo-mark.png" alt="FinRatio" className="h-14 w-auto sm:h-16" />
            <span className="text-xl font-semibold text-foreground tracking-tight">FinRatio</span>
            <span className="text-[10px] font-['Geist_Mono'] bg-primary/20 text-link border border-primary/30 rounded px-1.5 py-0.5 leading-none">β</span>
          </Link>
          <p className="text-sm text-muted-foreground mt-3">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-foreground/8 rounded-2xl p-8">
          {WHATSAPP_OTP_ENABLED && (
            <div className="flex bg-background border border-foreground/10 rounded-lg p-1 mb-5 text-sm">
              <button
                type="button"
                onClick={() => { setMode("email"); setError("") }}
                className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${mode === "email" ? "bg-primary text-white" : "text-muted-foreground hover:text-white"}`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => { setMode("phone"); setError("") }}
                className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${mode === "phone" ? "bg-primary text-white" : "text-muted-foreground hover:text-white"}`}
              >
                WhatsApp OTP
              </button>
            </div>
          )}

          {mode === "email" || !WHATSAPP_OTP_ENABLED ? (
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

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 pr-10 bg-background border border-foreground/10 rounded-lg text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="text-right pt-1">
                  <Link to="/auth/forgot-password" className="text-xs text-link hover:text-foreground transition-colors">
                    Forgot password?
                  </Link>
                </div>
              </div>

              {error && (
                <div className="bg-destructive/8 border border-destructive/25 text-destructive px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-colors mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">Phone number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  disabled={otpSent}
                  className="w-full px-4 py-2.5 bg-background border border-foreground/10 rounded-lg text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors disabled:opacity-60"
                />
              </div>

              {otpSent && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-foreground">Enter OTP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="6-digit code"
                    className="w-full px-4 py-2.5 bg-background border border-foreground/10 rounded-lg text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtp("") }}
                    className="text-xs text-link hover:text-foreground transition-colors"
                  >
                    Use a different number
                  </button>
                </div>
              )}

              {error && (
                <div className="bg-destructive/8 border border-destructive/25 text-destructive px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-colors mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {otpSent ? "Verifying..." : "Sending OTP..."}
                  </>
                ) : otpSent ? (
                  "Verify OTP"
                ) : (
                  "Send OTP on WhatsApp"
                )}
              </button>
            </form>
          )}

          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-foreground/8" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-foreground/8" />
          </div>

          <OAuthButtons />

          <p className="text-sm text-center text-muted-foreground mt-6">
            Don't have an account?{" "}
            <Link to="/auth/signup" className="text-link hover:text-foreground transition-colors font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
