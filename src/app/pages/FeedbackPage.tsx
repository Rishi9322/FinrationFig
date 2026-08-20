import { useState } from "react"
import { MessageSquarePlus, Star, Loader2 } from "lucide-react"
import { submitFeedback, FeedbackType } from "../../lib/feedback"
import { toast } from "sonner"

const TYPES: { value: FeedbackType; label: string }[] = [
  { value: "REVIEW", label: "Review" },
  { value: "FEATURE_REQUEST", label: "Feature Request" },
  { value: "BUG", label: "Bug Report" },
]

export default function FeedbackPage() {
  const [type, setType] = useState<FeedbackType>("REVIEW")
  const [message, setMessage] = useState("")
  const [rating, setRating] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) {
      toast.error("Please write a message")
      return
    }
    setIsSubmitting(true)
    try {
      await submitFeedback({ type, message: message.trim(), rating: type === "REVIEW" && rating > 0 ? rating : undefined })
      setSubmitted(true)
      setMessage("")
      setRating(0)
      toast.success("Thanks for the feedback!")
    } catch (err) {
      toast.error((err as Error).message || "Failed to submit feedback")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050A14] py-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-normal text-white mb-2" style={{ fontFamily: "'Instrument Serif', serif" }}>
          Feedback
        </h1>
        <p className="text-sm text-[#94A3B8] mb-6">
          Leave a review or request a feature — an admin reads every submission.
        </p>

        <div className="bg-[#0D1726] border border-white/8 rounded-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex-1 text-sm px-3 py-2.5 rounded-lg border transition-colors ${
                    type === t.value
                      ? "bg-[#2563EB]/15 border-[#2563EB]/40 text-white"
                      : "bg-[#050A14] border-white/10 text-[#94A3B8] hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {type === "REVIEW" && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#F1F5F9]">Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      aria-label={`${star} star${star > 1 ? "s" : ""}`}
                      className="p-1"
                    >
                      <Star
                        className={`w-6 h-6 transition-colors ${
                          star <= rating ? "fill-[#f59e0b] text-[#f59e0b]" : "text-[#94A3B8]/40"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="message" className="block text-sm font-medium text-[#F1F5F9]">
                {type === "REVIEW" ? "Your review" : type === "FEATURE_REQUEST" ? "What would you like to see?" : "What went wrong?"}
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                maxLength={4000}
                placeholder={
                  type === "REVIEW"
                    ? "Tell us what's working well or what could be better..."
                    : type === "FEATURE_REQUEST"
                      ? "Describe the feature and the problem it solves..."
                      : "Steps to reproduce, what you expected, what happened..."
                }
                className="w-full px-4 py-3 bg-[#050A14] border border-white/10 rounded-lg text-[#F1F5F9] text-sm placeholder:text-[#94A3B8]/50 focus:outline-none focus:border-[#2563EB]/60 focus:ring-1 focus:ring-[#2563EB]/20 transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <MessageSquarePlus className="h-4 w-4" />
                  Submit
                </>
              )}
            </button>

            {submitted && (
              <p className="text-xs text-[#22C55E] text-center">Submitted — thank you.</p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
