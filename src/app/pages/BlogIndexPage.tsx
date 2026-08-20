import { useEffect, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { listPublishedPosts, BlogPost } from "../../lib/blog"

export default function BlogIndexPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    listPublishedPosts()
      .then(setPosts)
      .catch((err) => toast.error(err.message || "Failed to load posts"))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-[#050A14] py-10" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-normal text-white mb-2" style={{ fontFamily: "'Instrument Serif', serif" }}>
          FinRatio Blog
        </h1>
        <p className="text-sm text-[#94A3B8] mb-8">
          Financial insights for Indian MSMEs — credit, cash flow, and ratios that matter, curated from across the web with full credit to the original authors.
        </p>

        {isLoading ? (
          <p className="text-sm text-[#94A3B8]">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No posts yet — check back soon.</p>
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <Link
                key={p.id}
                to={`/blog/${p.slug}`}
                className="block bg-[#0D1726] border border-white/8 rounded-xl p-6 hover:border-[#2563EB]/40 transition-colors"
              >
                <h2 className="text-xl text-white mb-2" style={{ fontFamily: "'Instrument Serif', serif" }}>{p.title}</h2>
                <p className="text-sm text-[#94A3B8] leading-relaxed mb-3">{p.excerpt}</p>
                <div className="flex items-center gap-3 text-xs text-[#64748B]">
                  <span>{p.authorName}</span>
                  <span>·</span>
                  <span>{new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  {p.sourceName && (<><span>·</span><span>Curated from {p.sourceName}</span></>)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
