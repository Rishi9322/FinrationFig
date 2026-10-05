import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isIos, recentlyDismissed, isStandalone, mayReloadForStaleChunk } from "./pwa";

const root = path.resolve(__dirname, "../..");
const pub = (f: string) => path.join(root, "public", f);

describe("isIos", () => {
  it("recognises iPhone/iPad/iPod user agents", () => {
    expect(isIos("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1")).toBe(true);
    expect(isIos("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)")).toBe(true);
  });
  it("recognises iPadOS 13+, which reports as a Mac but has a touchscreen", () => {
    const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15";
    expect(isIos(mac, 5)).toBe(true);
    expect(isIos(mac, 0)).toBe(false); // a real Mac
  });
  it("does not match Android or desktop", () => {
    expect(isIos("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile Safari/537.36", 5)).toBe(false);
    expect(isIos("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120")).toBe(false);
  });
});

describe("recentlyDismissed", () => {
  const now = Date.UTC(2026, 9, 5);
  it("is true within 14 days of a 'not now'", () => {
    expect(recentlyDismissed(String(now - 13 * 86_400_000), now)).toBe(true);
  });
  it("expires after 14 days", () => {
    expect(recentlyDismissed(String(now - 15 * 86_400_000), now)).toBe(false);
  });
  it("is false when never dismissed or the value is garbage", () => {
    for (const raw of [null, "", "abc", "0", "-5"]) expect(recentlyDismissed(raw, now)).toBe(false);
  });
});

describe("isStandalone", () => {
  const win = (standaloneMedia: boolean, iosStandalone?: boolean) =>
    ({ matchMedia: () => ({ matches: standaloneMedia }), navigator: { standalone: iosStandalone } }) as unknown as Window;
  it("detects display-mode standalone and iOS navigator.standalone", () => {
    expect(isStandalone(win(true))).toBe(true);
    expect(isStandalone(win(false, true))).toBe(true);
    expect(isStandalone(win(false, false))).toBe(false);
    expect(isStandalone(win(false))).toBe(false);
  });
});

