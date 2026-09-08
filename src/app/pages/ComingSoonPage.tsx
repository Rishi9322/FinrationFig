import React from "react"
import { Link } from "react-router"
import { Sparkles } from "lucide-react"

/**
 * Shown in place of a tool the current user has not been granted. It renders at
 * the requested URL rather than redirecting, so the address bar still reflects
 * what the user asked for.
 */
export default function ComingSoonPage({ title }: { title?: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-md w-full bg-card border border-foreground/8 rounded-2xl p-8 text-center">
        <div className="w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Sparkles className="h-7 w-7 text-link" />
        </div>
        <p className="text-xs font-['Geist_Mono'] text-link uppercase tracking-widest mb-2">
          Coming Soon
        </p>
        <h1 className="text-xl text-foreground font-medium mb-2">{title || "This tool is on the way"}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          We are putting the finishing touches on it. In the meantime, every calculator in the
          suite is available to you.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/calculators" className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm transition-colors">
            View Calculators
          </Link>
          <Link to="/dashboard" className="border border-foreground/15 hover:border-foreground/30 text-muted-foreground px-4 py-2 rounded-lg text-sm transition-colors">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
