import { useState } from "react"
import { toast } from "sonner"
import { ENABLED_OAUTH_PROVIDERS, signInWithOAuth, type OAuthProvider } from "../../../lib/auth"

// Renders one button per provider enabled in the Supabase dashboard. The click
// hands off to the provider and returns to /dashboard with a session in the URL.
export function OAuthButtons() {
  const [pending, setPending] = useState<OAuthProvider | null>(null)

  async function handle(provider: OAuthProvider) {
    setPending(provider)
    try {
      await signInWithOAuth(provider)
      // Redirect happens; nothing else to do on success.
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
          className="w-full flex items-center justify-center gap-2 bg-[#050A14] border border-white/10 hover:border-[#2563EB]/60 disabled:opacity-60 text-[#F1F5F9] py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {pending === provider ? "Redirecting..." : `Continue with ${label}`}
        </button>
      ))}
    </div>
  )
}
