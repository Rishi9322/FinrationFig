import { useState, ReactNode } from "react"
import { Link } from "react-router"
import { ChevronLeft, PlayCircle, X } from "lucide-react"

interface CalculatorShellProps {
  title: string
  description: string
  explainerText?: string
  children: ReactNode
  result?: ReactNode
}

export function CalculatorShell({ title, description, explainerText, children, result }: CalculatorShellProps) {
  const [videoOpen, setVideoOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#050A14] py-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Breadcrumb + Title */}
        <div className="mb-6">
          <Link
            to="/calculators"
            className="inline-flex items-center text-sm text-[#64748B] hover:text-[#2563EB] transition-colors mb-4 group"
          >
            <ChevronLeft className="h-4 w-4 mr-1 transition-transform group-hover:-translate-x-0.5" />
            All Calculators
          </Link>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-['Geist_Mono'] text-[#64748B]">calculators</span>
            <span className="text-[#64748B]/40">/</span>
            <span className="text-xs font-['Geist_Mono'] text-[#2563EB]">{title.toLowerCase().replace(/\s+/g, "-")}</span>
          </div>
          <h1
            className="text-3xl font-normal text-white"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            {title}
          </h1>
        </div>

        {/* Explainer card */}
        <div className="bg-[#0D1726] border border-white/8 rounded-xl mb-6 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Left — What is this? */}
            <div className="p-6 md:p-8 flex flex-col justify-center md:border-r border-white/8">
              <p className="text-xs font-['Geist_Mono'] text-[#2563EB] uppercase tracking-widest mb-3">
                What is this calculator?
              </p>
              <p className="text-[#64748B] text-sm leading-relaxed">
                {explainerText || description}
              </p>
            </div>

            {/* Right — Video placeholder */}
            <div className="relative min-h-[200px] md:min-h-0 bg-[#070e1c] flex flex-col items-center justify-center gap-3 cursor-pointer group"
              onClick={() => setVideoOpen(true)}
            >
              {/* Subtle grid */}
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />

              {/* Play button ring */}
              <div className="relative z-10 flex flex-col items-center gap-3">
                <div className="relative">
                  {/* Outer pulse ring */}
                  <div className="absolute inset-0 rounded-full bg-[#2563EB]/20 scale-125 group-hover:scale-150 transition-transform duration-500" />
                  <div className="w-14 h-14 rounded-full border-2 border-[#2563EB]/60 group-hover:border-[#2563EB] bg-[#2563EB]/10 group-hover:bg-[#2563EB]/20 flex items-center justify-center transition-all duration-200 relative z-10">
                    <PlayCircle className="w-7 h-7 text-[#2563EB] fill-[#2563EB]/20" />
                  </div>
                </div>
                <span className="text-sm text-[#64748B] group-hover:text-[#F1F5F9] transition-colors font-medium">
                  Watch Explainer Video
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Video modal */}
        {videoOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#050A14]/90 backdrop-blur-md p-4"
            onClick={() => setVideoOpen(false)}
          >
            <div
              className="relative w-full max-w-3xl bg-[#0D1726] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <div>
                  <p className="text-sm font-medium text-white">{title} — Explainer</p>
                  <p className="text-xs text-[#64748B] mt-0.5">Video coming soon</p>
                </div>
                <button
                  onClick={() => setVideoOpen(false)}
                  className="p-2 rounded-lg text-[#64748B] hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* 16:9 placeholder */}
              <div className="relative aspect-video bg-[#070e1c] flex flex-col items-center justify-center gap-4">
                <div
                  className="absolute inset-0 opacity-[0.035] pointer-events-none"
                  style={{
                    backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                    position: "absolute",
                  }}
                />
                <div className="w-16 h-16 rounded-full border-2 border-[#2563EB]/40 bg-[#2563EB]/8 flex items-center justify-center">
                  <PlayCircle className="w-8 h-8 text-[#2563EB]/60" />
                </div>
                <p className="text-sm text-[#64748B] text-center px-8">
                  Explainer video for <span className="text-[#F1F5F9]">{title}</span> will appear here.
                  <br />
                  <span className="text-xs text-[#64748B]/70 mt-1 block">Upload a video URL to enable playback.</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Two-column input / result layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input panel */}
          <div className="bg-[#0D1726] rounded-xl border border-white/8 p-6">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-white/8">
              <div className="w-1.5 h-5 rounded-full bg-[#2563EB]" />
              <h2 className="text-sm font-medium text-white">Input Values</h2>
            </div>
            {children}
          </div>

          {/* Result panel */}
          {result && (
            <div className="transition-all duration-300">
              {result}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
