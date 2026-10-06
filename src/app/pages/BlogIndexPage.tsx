import { useEffect, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { listPublishedPosts, BlogPost } from "../../lib/blog"
import { listApprovedNews, NewsItem } from "../../lib/news"
import { Skeleton } from "../components/ui/skeleton"

export default function BlogIndexPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [news, setNews] = useState<NewsItem[]>([])

  useEffect(() => {
    listApprovedNews().then(setNews).catch(() => { /* the news box is optional */ })
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
          Financial insights for Indian MSMEs - credit, cash flow, and ratios that matter, curated from across the web with full credit to the original authors.
        </p>

        {isLoading ? (
          <div role="status" aria-label="Loading posts" className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-card border border-foreground/8 rounded-xl p-5 sm:p-6 space-y-3">
                <Skeleton className="bg-foreground/10 h-6 w-3/4" />
                <Skeleton className="bg-foreground/10 h-4 w-full" />
                <Skeleton className="bg-foreground/10 h-4 w-5/6" />
                <Skeleton className="bg-foreground/10 h-3 w-40 mt-1" />
              </div>
            ))}
            <span className="sr-only">Loading…</span>
          </div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No posts yet - check back soon.</p>
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <Link
                key={p.id}
                to={`/blog/${p.slug}`}
                className="block bg-card border border-foreground/8 rounded-xl p-5 sm:p-6 hover:border-primary/40 transition-colors"
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

        {news.length > 0 && (
          <section className="mt-12" aria-labelledby="latest-web">
            <h2 id="latest-web" className="text-2xl font-normal text-foreground mb-1" style={{ fontFamily: "'Instrument Serif', serif" }}>
              Latest from the web
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Headlines selected by our team. Each link opens the original publisher; all rights remain with them.
            </p>
            <ul className="space-y-3">
              {news.map((n) => (
                <li key={n.id} className="bg-card border border-foreground/8 rounded-xl p-4">
                  <a href={n.url} target="_blank" rel="noopener noreferrer nofollow" className="text-foreground hover:text-primary">
                    {n.title}
                  </a>
                  {n.snippet && <p className="text-sm text-muted-foreground mt-1">{n.snippet}</p>}
                  <p className="text-xs text-muted-foreground mt-2">
                    {n.author ? `${n.author} · ` : ""}{n.sourceName}
                    {n.publishedAt ? ` · ${new Date(n.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}
