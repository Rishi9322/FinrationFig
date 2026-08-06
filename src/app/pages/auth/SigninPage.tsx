import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { signinSchema } from "../../../lib/validations"
import { signin } from "../../../lib/auth"
import { toast } from "sonner"

export default function SigninPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get("redirect") || "/dashboard"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

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
      if (data.needsVerification) {
        navigate(`/auth/verify-otp?email=${encodeURIComponent(email)}`)
        return
      }
      toast.success("Signed in successfully")
      const destination = redirect === "/dashboard" && data.user?.role === "SUPER_ADMIN" ? "/admin" : redirect
      navigate(destination)
    } catch (err: any) {
      setError(err.message || "Invalid credentials")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-[#050A14] flex items-center justify-center px-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Radial glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.09) 0%, transparent 65%)" }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src="/logoo.png" alt="FinRatio" className="h-14 w-auto sm:h-16" />
            <span className="text-[10px] font-['Geist_Mono'] bg-[#2563EB]/20 text-[#2563EB] border border-[#2563EB]/30 rounded px-1.5 py-0.5 leading-none">β</span>
          </Link>
          <p className="text-sm text-[#94A3B8] mt-3">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-[#0D1726] border border-white/8 rounded-2xl p-8">
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

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#F1F5F9]">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 bg-[#050A14] border border-white/10 rounded-lg text-[#F1F5F9] text-sm placeholder:text-[#94A3B8]/50 focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="text-right pt-1">
                <Link to="/auth/forgot-password" className="text-xs text-[#2563EB] hover:text-white transition-colors">
                  Forgot password?
                </Link>
              </div>
            </div>

            {error && (
              <div className="bg-[#ef4444]/8 border border-[#ef4444]/25 text-[#ef4444] px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-colors mt-2"
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

          <p className="text-sm text-center text-[#94A3B8] mt-6">
            Don't have an account?{" "}
            <Link to="/auth/signup" className="text-[#2563EB] hover:text-white transition-colors font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
