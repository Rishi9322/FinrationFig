import { ReactNode } from "react"
import { Link } from "react-router"
import { ChevronLeft, PlayCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"

interface CalculatorShellProps {
  title: string
  description: string
  explainerText?: string
  videoUrl?: string
  children: ReactNode
  result?: ReactNode
}

export function CalculatorShell({ title, description, explainerText, videoUrl, children, result }: CalculatorShellProps) {

  return (
    <div className="min-h-screen bg-[#050A14] py-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Breadcrumb + Title */}
        <div className="mb-6">
          <Link
            to="/calculators"
            className="inline-flex items-center text-sm text-[#94A3B8] hover:text-[#60A5FA] transition-colors mb-4 group"
          >
            <ChevronLeft className="h-4 w-4 mr-1 transition-transform group-hover:-translate-x-0.5" />
            All Calculators
          </Link>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-['Geist_Mono'] text-[#94A3B8]">calculators</span>
            <span className="text-[#94A3B8]/40">/</span>
            <span className="text-xs font-['Geist_Mono'] text-[#60A5FA]">{title.toLowerCase().replace(/\s+/g, "-")}</span>
          </div>
          <h1
            className="text-3xl font-normal text-white"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            {title}
          </h1>
        </div>

        {/* Explainer card — the video half only exists when there is a video to play. */}
        <div className="bg-[#0D1726] border border-white/8 rounded-xl mb-6 overflow-hidden">
          <div className={`grid grid-cols-1 ${videoUrl ? "md:grid-cols-2" : ""}`}>
            <div className={`p-6 md:p-8 flex flex-col justify-center ${videoUrl ? "md:border-r border-white/8" : ""}`}>
              <p className="text-xs font-['Geist_Mono'] text-[#60A5FA] uppercase tracking-widest mb-3">
                What is this calculator?
              </p>
              <p className="text-[#94A3B8] text-sm leading-relaxed">
                {explainerText || description}
              </p>
            </div>

            {videoUrl && (
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    className="relative min-h-[200px] md:min-h-0 w-full bg-[#070e1c] flex flex-col items-center justify-center gap-3 cursor-pointer group"
                  >
                    {/* Subtle grid */}
                    <div
                      className="absolute inset-0 opacity-[0.04]"
                      style={{
                        backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
                        backgroundSize: "32px 32px",
                      }}
                    />

                    <div className="relative z-10 flex flex-col items-center gap-3">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-[#2563EB]/20 scale-125 group-hover:scale-150 transition-transform duration-500" />
                        <div className="w-14 h-14 rounded-full border-2 border-[#2563EB]/60 group-hover:border-[#2563EB] bg-[#2563EB]/10 group-hover:bg-[#2563EB]/20 flex items-center justify-center transition-all duration-200 relative z-10">
                          <PlayCircle className="w-7 h-7 text-[#60A5FA] fill-[#2563EB]/20" />
                        </div>
                      </div>
                      <span className="text-sm text-[#94A3B8] group-hover:text-[#F1F5F9] transition-colors font-medium">
                        Watch Explainer Video
                      </span>
                    </div>
                  </button>
                </DialogTrigger>

                <DialogContent className="max-w-3xl bg-[#0D1726] border-white/10 p-0 gap-0 overflow-hidden">
                  <DialogHeader className="px-5 py-4 border-b border-white/8 text-left">
                    <DialogTitle className="text-sm font-medium text-white">{title} — Explainer</DialogTitle>
                  </DialogHeader>
                  <video src={videoUrl} controls autoPlay className="w-full aspect-video bg-[#070e1c]" />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

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
