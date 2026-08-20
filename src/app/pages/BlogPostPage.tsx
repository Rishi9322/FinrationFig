import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import ReactMarkdown from "react-markdown"
import { toast } from "sonner"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { getPostBySlug, BlogPost } from "../../lib/blog"

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<BlogPost | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    getPostBySlug(slug)
      .then(setPost)
      .catch((err) => toast.error(err.message || "Post not found"))
      .finally(() => setIsLoading(false))
  }, [slug])

  return (
    <main className="min-h-screen bg-[#050A14] py-10" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-[#94A3B8] hover:text-white mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Blog
        </Link>

        {isLoading ? (
          <p className="text-sm text-[#94A3B8]">Loading…</p>
        ) : !post ? (
          <p className="text-sm text-[#94A3B8]">Post not found.</p>
        ) : (
          <article>
            <h1 className="text-3xl sm:text-4xl font-normal text-white mb-3" style={{ fontFamily: "'Instrument Serif', serif" }}>
              {post.title}
            </h1>
            <div className="flex items-center gap-3 text-xs text-[#64748B] mb-8">
              <span>{post.authorName}</span>
              <span>·</span>
              <span>{new Date(post.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>

            {post.sourceName && (
              <div className="bg-[#0D1726] border border-white/8 rounded-lg px-4 py-3 mb-8 text-sm text-[#94A3B8]">
                Originally published by <span className="text-white">{post.sourceName}</span>
                {post.sourceUrl && (
                  <a href={post.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 ml-2 text-[#60A5FA] hover:underline">
                    Read the original <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                . Reproduced here with credit for FinRatio's Indian MSME audience.
              </div>
            )}

            <div className="prose prose-invert prose-sm sm:prose-base max-w-none text-[#E2E8F0] leading-relaxed [&_a]:text-[#60A5FA] [&_h2]:text-white [&_h3]:text-white">
              <ReactMarkdown>{post.content}</ReactMarkdown>
            </div>
          </article>
        )}
      </div>
    </main>
  )
}
