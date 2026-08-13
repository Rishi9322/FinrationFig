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
    <div className="min-h-screen bg-[#050A14] flex items-center justify-center px-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-md w-full bg-[#0D1726] border border-white/8 rounded-2xl p-8 text-center">
        <div className="w-14 h-14 bg-[#2563EB]/10 border border-[#2563EB]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Sparkles className="h-7 w-7 text-[#2563EB]" />
        </div>
        <p className="text-xs font-['Geist_Mono'] text-[#2563EB] uppercase tracking-widest mb-2">
          Coming Soon
        </p>
        <h1 className="text-xl text-white font-medium mb-2">{title || "This tool is on the way"}</h1>
        <p className="text-sm text-[#94A3B8] leading-relaxed mb-6">
          We are putting the finishing touches on it. In the meantime, every calculator in the
          suite is available to you.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/calculators" className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white px-4 py-2 rounded-lg text-sm transition-colors">
            View Calculators
          </Link>
          <Link to="/dashboard" className="border border-white/15 hover:border-white/30 text-[#cbd5e1] px-4 py-2 rounded-lg text-sm transition-colors">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
