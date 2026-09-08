import { Link } from "react-router"
import { ThemeToggle } from "../../components/ThemeToggle"

// Password reset is handled entirely by Firebase: "Forgot password" emails a
// secure link that opens Firebase's own reset page. This route only exists so an
// old bookmarked URL lands somewhere sensible.
export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <ThemeToggle className="fixed top-4 right-4 z-10" />
      <div className="fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.09) 0%, transparent 65%)" }} />
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src="/logoo.png" alt="FinRatio" className="h-14 w-auto sm:h-16" />
          </Link>
          <p className="text-sm text-muted-foreground mt-3">Reset your password</p>
        </div>
        <div className="bg-card border border-foreground/8 rounded-2xl p-8 text-center space-y-4">
          <p className="text-sm text-foreground">
            Use the reset link we email you - it opens a secure page to set a new
            password. Didn't get it?
          </p>
          <Link
            to="/auth/forgot-password"
            className="inline-block w-full bg-primary hover:bg-primary-hover text-white py-3 rounded-xl text-sm font-medium transition-colors"
          >
            Send a reset link
          </Link>
          <p className="text-sm text-muted-foreground">
            Back to{" "}
            <Link to="/auth/signin" className="text-link hover:text-foreground transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
