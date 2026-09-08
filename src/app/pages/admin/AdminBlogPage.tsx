import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, X } from "lucide-react"
import { getAdminPosts, createPost, updatePost, deletePost, BlogPost, BlogPostInput } from "../../../lib/blog"

const EMPTY: BlogPostInput = { title: "", excerpt: "", content: "", coverImageUrl: "", sourceName: "", sourceUrl: "", published: false }

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<BlogPost | null>(null)
  const [form, setForm] = useState<BlogPostInput>(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  function load() {
    setIsLoading(true)
    getAdminPosts().then(setPosts).catch((err) => toast.error(err.message || "Failed to load posts")).finally(() => setIsLoading(false))
  }
  useEffect(load, [])

  function openNew() {
    setEditing(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  function openEdit(p: BlogPost) {
    setEditing(p)
    setForm({
      title: p.title, excerpt: p.excerpt, content: p.content,
      coverImageUrl: p.coverImageUrl ?? "", sourceName: p.sourceName ?? "", sourceUrl: p.sourceUrl ?? "",
      published: p.published,
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.excerpt.trim() || !form.content.trim()) {
      toast.error("Title, excerpt and content are required")
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updatePost(editing.id, form)
        toast.success("Post updated")
      } else {
        await createPost(form)
        toast.success("Post created")
      }
      setShowForm(false)
      load()
    } catch (err: any) {
      toast.error(err.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(p: BlogPost) {
    if (!confirm(`Delete "${p.title}"?`)) return
    try {
      await deletePost(p.id)
      toast.success("Post deleted")
      load()
    } catch (err: any) {
      toast.error(err.message || "Delete failed")
    }
  }

  async function togglePublish(p: BlogPost) {
    try {
      await updatePost(p.id, { published: !p.published })
      load()
    } catch (err: any) {
      toast.error(err.message || "Update failed")
    }
  }

  return (
    <main className="min-h-screen bg-background py-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-3xl font-normal text-foreground" style={{ fontFamily: "'Instrument Serif', serif" }}>Blog Posts</h1>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Post
          </button>
        </div>

        {showForm && (
          <div className="bg-card border border-foreground/10 rounded-xl p-5 mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">{editing ? "Edit Post" : "New Post"}</h2>
              <button onClick={() => setShowForm(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Title"
              className="w-full bg-background border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <textarea
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              placeholder="Short excerpt (shown on the blog index)"
              rows={2}
              className="w-full bg-background border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Content (Markdown supported)"
              rows={10}
              className="w-full bg-background border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground font-mono"
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                value={form.sourceName}
                onChange={(e) => setForm({ ...form, sourceName: e.target.value })}
                placeholder="Source name (credit, e.g. Livemint) - leave blank if original"
                className="w-full bg-background border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <input
                value={form.sourceUrl}
                onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
                placeholder="Source URL"
                className="w-full bg-background border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={!!form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
              Published (visible on /blog)
            </label>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <div key={p.id} className="bg-card border border-foreground/8 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{p.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${p.published ? "bg-emerald-500/15 text-emerald-400" : "bg-foreground/5 text-muted-foreground"}`}>
                      {p.published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{p.authorName} · {new Date(p.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => togglePublish(p)} className="text-xs px-2.5 py-1.5 rounded-lg border border-foreground/10 text-muted-foreground hover:text-foreground">
                    {p.published ? "Unpublish" : "Publish"}
                  </button>
                  <button onClick={() => openEdit(p)} aria-label={`Edit ${p.title}`} className="p-1.5 text-muted-foreground hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(p)} aria-label={`Delete ${p.title}`} className="p-1.5 text-muted-foreground hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
