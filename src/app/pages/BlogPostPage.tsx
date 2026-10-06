import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import ReactMarkdown from "react-markdown"
import { toast } from "sonner"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { getPostBySlug, BlogPost } from "../../lib/blog"
import { Skeleton } from "../components/ui/skeleton"

// The typography plugin isn't installed, so the article body is styled here.
const ARTICLE_STYLES = [
  "text-[15px] sm:text-base leading-7 text-foreground/90 break-words",
  "[&_h2]:font-['Instrument_Serif'] [&_h2]:text-2xl [&_h2]:text-foreground [&_h2]:mt-9 [&_h2]:mb-3 [&_h2]:font-normal",
  "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2",
  "[&_p]:my-4 [&_strong]:text-foreground [&_a]:text-link [&_a]:underline-offset-2 [&_a:hover]:underline",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1.5 [&_li]:pl-1",
  "[&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:bg-primary/5 [&_blockquote]:rounded-r-lg [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:my-5",
  "[&_code]:rounded [&_code]:bg-foreground/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em]",
  "[&_table]:block [&_table]:overflow-x-auto [&_table]:my-5 [&_th]:text-left [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2 [&_td]:border-t [&_td]:border-foreground/10",
  "[&>*:first-child]:mt-0",
].join(" ")

function PostSkeleton() {
  return (
    <div role="status" aria-label="Loading article" className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="bg-foreground/10 h-9 w-11/12" />
        <Skeleton className="bg-foreground/10 h-9 w-2/3" />
        <Skeleton className="bg-foreground/10 h-4 w-48" />
      </div>
      <div className="rounded-2xl border border-foreground/8 bg-card p-5 sm:p-8 space-y-3">
        {[100, 96, 92, 100, 88, 60].map((w, i) => (
          <Skeleton key={i} className="bg-foreground/10 h-4" style={{ width: `${w}%` }} />
        ))}
        <Skeleton className="bg-foreground/10 h-6 w-1/3 mt-6" />
        {[100, 94, 98, 70].map((w, i) => (
          <Skeleton key={i} className="bg-foreground/10 h-4" style={{ width: `${w}%` }} />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<BlogPost | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    setIsLoading(true)
    getPostBySlug(slug)
      .then(setPost)
      .catch((err) => toast.error(err.message || "Post not found"))
      .finally(() => setIsLoading(false))
  }, [slug])

  return (
    <main className="min-h-screen bg-background py-6 sm:py-10" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 min-h-10 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Blog
        </Link>

        {isLoading ? (
          <PostSkeleton />
        ) : !post ? (
          <p className="text-sm text-muted-foreground">Post not found.</p>
        ) : (
          <article className="animate-in fade-in duration-300">
            <header className="mb-6">
              <h1 className="text-3xl sm:text-4xl font-normal text-foreground leading-tight mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{post.authorName}</span>
                <span aria-hidden>·</span>
                <time dateTime={post.createdAt}>
                  {new Date(post.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </time>
              </div>
            </header>

            {post.sourceName && (
              <aside className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 mb-6 text-sm text-muted-foreground leading-relaxed">
                Based on content from <span className="text-foreground font-medium">{post.sourceName}</span>.{" "}
                {post.sourceUrl && (
                  <a
                    href={post.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1 text-link hover:underline whitespace-nowrap"
                  >
                    Read the original <ExternalLink className="h-3 w-3" />
                  </a>
                )}{" "}
                This is FinRatio's own summary for Indian MSME readers; all rights remain with the original author or publisher.
              </aside>
            )}

            <div className="rounded-2xl border border-foreground/8 bg-card p-5 sm:p-8 shadow-sm">
              <div className={ARTICLE_STYLES}>
                <ReactMarkdown>{post.content}</ReactMarkdown>
              </div>
            </div>
          </article>
        )}
      </div>
    </main>
  )
}
