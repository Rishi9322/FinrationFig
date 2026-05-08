import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { signupSchema } from "../../../lib/validations"
import { signup } from "../../../lib/auth"
import { toast } from "sonner"

export default function SignupPage() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function getPasswordStrength(): "weak" | "medium" | "strong" {
    if (password.length < 8) return "weak"
    const hasUpper = /[A-Z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    if (hasUpper && hasNumber) return "strong"
    if (hasUpper || hasNumber) return "medium"
    return "weak"
  }

  const strength = getPasswordStrength()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    const result = signupSchema.safeParse({ name, email, password })
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
      await signup(name, email, password)
      toast.success("Account created! Check the server logs for your OTP.")
      navigate(`/auth/verify-otp?email=${encodeURIComponent(email)}`)
    } catch (error: any) {
      const message = error.message || "An error occurred. Please try again."
      if (message.includes("already registered")) {
        setErrors({ email: message })
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
      className="min-h-screen bg-[#050A14] flex items-center justify-center px-4 py-12"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.09) 0%, transparent 65%)" }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <span
              className="text-2xl font-semibold text-white"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              FinRatio
            </span>
            <span className="text-[10px] font-['Geist_Mono'] bg-[#2563EB]/20 text-[#2563EB] border border-[#2563EB]/30 rounded px-1.5 py-0.5 leading-none">β</span>
          </Link>
          <p className="text-sm text-[#64748B] mt-3">Create your account</p>
        </div>

        {/* Card */}
        <div className="bg-[#0D1726] border border-white/8 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#F1F5F9]">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rohan Mehta"
                className={`w-full px-4 py-2.5 bg-[#050A14] border rounded-lg text-[#F1F5F9] text-sm placeholder:text-[#64748B]/50 focus:outline-none transition-colors ${
                  errors.name
                    ? "border-[#ef4444]/50 focus:border-[#ef4444]"
                    : "border-white/10 focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20"
                }`}
              />
              {errors.name && <p className="text-xs text-[#ef4444]">{errors.name}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#F1F5F9]">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={`w-full px-4 py-2.5 bg-[#050A14] border rounded-lg text-[#F1F5F9] text-sm placeholder:text-[#64748B]/50 focus:outline-none transition-colors ${
                  errors.email
                    ? "border-[#ef4444]/50 focus:border-[#ef4444]"
                    : "border-white/10 focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20"
                }`}
              />
              {errors.email && <p className="text-xs text-[#ef4444]">{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#F1F5F9]">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-4 py-2.5 pr-10 bg-[#050A14] border rounded-lg text-[#F1F5F9] text-sm placeholder:text-[#64748B]/50 focus:outline-none transition-colors ${
                    errors.password
                      ? "border-[#ef4444]/50 focus:border-[#ef4444]"
                      : "border-white/10 focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-[#ef4444]">{errors.password}</p>}

              {password && (
                <div className="mt-2 space-y-1">
                  <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: strengthWidth, background: strengthColor }}
                    />
                  </div>
                  <p className="text-xs text-[#64748B]">
                    Strength:{" "}
                    <span style={{ color: strengthColor }}>
                      {strength.charAt(0).toUpperCase() + strength.slice(1)}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-colors mt-2"
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

          <p className="text-sm text-center text-[#64748B] mt-6">
            Already have an account?{" "}
            <Link to="/auth/signin" className="text-[#2563EB] hover:text-white transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
