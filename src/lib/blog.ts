import { apiCall } from "./apiSession"

export interface BlogPost {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  coverImageUrl: string | null
  sourceName: string | null
  sourceUrl: string | null
  published: boolean
  authorName: string
  createdAt: string
  updatedAt: string
}

export type BlogPostInput = {
  title: string
  excerpt: string
  content: string
  coverImageUrl?: string
  sourceName?: string
  sourceUrl?: string
  published?: boolean
}

export async function listPublishedPosts(): Promise<BlogPost[]> {
  const data = await apiCall("/blog")
  return data.posts || []
}

export async function getPostBySlug(slug: string): Promise<BlogPost> {
  const data = await apiCall(`/blog/${encodeURIComponent(slug)}`)
  return data.post
}

// Admin-only — the edge function enforces ADMIN/SUPER_ADMIN server-side.
export async function getAdminPosts(): Promise<BlogPost[]> {
  const data = await apiCall("/admin/blog")
  return data.posts || []
}

export async function createPost(input: BlogPostInput): Promise<BlogPost> {
  const data = await apiCall("/admin/blog", { method: "POST", body: JSON.stringify(input) })
  return data.post
}

export async function updatePost(id: string, input: Partial<BlogPostInput>): Promise<BlogPost> {
  const data = await apiCall(`/admin/blog/${id}`, { method: "PUT", body: JSON.stringify(input) })
  return data.post
}

export async function deletePost(id: string): Promise<void> {
  await apiCall(`/admin/blog/${id}`, { method: "DELETE" })
}
