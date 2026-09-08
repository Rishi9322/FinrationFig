import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { toast } from "sonner"
import { ENABLED_OAUTH_PROVIDERS, signInWithOAuth, type OAuthProvider } from "../../../lib/auth"

// One button per enabled provider. A successful Google popup resolves in-page
// (no redirect), so we navigate to the app ourselves once it completes.
export function OAuthButtons() {
  const [pending, setPending] = useState<OAuthProvider | null>(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get("redirect") || "/dashboard"

  async function handle(provider: OAuthProvider) {
    setPending(provider)
    try {
      await signInWithOAuth(provider)
      navigate(redirect)
    } catch (err: any) {
      toast.error(err.message || "Sign-in failed")
      setPending(null)
    }
  }

  if (ENABLED_OAUTH_PROVIDERS.length === 0) return null

  return (
    <div className="space-y-2">
      {ENABLED_OAUTH_PROVIDERS.map(({ provider, label }) => (
        <button
          key={provider}
          type="button"
          onClick={() => handle(provider)}
          disabled={pending !== null}
          className="w-full flex items-center justify-center gap-2 bg-background border border-foreground/10 hover:border-primary/60 disabled:opacity-60 text-foreground py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {pending === provider ? "Redirecting..." : `Continue with ${label}`}
        </button>
      ))}
    </div>
  )
}
