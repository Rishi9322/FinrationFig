import { describe, it, expect } from "vitest";
import { tidyTitle, parseFeed, parseGdelt, toRows, cleanUrl, stripHtml, truncate, matchesTerms, type NewsSource } from "./news";

const now = new Date("2026-10-05T12:00:00Z");
const src = (over: Partial<NewsSource> = {}): NewsSource => ({
  id: "s", name: "S", kind: "rss", url: "https://x", enabled: true, display: "snippet",
  includeTerms: [], excludeTerms: [], maxAgeDays: 30, ...over,
});

const RSS = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[MSME credit &amp; GST: what changes]]></title>
<link>https://blog.example.com/p/1?utm_source=x&amp;id=7#frag</link>
<dc:creator><![CDATA[Asha Rao]]></dc:creator>
<pubDate>Fri, 02 Oct 2026 08:00:00 +0000</pubDate>
<description><![CDATA[<p>Banks now ask for <b>DSCR</b> above 1.25. <script>alert(1)</script></p>]]></description></item>
<item><title>Too old</title><link>https://blog.example.com/p/2</link><pubDate>Mon, 01 Jan 2024 00:00:00 +0000</pubDate></item>
<item><title></title><link>https://blog.example.com/p/3</link></item>
<item><title>Bad scheme</title><link>javascript:alert(1)</link></item>
<item><title>Dup</title><link>https://blog.example.com/p/1?id=7&amp;utm_campaign=y</link></item>
</channel></rss>`;

describe("parseFeed + toRows (RSS)", () => {
  const rows = toRows(src(), parseFeed(RSS), now);

  it("keeps only the good, fresh, unique item and cleans it", () => {
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "MSME credit & GST: what changes",
      url: "https://blog.example.com/p/1?id=7",
      author: "Asha Rao",
      published_at: "2026-10-02T08:00:00.000Z",
    });
  });
  it("snippet is plain text: no tags, no script", () => {
    expect(rows[0].snippet).toBe("Banks now ask for DSCR above 1.25.");
    expect(rows[0].snippet).not.toMatch(/[<>]|alert/);
  });
  it("headline-only sources never store a snippet", () => {
    expect(toRows(src({ display: "headline" }), parseFeed(RSS), now)[0].snippet).toBeNull();
  });
});

describe("parseFeed (Atom)", () => {
  it("reads href links, author name and updated date", () => {
    const atom = `<feed><entry><title>Atom post</title><link rel="self" href="https://a.example/self"/>
<link rel="alternate" href="https://a.example/post?utm_medium=x"/><author><name>Ravi</name></author>
<updated>2026-10-03T00:00:00Z</updated><summary>Short</summary></entry></feed>`;
    const [r] = toRows(src(), parseFeed(atom), now);
    expect(r).toMatchObject({ url: "https://a.example/post", author: "Ravi", snippet: "Short" });
  });
});

describe("parseGdelt", () => {
  const data = { articles: [
    { url: "https://news.example/a", title: "RBI eases MSME norms", seendate: "20261004T093000Z", domain: "news.example" },
    { url: "ftp://bad", title: "x" }, { title: "no url" }, null,
  ] };
  it("maps articles, credits the domain, parses seendate", () => {
    const rows = toRows(src({ kind: "gdelt", display: "headline" }), parseGdelt(data), now);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ author: "news.example", published_at: "2026-10-04T09:30:00.000Z", snippet: null });
  });
  it("re-joins tokenised punctuation in titles", () => {
    expect(tidyTitle("SBI sees CPI at 5 . 65 % in Sept , above 6 . 5 %")).toBe("SBI sees CPI at 5.65% in Sept, above 6.5%");
  });
  it("tolerates junk input", () => {
    expect(parseGdelt(null)).toEqual([]);
    expect(parseGdelt({ articles: "x" })).toEqual([]);
  });
});

describe("helpers", () => {
  it("cleanUrl rejects non-http, credentials and strips tracking", () => {
    expect(cleanUrl("javascript:alert(1)")).toBeNull();
    expect(cleanUrl("https://u:p@x.com/")).toBeNull();
    expect(cleanUrl("https://x.com/a?fbclid=1&q=2")).toBe("https://x.com/a?q=2");
    expect(cleanUrl("not a url")).toBeNull();
  });
  it("stripHtml removes tags even when entity-encoded", () => {
    expect(stripHtml("&lt;img src=x onerror=alert(1)&gt;Hi&nbsp;there")).toBe("Hi there");
  });
  it("truncate cuts on a word boundary with an ellipsis", () => {
    const t = truncate("alpha beta gamma delta epsilon", 20);
    expect(t.length).toBeLessThanOrEqual(20);
    expect(t.endsWith("…")).toBe(true);
    expect(truncate("short", 20)).toBe("short");
  });
  it("matchesTerms: include is any-of, exclude wins, word boundaries", () => {
    expect(matchesTerms("New GST rules", ["gst"], [])).toBe(true);
    expect(matchesTerms("Digest of news", ["gst"], [])).toBe(false);
    expect(matchesTerms("GST casino", ["gst"], ["casino"])).toBe(false);
    expect(matchesTerms("anything", [], [])).toBe(true);
  });
  it("rejects items dated far in the future", () => {
    const rows = toRows(src(), [{ title: "Future", url: "https://f.example/1", publishedAt: "2030-01-01T00:00:00Z" }], now);
    expect(rows).toHaveLength(0);
  });
});
