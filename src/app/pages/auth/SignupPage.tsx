import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { Eye, EyeOff, Loader2, Ticket } from "lucide-react"
import { signupSchema } from "../../../lib/validations"
import { signup } from "../../../lib/auth"
import { toast } from "sonner"
import { ThemeToggle } from "../../components/ThemeToggle"

export default function SignupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [inviteCode, setInviteCode] = useState(searchParams.get("invite") || "")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function getPasswordStrength(): "weak" | "medium" | "strong" {
    if (password.length < 10) return "weak"
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSpecial = /[^A-Za-z0-9]/.test(password)
    if (hasUpper && hasLower && hasNumber && hasSpecial) return "strong"
    if ((hasUpper || hasLower) && hasNumber) return "medium"
    return "weak"
  }

  const strength = getPasswordStrength()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    const result = signupSchema.safeParse({
      name,
      email,
      password,
      confirmPassword,
      inviteCode,
    })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message
      })
      setErrors(fieldErrors)
      return
    }
    setIsLoading(true)
    try {
      await signup({ name, email, password, confirmPassword, inviteCode: inviteCode.trim() })
      toast.success("Account created. We've emailed a verification link.")
      navigate("/dashboard")
    } catch (error: any) {
      const message = error.message || "An error occurred. Please try again."
      if (message.includes("already registered")) {
        setErrors({ email: message })
      } else if (message.toLowerCase().includes("invite")) {
        setErrors({ inviteCode: message })
      } else {
        toast.error(message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const strengthColor = strength === "weak" ? "#ef4444" : strength === "medium" ? "#f59e0b" : "#10B981"
  const strengthWidth = strength === "weak" ? "33%" : strength === "medium" ? "66%" : "100%"

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center px-4 py-12"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <ThemeToggle className="fixed top-4 right-4 z-10" />
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
          <p className="text-sm text-muted-foreground mt-3">Create your account</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-foreground/8 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Invite code - FinRatio is invite-only right now */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Invite Code</label>
              <div className="relative">
                <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX"
                  className={`w-full pl-10 pr-4 py-2.5 bg-background border rounded-lg text-foreground text-sm font-['Geist_Mono'] tracking-wide placeholder:text-muted-foreground/50 placeholder:font-sans focus:outline-none transition-colors ${
                    errors.inviteCode
                      ? "border-destructive/50 focus:border-destructive"
                      : "border-foreground/10 focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
                  }`}
                />
              </div>
              {errors.inviteCode ? (
                <p className="text-xs text-destructive">{errors.inviteCode}</p>
              ) : (
                <p className="text-xs text-muted-foreground">FinRatio is invite-only right now - ask whoever invited you for a code.</p>
              )}
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rohan Mehta"
                className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none transition-colors ${
                  errors.name
                    ? "border-destructive/50 focus:border-destructive"
                    : "border-foreground/10 focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
                }`}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={`w-full px-4 py-2.5 bg-background border rounded-lg text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none transition-colors ${
                  errors.email
                    ? "border-destructive/50 focus:border-destructive"
                    : "border-foreground/10 focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
                }`}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-4 py-2.5 pr-10 bg-background border rounded-lg text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none transition-colors ${
                    errors.password
                      ? "border-destructive/50 focus:border-destructive"
                      : "border-foreground/10 focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}

              {password && (
                <div className="mt-2 space-y-1">
                  <div className="h-1 bg-foreground/8 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: strengthWidth, background: strengthColor }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Strength:{" "}
                    <span style={{ color: strengthColor }}>
                      {strength.charAt(0).toUpperCase() + strength.slice(1)}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-4 py-2.5 pr-10 bg-background border rounded-lg text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none transition-colors ${
                    errors.confirmPassword
                      ? "border-destructive/50 focus:border-destructive"
                      : "border-foreground/10 focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-colors mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link to="/auth/signin" className="text-link hover:text-foreground transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
