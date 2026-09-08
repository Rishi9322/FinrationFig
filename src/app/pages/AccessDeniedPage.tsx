import React from "react"
import { Link } from "react-router"
import { Lock } from "lucide-react"

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-md w-full bg-card border border-foreground/8 rounded-2xl p-8 text-center">
        <div className="w-14 h-14 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-xl text-foreground font-medium mb-2">Access Restricted</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          You do not have permission to access this section. Contact your administrator to request access.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/dashboard" className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm transition-colors">
            Go to Dashboard
          </Link>
          <Link to="/calculators" className="border border-foreground/15 hover:border-foreground/30 text-muted-foreground px-4 py-2 rounded-lg text-sm transition-colors">
            View Calculators
          </Link>
        </div>
      </div>
    </div>
  )
}
