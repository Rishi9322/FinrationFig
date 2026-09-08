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
    <main className="min-h-screen bg-background py-10" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-normal text-foreground mb-2" style={{ fontFamily: "'Instrument Serif', serif" }}>
          FinRatio Blog
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Financial insights for Indian MSMEs — credit, cash flow, and ratios that matter, curated from across the web with full credit to the original authors.
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No posts yet — check back soon.</p>
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <Link
                key={p.id}
                to={`/blog/${p.slug}`}
                className="block bg-card border border-foreground/8 rounded-xl p-6 hover:border-primary/40 transition-colors"
              >
                <h2 className="text-xl text-foreground mb-2" style={{ fontFamily: "'Instrument Serif', serif" }}>{p.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">{p.excerpt}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
