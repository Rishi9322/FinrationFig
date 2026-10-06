// Live news feed: turn RSS/Atom/GDELT responses into rows for the review queue.
// Pure functions (no I/O) so vitest can drive them with real feed samples.
//
// What is stored is deliberately small: a headline, an optional short snippet, the link
// back, and the credit (author + source). Never the article body.

export interface NewsSource {
  id: string
  name: string
  kind: "rss" | "gdelt"
  url: string
  enabled: boolean
  /** "headline" stores no snippet at all - for sources whose terms only tolerate a link. */
  display: "headline" | "snippet"
  includeTerms: string[]
  excludeTerms: string[]
  maxAgeDays: number
}

export interface RawItem {
  title: string
  url: string
  author?: string
  publishedAt?: string
  snippet?: string
}

export interface NewsRow {
  source_id: string
  title: string
  url: string
  author: string | null
  published_at: string | null
  snippet: string | null
}

export const MAX_TITLE = 200
export const MAX_SNIPPET = 200
export const MAX_NEW_PER_SOURCE = 60

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"',
  ndash: "-", mdash: "-", hellip: "...", rupee: "Rs",
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ""
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** Markup and entities -> plain text on one line. Safe to render: no tags survive. */
export function stripHtml(html: string): string {
  // Bound the input first: the tag regexes rescan on unclosed '<', so a huge malformed field would be slow.
  return decodeEntities(
    html.slice(0, 20_000)
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/<[^>]*>/g, " ") // entities such as &lt;b&gt; decode into tags; strip those too
    .replace(/\s+/g, " ")
    .trim()
}

/** Cut at a word boundary and add an ellipsis. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, "")}…`
}

const TRACKING = /^(utm_[a-z]+|fbclid|gclid|mc_cid|mc_eid|ref|ref_src|source|igshid|spm)$/i

/** http(s) only, tracking parameters and fragment removed. null if it isn't a usable link. */
export function cleanUrl(raw: string): string | null {
  let u: URL
  try { u = new URL(raw.trim()) } catch { return null }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null
  if (u.username || u.password) return null
  u.hash = ""
  for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key)
  const out = u.toString().replace(/\?$/, "")
  return out.length <= 2000 ? out : null
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))
  return m ? m[1].trim() : ""
}

/** RSS 2.0 and Atom -> items. Tolerant: one malformed entry never loses the rest. */
export function parseFeed(xml: string): RawItem[] {
  const items: RawItem[] = []
  const blocks = xml.split(/<item[\s>]|<entry[\s>]/i).slice(1)
  for (const block of blocks) {
    const title = stripHtml(tag(block, "title"))
    let link = stripHtml(tag(block, "link"))
    if (!link) {
      // Atom: <link rel="alternate" href="..."/> (prefer alternate, else first)
      // Judge each <link> tag on its own, in any attribute order; skip self/replies/enclosure.
      for (const t of block.match(/<link\b[^>]*>/gi) ?? []) {
        const href = t.match(/href=["']([^"']+)["']/i)?.[1]
        const rel = t.match(/rel=["']([^"']+)["']/i)?.[1]?.toLowerCase()
        if (href && (!rel || rel === "alternate")) { link = decodeEntities(href); break }
      }
    }
    if (!link) link = stripHtml(tag(block, "guid"))
    const author = stripHtml(tag(block, "dc:creator") || tag(block, "author") || tag(block, "name"))
    const published = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || tag(block, "dc:date")
    const snippet = stripHtml(tag(block, "description") || tag(block, "summary") || "")
    items.push({
      title,
      url: link,
      author: author || undefined,
      publishedAt: published ? stripHtml(published) : undefined,
      snippet: snippet || undefined,
    })
  }
  return items
}

/** GDELT tokenises punctuation ("5 . 65 %", "RBI , SEBI"); put it back together. */
export function tidyTitle(t: string): string {
  return t.replace(/\s+([,.;:!?%)])/g, "$1").replace(/(\d)\.\s(\d)/g, "$1.$2").replace(/\(\s+/g, "(")
}

/** GDELT DOC 2.0 "artlist" JSON -> items. Titles and links only (that is all GDELT provides). */
export function parseGdelt(data: unknown): RawItem[] {
  const articles = (data as { articles?: unknown })?.articles
  if (!Array.isArray(articles)) return []
  return articles.flatMap((a: any) => {
    if (!a || typeof a.url !== "string" || typeof a.title !== "string") return []
    // seendate looks like 20261005T093000Z
    const m = typeof a.seendate === "string" ? a.seendate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/) : null
    return [{
      title: tidyTitle(a.title),
      url: a.url,
      author: typeof a.domain === "string" ? a.domain : undefined,
      publishedAt: m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : undefined,
    }]
  })
}

function termRegex(term: string): RegExp {
  const esc = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(/^\w/.test(term) && /\w$/.test(term) ? `\\b${esc}\\b` : esc, "i")
}

/** True if text contains any include term (or include is empty) and no exclude term. */
export function matchesTerms(text: string, include: string[], exclude: string[]): boolean {
  if (exclude.some((t) => t.trim() && termRegex(t).test(text))) return false
  const inc = include.filter((t) => t.trim())
  return inc.length === 0 || inc.some((t) => termRegex(t).test(text))
}

export function parseDate(value?: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Raw items -> clean, filtered, de-duplicated rows for one source. */
export function toRows(source: NewsSource, raw: RawItem[], now: Date = new Date()): NewsRow[] {
  const seen = new Set<string>()
  const rows: NewsRow[] = []
  const oldest = now.getTime() - source.maxAgeDays * 86_400_000

  for (const it of raw) {
    const url = cleanUrl(it.url ?? "")
    const title = truncate(stripHtml(it.title ?? ""), MAX_TITLE)
    if (!url || !title || seen.has(url)) continue

    const published = parseDate(it.publishedAt)
    if (published && new Date(published).getTime() < oldest) continue // stale
    if (new Date(published ?? now).getTime() > now.getTime() + 86_400_000) continue // dated in the future

    const snippetText = it.snippet ? stripHtml(it.snippet) : ""
    if (!matchesTerms(`${title} ${snippetText}`, source.includeTerms, source.excludeTerms)) continue

    seen.add(url)
    rows.push({
      source_id: source.id,
      title,
      url,
      author: it.author ? truncate(stripHtml(it.author), 80) : null,
      published_at: published,
      // headline-only sources never keep body text, whatever the feed carries
      snippet: source.display === "snippet" && snippetText ? truncate(snippetText, MAX_SNIPPET) : null,
    })
    if (rows.length >= MAX_NEW_PER_SOURCE) break
  }
  return rows
}
