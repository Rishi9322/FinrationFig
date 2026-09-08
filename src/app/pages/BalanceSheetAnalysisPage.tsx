import React from "react"
import BalanceSheetUpload from "@/app/components/BalanceSheetUpload"
import { useAuth } from "@/app/hooks/useAuth"

const STEPS = [
  { label: "Upload", detail: "Drop a file - any format" },
  { label: "Auto-parse & map", detail: "Extracted and mapped for you" },
  { label: "Review & save", detail: "Adjust if needed, then save" },
]

export default function BalanceSheetAnalysisPage() {
  const { user } = useAuth()
  const userId = user?.id

  return (
    <div className="min-h-screen bg-background py-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <h1 className="text-3xl font-normal text-foreground mb-2" style={{ fontFamily: "'Instrument Serif', serif" }}>
            Balance Sheet Analysis
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Upload a balance sheet in any format - the calculator, mapping and result all update automatically.
          </p>
        </div>

        {/* Three-step strip - replaces the old wall of "how it works" / "features" cards */}
        <div className="flex items-center gap-2 text-xs font-['Geist_Mono'] text-muted-foreground">
          {STEPS.map((step, i) => (
            <React.Fragment key={step.label}>
              {i > 0 && <span className="text-muted-foreground/30">→</span>}
              <span title={step.detail} className="uppercase tracking-wider">
                {step.label}
              </span>
            </React.Fragment>
          ))}
        </div>

        <BalanceSheetUpload userId={userId} />
      </div>
    </div>
  )
}
