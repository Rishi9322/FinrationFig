import { useState, useEffect, useRef } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { Loader2, ShieldCheck } from "lucide-react"
import { verifyOTP, resendOTP } from "../../../lib/auth"
import { toast } from "sonner"

export default function VerifyOtpPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get("email") || ""

  const [otp, setOtp] = useState(["", "", "", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [timeLeft, setTimeLeft] = useState(300)
  const [canResend, setCanResend] = useState(false)
  const [shake, setShake] = useState(false)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (timeLeft <= 0) { setCanResend(true); return }
    const timer = setInterval(() => setTimeLeft((p) => p - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft])

  function formatTime(s: number) {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
  }

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const next = [...otp]
    next[index] = value.slice(-1)
    setOtp(next)
    setError("")
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus()
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (paste.length === 6) { setOtp(paste.split("")); inputRefs.current[5]?.focus() }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = otp.join("")
    if (code.length !== 6) { setError("Please enter all 6 digits"); return }
    setIsLoading(true)
    try {
      const data = await verifyOTP(email, code)
      if (data.message === "Already verified") {
        if (!data.user.businessConstitution) {
          navigate("/auth/onboarding")
        } else {
          toast.success("Already verified")
          navigate("/dashboard")
        }
        return
      }
      toast.success("Email verified successfully")
      setTimeout(() => {
        if (!data.user.businessConstitution) {
          navigate("/auth/onboarding")
        } else {
          navigate("/dashboard")
        }
      }, 1500)
    } catch (err: any) {
      setError(err.message || "An error occurred")
      setOtp(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
      setShake(true)
      setTimeout(() => setShake(false), 600)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResend() {
    try {
      await resendOTP(email)
      toast.success("New OTP sent!")
      setTimeLeft(300); setCanResend(false); setOtp(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
    } catch {
      toast.error("Failed to resend OTP")
    }
  }

  return (
    <div
      className="min-h-screen bg-[#050A14] flex items-center justify-center px-4"
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
            <img src="/logoo.png" alt="FinRatio" className="h-12 w-auto" />
            <span className="text-[10px] font-['Geist_Mono'] bg-[#2563EB]/20 text-[#2563EB] border border-[#2563EB]/30 rounded px-1.5 py-0.5 leading-none">β</span>
          </Link>
        </div>

        <div className="bg-[#0D1726] border border-white/8 rounded-2xl p-8">
          {/* Icon + heading */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-[#2563EB]/10 border border-[#2563EB]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-[#2563EB]" />
            </div>
            <h2 className="text-lg font-medium text-white mb-1">Verify your email</h2>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Enter the 6-digit code sent to
              <br />
              <span className="text-[#F1F5F9] font-['Geist_Mono']">{email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* OTP inputs */}
            <div
              className={`flex justify-center gap-2.5 transition-all ${shake ? "animate-bounce" : ""}`}
              onPaste={handlePaste}
              style={shake ? { animation: "shake 0.4s ease" } : {}}
            >
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className={`w-11 h-12 text-center text-lg font-['Geist_Mono'] font-medium bg-[#050A14] border rounded-xl text-[#F1F5F9] focus:outline-none transition-all ${
                    error
                      ? "border-[#ef4444]/50 text-[#ef4444]"
                      : digit
                      ? "border-[#2563EB]/60 text-white"
                      : "border-white/10 focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20"
                  }`}
                />
              ))}
            </div>

            {error && (
              <div className="bg-[#ef4444]/8 border border-[#ef4444]/25 text-[#ef4444] px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <div className="text-center text-sm text-[#64748B]">
              {canResend ? (
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-[#2563EB] hover:text-white transition-colors font-medium"
                >
                  Resend OTP
                </button>
              ) : (
                <span>
                  Code expires in{" "}
                  <span className="font-['Geist_Mono'] text-[#F1F5F9]">{formatTime(timeLeft)}</span>
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-colors"
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

          <div className="mt-6 p-4 bg-white/3 border border-white/8 rounded-xl">
            <p className="text-xs font-['Geist_Mono'] text-[#64748B] uppercase tracking-widest mb-1">Security Notice</p>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Do not share this code with anyone. FinRatio will never ask for your OTP.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
