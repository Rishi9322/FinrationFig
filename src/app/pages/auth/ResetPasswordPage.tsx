import { Link } from "react-router"

// Password reset is handled entirely by Firebase: "Forgot password" emails a
// secure link that opens Firebase's own reset page. This route only exists so an
// old bookmarked URL lands somewhere sensible.
export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#050A14] flex items-center justify-center px-4 py-12" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.09) 0%, transparent 65%)" }} />
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src="/logoo.png" alt="FinRatio" className="h-14 w-auto sm:h-16" />
          </Link>
          <p className="text-sm text-[#94A3B8] mt-3">Reset your password</p>
        </div>
        <div className="bg-[#0D1726] border border-white/8 rounded-2xl p-8 text-center space-y-4">
          <p className="text-sm text-[#F1F5F9]">
            Use the reset link we email you — it opens a secure page to set a new
            password. Didn't get it?
          </p>
          <Link
            to="/auth/forgot-password"
            className="inline-block w-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white py-3 rounded-xl text-sm font-medium transition-colors"
          >
            Send a reset link
          </Link>
          <p className="text-sm text-[#94A3B8]">
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
