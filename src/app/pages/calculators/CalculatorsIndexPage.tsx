import { Link } from "react-router"
import { CALCULATORS } from "../../../lib/calculatorConfig"
import * as Icons from "lucide-react"
import { ArrowRight } from "lucide-react"

// Every calculator is available to any signed-in user; only the CMA engine and
// document parser are granted per user, and neither is listed here.
export default function CalculatorsIndexPage() {
  return (
    <div className="min-h-screen bg-[#050A14] py-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <p className="text-xs font-['Geist_Mono'] text-[#60A5FA] uppercase tracking-widest mb-2">Suite</p>
          <h1
            className="text-3xl font-normal text-white"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Financial Calculators
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1.5 max-w-lg leading-relaxed">
            Professional-grade ratio calculators for Indian SME credit assessment and business analysis
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CALCULATORS.map((calculator, i) => {
            const Icon = Icons[calculator.icon as keyof typeof Icons] as React.ComponentType<{ className?: string }>
            return (
              <Link key={calculator.id} to={calculator.path} className="group">
              <div className="bg-[#0D1726] border border-white/8 rounded-xl p-6 h-full transition-all hover:border-[#2563EB]/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#2563EB]/5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {Icon && (
                      <div className="p-2 border rounded-lg bg-[#2563EB]/10 border-[#2563EB]/20 text-[#60A5FA]">
                        <Icon className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <span className="font-['Geist_Mono'] text-[10px] text-[#60A5FA]/50">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>

                <h2 className="font-medium mb-2 transition-colors text-base text-white group-hover:text-[#60A5FA]">
                  {calculator.name}
                </h2>
                <p className="text-xs text-[#94A3B8] leading-relaxed mb-5">{calculator.description}</p>

                <div className="flex items-center text-xs text-[#60A5FA] font-medium group-hover:gap-2 gap-1.5 transition-all">
                  Open Calculator
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
