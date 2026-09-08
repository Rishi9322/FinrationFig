import { useEffect, useState } from "react"
import { toast } from "sonner"
import { getAdminFeedback, FeedbackEntry } from "../../../lib/feedback"

const TYPE_LABEL: Record<string, string> = {
  REVIEW: "Review",
  FEATURE_REQUEST: "Feature Request",
  BUG: "Bug Report",
}

export default function AdminFeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<string>("ALL")

  useEffect(() => {
    getAdminFeedback()
      .then(setFeedback)
      .catch((err) => toast.error(err.message || "Failed to load feedback"))
      .finally(() => setIsLoading(false))
  }, [])

  const visible = filter === "ALL" ? feedback : feedback.filter((f) => f.type === filter)

  return (
    <div className="min-h-screen bg-background py-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-3xl font-normal text-foreground" style={{ fontFamily: "'Instrument Serif', serif" }}>
            User Feedback
          </h1>
          <div className="flex gap-1.5">
            {["ALL", "REVIEW", "FEATURE_REQUEST", "BUG"].map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  filter === t
                    ? "bg-primary/15 border-primary/40 text-white"
                    : "bg-card border-foreground/10 text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "ALL" ? "All" : TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No feedback yet.</p>
        ) : (
          <div className="space-y-3">
            {visible.map((f) => (
              <div key={f.id} className="bg-card border border-foreground/8 rounded-xl p-5">
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-foreground/5 text-muted-foreground">
                      {TYPE_LABEL[f.type] ?? f.type}
                    </span>
                    {f.rating && (
                      <span className="text-xs text-warning">{"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(f.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{f.message}</p>
                <p className="text-xs text-muted-foreground mt-2">{f.userEmail}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