describe("installable-app assets", () => {
  const manifest = JSON.parse(fs.readFileSync(pub("manifest.webmanifest"), "utf8"));

  it("manifest has the fields browsers require to offer installation", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toMatch(/^\//);
    expect(manifest.scope).toBe("/");
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("has 192 and 512 icons plus a maskable one, and every icon file really exists at its declared size", () => {
    const sizes = new Set<string>();
    let maskable = false;
    for (const icon of manifest.icons) {
      const file = pub(icon.src.replace(/^\//, "").split("?")[0]);
      expect(fs.existsSync(file), icon.src).toBe(true);
      const buf = fs.readFileSync(file);
      expect(buf.subarray(1, 4).toString()).toBe("PNG");
      const [w, h] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
      expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
      sizes.add(icon.sizes);
      if (icon.purpose === "maskable") maskable = true;
    }
    expect(sizes.has("192x192")).toBe(true);
    expect(sizes.has("512x512")).toBe(true);
    expect(maskable).toBe(true);
  });

  it("shortcut targets and the offline fallback exist", () => {
    for (const s of manifest.shortcuts) expect(s.url).toMatch(/^\//);
    expect(fs.existsSync(pub("offline.html"))).toBe(true);
    expect(fs.existsSync(pub("sw.js"))).toBe(true);
  });

  it("index.html links the manifest, theme colour and a square apple-touch icon", () => {
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    expect(html).toMatch(/rel="manifest" href="\/manifest\.webmanifest"/);
    expect(html).toMatch(/name="theme-color" content="#050A14"/i);
    const m = html.match(/rel="apple-touch-icon"[^>]*href="([^"]+)"/);
    expect(m).toBeTruthy();
    const buf = fs.readFileSync(pub(m![1].replace(/^\//, "").split("?")[0]));
    expect(buf.readUInt32BE(16)).toBe(buf.readUInt32BE(20)); // square
  });

  it("the service worker never caches API traffic: it only handles same-origin GETs, pages and /assets", () => {
    // Judge the code, not the explanatory comments (which name these services on purpose).
    const sw = fs.readFileSync(pub("sw.js"), "utf8")
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(sw).toMatch(/request\.method !== "GET"\) return/);
    expect(sw).toMatch(/url\.origin !== self\.location\.origin\) return/);
    expect(sw).toMatch(/startsWith\("\/assets\/"\)/);
    expect(sw).not.toMatch(/supabase|firebase|googleapis|ai\/chat/i);
  });

  it("vercel.json serves the SW uncached and keeps the new files out of the SPA rewrite", () => {
    const v = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
    const rewrite = new RegExp(`^${v.rewrites[0].source.replace(/^\//, "\\/")}$`);
    for (const p of ["/sw.js", "/manifest.webmanifest", "/icon-192.png", "/offline.html", "/apple-touch-icon.png"]) {
      expect(rewrite.test(p), `${p} must NOT be rewritten to index.html`).toBe(false);
    }
    expect(rewrite.test("/dashboard/cma-generator")).toBe(true); // real routes still fall back to the SPA
    const swHeaders = v.headers.find((h: any) => h.source === "/sw.js").headers;
    expect(swHeaders.find((h: any) => h.key === "Cache-Control").value).toMatch(/no-cache/);
  });
});

describe("mayReloadForStaleChunk", () => {
  const now = Date.UTC(2026, 9, 5, 12, 0, 0);
  it("allows the first reload", () => {
    expect(mayReloadForStaleChunk(null, now)).toBe(true);
  });
  it("blocks a second reload within a minute (no reload loop)", () => {
    expect(mayReloadForStaleChunk(String(now - 5_000), now)).toBe(false);
  });
  it("allows another reload after the cooldown, so a tab open across two deploys recovers twice", () => {
    expect(mayReloadForStaleChunk(String(now - 61_000), now)).toBe(true);
  });
  it("ignores a corrupt value", () => {
    expect(mayReloadForStaleChunk("garbage", now)).toBe(true);
  });
});

describe("app icon", () => {
  it("the install banner and offline page use the app icon, and the worker precaches it", () => {
    expect(fs.readFileSync(pub("offline.html"), "utf8")).toMatch(/src="\/icon-192\.png"/);
    expect(fs.readFileSync(path.join(root, "src/app/components/InstallPrompt.tsx"), "utf8")).toMatch(/src="\/icon-192\.png"/);
    expect(fs.readFileSync(pub("sw.js"), "utf8")).toMatch(/OFFLINE_ASSETS = \[[^\]]*icon-192\.png/);
  });

  it("icon URLs carry a version tag, so installed apps and browsers refetch after a change", () => {
    const manifest = JSON.parse(fs.readFileSync(pub("manifest.webmanifest"), "utf8"));
    for (const i of manifest.icons) expect(i.src, i.src).toMatch(/\?v=\d+$/);
    expect(fs.readFileSync(path.join(root, "index.html"), "utf8")).toMatch(/apple-touch-icon\.png\?v=\d+/);
  });

  it("the source artwork is kept so every asset can be regenerated", () => {
    expect(fs.existsSync(path.join(root, "design", "app-icon.png"))).toBe(true);
    expect(fs.existsSync(path.join(root, "scripts", "generate-icons.py"))).toBe(true);
  });
});

describe("favicons Google can use", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const png = (f: string) => fs.readFileSync(pub(f));

  it("serves a real favicon.ico (it used to 404) containing 16/32/48", () => {
    const ico = png("favicon.ico");
    expect(ico.readUInt16LE(0)).toBe(0);       // reserved
    expect(ico.readUInt16LE(2)).toBe(1);       // type: icon
    expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(3); // image count
  });

  it("declares square PNG favicons whose sizes are multiples of 48 (Google's rule) and exist at that size", () => {
    for (const s of [48, 96, 192]) {
      expect(html).toContain(`href="/favicon-${s}.png?v=`);
      const b = png(`favicon-${s}.png`);
      expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([s, s]);
    }
  });

  it("does not declare the big home-screen icon as a favicon (Google would crop its corners in a circle)", () => {
    expect(html).not.toMatch(/rel="icon"[^>]*icon-512\.png/);
  });

  it("the old 848 KB wide favicon.png is gone: it is a small square now", () => {
    const b = png("favicon.png");
    expect(b.readUInt32BE(16)).toBe(b.readUInt32BE(20));
    expect(b.length).toBeLessThan(50_000);
  });

  it("the page has a descriptive title and Organization + WebSite structured data with the logo", () => {
    expect(html).toMatch(/<title>FinRatio - Financial Ratio Analysis for Indian SMEs<\/title>/);
    expect(html).toContain('"@type": "Organization"');
    expect(html).toContain('"@type": "WebSite"');
    expect(html).toContain("https://finratio.site/icon-512.png");
  });

  it("the in-app logo is a tight transparent crop (not the old image with big empty margins)", () => {
    const b = png("logo-mark.png");
    expect(b[25]).toBe(6); // RGBA
    expect(b.readUInt32BE(16) / b.readUInt32BE(20)).toBeGreaterThan(0.7); // roughly square, not 328x574 portrait
  });
});
