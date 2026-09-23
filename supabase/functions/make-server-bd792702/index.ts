import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js";
import { z } from "npm:zod";
import { jwtVerify, createRemoteJWKSet, SignJWT } from "npm:jose";

// Auth is Firebase. This function only does what needs the service role: the AI
// proxy (keeps the OpenRouter key server-side), admin user management, and
// account export/delete. Every request is authenticated by verifying the
// caller's Firebase ID token against Google's public keys — so the platform
// verify_jwt gate is OFF (Firebase tokens are not Supabase-signed).

type Role = "SUPER_ADMIN" | "ADMIN" | "USER";

const app = new Hono();
const API_PREFIX = "/make-server-bd792702";
const MAX_AI_REQUEST_BYTES = 256 * 1024;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN");

// Firebase project identity. The API key is the public web key (safe on clients).
const FIREBASE_PROJECT_ID = "finratio-1245e";
const FIREBASE_API_KEY = Deno.env.get("FIREBASE_API_KEY") ?? "AIzaSyAHaDW4hmGF7F2pfBd6enUptGwgpQgTlhg";
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

// WhatsApp OTP sign-in bypasses Firebase entirely (no SMS/phone provider), so
// we mint our own session token instead of a Firebase custom token (no service
// account on hand). Reuses JWT_SECRET, a secret already deployed from the
// pre-Firebase custom-auth era. requireAuth() accepts either token kind.
const PHONE_JWT_SECRET = Deno.env.get("JWT_SECRET") ?? "";
const PHONE_JWT_ISSUER = "finratio-phone-auth";
const phoneJwtKey = PHONE_JWT_SECRET ? new TextEncoder().encode(PHONE_JWT_SECRET) : null;

const ALLOWED_ORIGINS = [
  "https://finratio.site",
  "https://www.finratio.site",
  "https://finrat.vercel.app",
  "https://finrat-git-main-rishis-projects-1c080e6c.vercel.app",
  "https://finrat-git-deploy-supabase-secr-82a4ba-rishis-projects-1c080e6c.vercel.app",
  "https://finration-fig.vercel.app",
  ...(APP_ORIGIN ? APP_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean) : []),
];
const allowDevOrigins = Deno.env.get("ALLOW_DEV_ORIGINS") === "true";

const CALCULATOR_SLUGS = [
  "debt-equity", "quasi-debt-equity", "profit-percent", "current-ratio", "dscr", "ebitda", "iscr",
  "net-working-capital", "drawing-power", "ageing", "pid", "valuation", "working-capital-cycle",
  "cashflow-quality", "macro-ratios",
];
const DEFAULT_FEATURE_SLUG = "pid";

// Calculators are open to every signed-in user. These two are granted per user
// by an admin, so they are the only slugs a grant actually decides.
const RESTRICTED_SLUGS = ["cma-generator", "doc-parser"];
const GRANTABLE_SLUGS = [...CALCULATOR_SLUGS, ...RESTRICTED_SLUGS];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return allowDevOrigins && /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/.test(origin);
}

function getSupabaseAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase admin configuration is missing");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

function nowIso() { return new Date().toISOString(); }

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Defaults to +91 (India) when the user omits a country code, matching the
// placeholder shown on the sign-in form.
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  const e164 = digits.startsWith("+") ? digits : `+91${digits}`;
  return /^\+\d{10,15}$/.test(e164) ? e164 : null;
}

async function phoneUid(phone: string): Promise<string> {
  return `phone_${(await sha256Hex(`uid:${phone}`)).slice(0, 28)}`;
}

app.use("*", async (c, next) => {
  await next();
  console.log(`${c.req.method} ${new URL(c.req.url).pathname} ${c.res.status}`);
});

app.use("/*", async (c, next) => {
  const origin = c.req.header("Origin");
  if (origin && !isAllowedOrigin(origin)) {
    return c.json({ error: "Origin not allowed" }, 403);
  }
  if (origin) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Vary", "Origin");
    c.header("Access-Control-Allow-Credentials", "true");
  }
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Invite-Code");
  c.header("Access-Control-Max-Age", "600");
  if (c.req.method === "OPTIONS") return c.json({}, 200);
  await next();
});

const Schemas = {
  adminCreateUser: z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().min(3).max(254),
    password: z.string().min(6).max(200),
    role: z.enum(["SUPER_ADMIN", "ADMIN", "USER"]).optional(),
    calculatorAccessMode: z.enum(["FULL", "CUSTOM"]).optional(),
    calculatorAccess: z.array(z.string().max(64)).max(100).optional(),
  }),
  role: z.object({ role: z.enum(["SUPER_ADMIN", "ADMIN", "USER"]) }),
  accessMode: z.object({ accessMode: z.enum(["FULL", "CUSTOM"]) }),
  calculatorAccess: z.object({ slugs: z.array(z.string().max(64)).max(100) }),
  suspend: z.object({ suspended: z.boolean() }),
  onboarding: z.object({ businessConstitution: z.string().trim().min(1).max(200) }),
  profileUpdate: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    businessConstitution: z.string().trim().max(200).optional(),
  }),
  feedback: z.object({
    type: z.enum(["REVIEW", "FEATURE_REQUEST", "BUG"]),
    message: z.string().trim().min(1).max(4000),
    rating: z.number().int().min(1).max(5).optional(),
  }),
  createInvite: z.object({
    code: z.string().trim().toUpperCase().min(4).max(40).regex(/^[A-Z0-9-]+$/, "Letters, numbers, and hyphens only").optional(),
    note: z.string().trim().max(500).optional(),
    email: z.string().trim().toLowerCase().min(3).max(254).optional(),
    startsAt: z.string().datetime().optional(),
    expiresAt: z.string().datetime().optional(),
    maxUses: z.number().int().min(1).max(100000).default(1),
  }),
  emailInvite: z.object({
    to: z.string().trim().toLowerCase().min(3).max(254),
  }),
  phoneSend: z.object({
    phone: z.string().trim().min(6).max(20),
  }),
  phoneVerify: z.object({
    phone: z.string().trim().min(6).max(20),
    code: z.string().trim().min(4).max(8),
  }),
  blogPost: z.object({
    title: z.string().trim().min(1).max(200),
    excerpt: z.string().trim().min(1).max(500),
    content: z.string().trim().min(1).max(50000),
    coverImageUrl: z.string().trim().max(2000).optional(),
    sourceName: z.string().trim().max(200).optional(),
    sourceUrl: z.string().trim().max(2000).optional(),
    published: z.boolean().optional(),
  }),
  calculation: z.object({
    calculatorType: z.string().trim().min(1).max(64),
    inputs: z.record(z.string(), z.unknown()).default({}),
    results: z.record(z.string(), z.unknown()).default({}),
  }),
  calculationUpdate: z.object({
    inputs: z.record(z.string(), z.unknown()).optional(),
    results: z.record(z.string(), z.unknown()).optional(),
  }),
  upload: z.object({
    filename: z.string().trim().min(1).max(255),
    contentType: z.string().max(255).nullish(),
    fileBase64: z.string().min(1).max(Math.ceil((10 * 1024 * 1024 * 4) / 3) + 4),
  }),
  aiChat: z.object({
    messages: z.array(z.object({
      role: z.enum(["system", "user", "assistant"]).default("user"),
      content: z.string().max(MAX_AI_REQUEST_BYTES),
    })).min(1).max(20),
    temperature: z.number().min(0).max(2).optional(),
    response_format: z.object({ type: z.string().max(32) }).optional(),
    stream: z.boolean().optional(),
    max_tokens: z.number().int().min(1).max(8192).optional(),
  }),
};

async function parseBody<T>(c: any, schema: z.ZodType<T>) {
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return { ok: false as const, response: c.json({ error: "Invalid JSON body" }, 400) }; }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join(".")).filter(Boolean);
    return { ok: false as const, response: c.json({ error: "Invalid request", fields }, 400) };
  }
  return { ok: true as const, data: result.data };
}

type Profile = {
  id: string; email: string; name: string; role: Role; status: "ACTIVE" | "SUSPENDED";
  calculator_access_mode: "FULL" | "CUSTOM"; calculator_access: string[];
  business_constitution: string | null; created_at: string;
};

// Invite-only access: a brand-new Firebase login (no profiles row yet) may
// only get one by redeeming a valid invite code, sent by the client as the
// X-Invite-Code header on that first call. redeem_invite() is an atomic
// Postgres function (row-locked) so two people can't over-redeem the last slot
// of a limited-use code by racing each other.
async function redeemInviteForSignup(code: string, email: string): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("redeem_invite", { p_code: code, p_email: email });
  if (error) { console.error("[redeem_invite] rpc failed", error); return null; }
  return Array.isArray(data) && data.length > 0 ? data[0].id : null;
}

// Verify the caller's Firebase ID token, then load their profile (the authority
// on role/status). A first-ever call provisions a default USER profile, but
// only after redeeming a valid invite code - see redeemInviteForSignup above.
async function requireAuth(c: any): Promise<{ profile: Profile; uid: string; token: string } | null> {
  const authorization = c.req.header("Authorization") || c.req.header("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) { c.status(401); c.res = c.json({ error: "Unauthorized" }); return null; }

  let uid: string;
  let email = "";
  let name = "";
  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: FIREBASE_ISSUER,
      audience: FIREBASE_PROJECT_ID,
    });
    uid = String(payload.sub);
    email = String((payload as any).email ?? "");
    name = String((payload as any).name ?? "");
    if (!uid) throw new Error("no sub");
  } catch (_firebaseErr) {
    // Not a Firebase ID token - try our own WhatsApp-OTP session token.
    if (!phoneJwtKey) { c.status(401); c.res = c.json({ error: "Invalid session" }); return null; }
    try {
      const { payload } = await jwtVerify(token, phoneJwtKey, {
        issuer: PHONE_JWT_ISSUER,
        audience: FIREBASE_PROJECT_ID,
      });
      uid = String(payload.sub);
      email = String((payload as any).email ?? "");
      name = String((payload as any).name ?? "");
      if (!uid) throw new Error("no sub");
    } catch (_phoneErr) {
      c.status(401); c.res = c.json({ error: "Invalid session" }); return null;
    }
  }

  const admin = getSupabaseAdminClient();
  let { data: profile } = await admin.from("profiles").select("*").eq("id", uid).single();
  if (!profile) {
    const inviteCode = (c.req.header("X-Invite-Code") || "").trim();
    if (!inviteCode) {
      c.status(403);
      c.res = c.json({ error: "FinRatio is invite-only right now. Ask an admin for an invite code." });
      return null;
    }
    const inviteId = await redeemInviteForSignup(inviteCode, email.toLowerCase());
    if (!inviteId) {
      c.status(403);
      c.res = c.json({ error: "That invite code is invalid, expired, already fully used, or reserved for a different email." });
      return null;
    }
    const insert = await admin.from("profiles")
      .insert({ id: uid, email: email.toLowerCase(), name: name || email.split("@")[0] })
      .select("*").single();
    profile = insert.data;
    if (profile) {
      await admin.from("invite_redemptions").insert({ invite_id: inviteId, user_id: uid, user_email: email.toLowerCase() });
    }
  }
  if (!profile) { c.status(401); c.res = c.json({ error: "Profile not found" }); return null; }
  if (profile.status === "SUSPENDED") { c.status(403); c.res = c.json({ error: "Account suspended" }); return null; }

  return { profile: profile as Profile, uid, token };
}

async function requireSuperAdmin(c: any) {
  const auth = await requireAuth(c);
  if (!auth) return null;
  if (auth.profile.role !== "SUPER_ADMIN") { c.status(403); c.res = c.json({ error: "Forbidden" }); return null; }
  return auth;
}

async function requireAdmin(c: any) {
  const auth = await requireAuth(c);
  if (!auth) return null;
  if (auth.profile.role !== "SUPER_ADMIN" && auth.profile.role !== "ADMIN") {
    c.status(403); c.res = c.json({ error: "Forbidden" }); return null;
  }
  return auth;
}

function slugify(title: string): string {
  return title.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 100) || "post";
}

function blogPostView(r: any) {
  return {
    id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt, content: r.content,
    coverImageUrl: r.cover_image_url, sourceName: r.source_name, sourceUrl: r.source_url,
    published: r.published, authorName: r.author_name, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function resolvedAccess(p: Profile): string[] {
  if (p.role === "SUPER_ADMIN" || p.role === "ADMIN") return GRANTABLE_SLUGS;
  // Every calculator is included regardless of mode; only the restricted tools
  // still depend on an explicit grant, so FULL must not imply them.
  const granted = (p.calculator_access ?? []).filter((slug) => RESTRICTED_SLUGS.includes(slug));
  return [...CALCULATOR_SLUGS, ...granted];
}

function publicUserView(p: Profile) {
  return {
    id: p.id, name: p.name, email: p.email, role: p.role, status: p.status,
    isVerified: true, calculatorAccessMode: p.calculator_access_mode,
    createdAt: p.created_at, calculatorAccess: resolvedAccess(p),
    businessConstitution: p.business_constitution ?? undefined,
  };
}

async function auditLog(c: any, event: string, detail: { actorId?: string; targetId?: string; outcome: "success" | "failure"; note?: string }) {
  const forwardedFor = c.req.header("x-forwarded-for");
  const parts = (forwardedFor || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = parts[parts.length - 1] || "unknown";
  try {
    const admin = getSupabaseAdminClient();
    await admin.from("audit_events").insert({
      event, actor_id: detail.actorId ?? null, target_id: detail.targetId ?? null,
      outcome: detail.outcome, note: detail.note ?? null, ip,
    });
  } catch (error) {
    console.warn("[audit] write failed", error);
  }
}

async function validateRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc("consume_rate_limit", {
      p_key: key, p_limit: limit, p_window_seconds: Math.ceil(windowMs / 1000),
    });
    if (!error && typeof data === "boolean") return data;
  } catch (error) {
    console.warn("[rate-limit] failing open:", error);
  }
  return true;
}

app.get(`${API_PREFIX}/health`, (c) => c.json({ status: "ok" }));

// ---- Blog: public reads, ADMIN+ writes ----
app.get(`${API_PREFIX}/blog`, async (c) => {
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("blog_posts").select("*")
    .eq("published", true).order("created_at", { ascending: false }).limit(200);
  return c.json({ posts: (data ?? []).map(blogPostView) });
});

app.get(`${API_PREFIX}/blog/:slug`, async (c) => {
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("blog_posts").select("*")
    .eq("slug", c.req.param("slug")).eq("published", true).single();
  if (!data) return c.json({ error: "Post not found" }, 404);
  return c.json({ post: blogPostView(data) });
});

app.get(`${API_PREFIX}/admin/blog`, async (c) => {
  const auth = await requireAdmin(c);
  if (!auth) return c.res;
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("blog_posts").select("*").order("created_at", { ascending: false }).limit(500);
  return c.json({ posts: (data ?? []).map(blogPostView) });
});

app.post(`${API_PREFIX}/admin/blog`, async (c) => {
  const auth = await requireAdmin(c);
  if (!auth) return c.res;
  const parsed = await parseBody(c, Schemas.blogPost);
  if (!parsed.ok) return parsed.response;
  const admin = getSupabaseAdminClient();
  const base = slugify(parsed.data.title);
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data: existing } = await admin.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
    if (!existing) break;
    slug = `${base}-${i}`;
  }
  const { data, error } = await admin.from("blog_posts").insert({
    slug, title: parsed.data.title, excerpt: parsed.data.excerpt, content: parsed.data.content,
    cover_image_url: parsed.data.coverImageUrl || null,
    source_name: parsed.data.sourceName || null, source_url: parsed.data.sourceUrl || null,
    published: parsed.data.published ?? false,
    author_id: auth.uid, author_name: auth.profile.name || auth.profile.email,
  }).select("*").single();
  if (error || !data) return c.json({ error: "Could not create post" }, 500);
  return c.json({ post: blogPostView(data) }, 201);
});

app.put(`${API_PREFIX}/admin/blog/:id`, async (c) => {
  const auth = await requireAdmin(c);
  if (!auth) return c.res;
  const parsed = await parseBody(c, Schemas.blogPost.partial());
  if (!parsed.ok) return parsed.response;
  const patch: Record<string, unknown> = { updated_at: nowIso() };
  const d = parsed.data;
  if (d.title !== undefined) patch.title = d.title;
  if (d.excerpt !== undefined) patch.excerpt = d.excerpt;
  if (d.content !== undefined) patch.content = d.content;
  if (d.coverImageUrl !== undefined) patch.cover_image_url = d.coverImageUrl || null;
  if (d.sourceName !== undefined) patch.source_name = d.sourceName || null;
  if (d.sourceUrl !== undefined) patch.source_url = d.sourceUrl || null;
  if (d.published !== undefined) patch.published = d.published;
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("blog_posts").update(patch).eq("id", c.req.param("id")).select("*").single();
  if (error || !data) return c.json({ error: "Post not found" }, 404);
  return c.json({ post: blogPostView(data) });
});

app.delete(`${API_PREFIX}/admin/blog/:id`, async (c) => {
  const auth = await requireAdmin(c);
  if (!auth) return c.res;
  const admin = getSupabaseAdminClient();
  await admin.from("blog_posts").delete().eq("id", c.req.param("id"));
  return c.json({ message: "Post deleted" });
});

app.get(`${API_PREFIX}/admin/feedback`, async (c) => {
  const auth = await requireSuperAdmin(c);
  if (!auth) return c.res;
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("feedback").select("*").order("created_at", { ascending: false }).limit(500);
  return c.json({
    feedback: (data ?? []).map((r: any) => ({
      id: r.id, userEmail: r.user_email, type: r.type, message: r.message, rating: r.rating, createdAt: r.created_at,
    })),
  });
});

// ---- Admin: invites (SUPER_ADMIN only) ----
function generateInviteCode(): string {
  // Base32-ish, no ambiguous characters (0/O, 1/I) - easy to read out loud or retype.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function inviteView(r: any) {
  const now = new Date();
  const startsAt = new Date(r.starts_at);
  const expiresAt = r.expires_at ? new Date(r.expires_at) : null;
  const computedStatus =
    r.status === "REVOKED" ? "REVOKED"
    : r.use_count >= r.max_uses ? "EXHAUSTED"
    : expiresAt && now > expiresAt ? "EXPIRED"
    : now < startsAt ? "SCHEDULED"
    : "ACTIVE";
  return {
    id: r.id, code: r.code, note: r.note, email: r.email, createdBy: r.created_by,
    startsAt: r.starts_at, expiresAt: r.expires_at, maxUses: r.max_uses, useCount: r.use_count,
    status: r.status, computedStatus, createdAt: r.created_at,
  };
}

app.get(`${API_PREFIX}/admin/invites`, async (c) => {
  const auth = await requireSuperAdmin(c);
  if (!auth) return c.res;
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("invites").select("*").order("created_at", { ascending: false }).limit(500);
  return c.json({ invites: (data ?? []).map(inviteView) });
});

app.post(`${API_PREFIX}/admin/invites`, async (c) => {
  const auth = await requireSuperAdmin(c);
  if (!auth) return c.res;
  const parsed = await parseBody(c, Schemas.createInvite);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const code = body.code || generateInviteCode();
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("invites").insert({
    code, note: body.note || null, email: body.email || null,
    created_by: auth.uid,
    starts_at: body.startsAt || nowIso(),
    expires_at: body.expiresAt || null,
    max_uses: body.maxUses,
  }).select("*").single();
  if (error || !data) {
    const duplicate = String((error as any)?.message || "").toLowerCase().includes("duplicate");
    return c.json({ error: duplicate ? "That code is already in use" : "Could not create invite" }, duplicate ? 409 : 500);
  }
  await auditLog(c, "admin.invite-create", { actorId: auth.profile.id, outcome: "success", note: code });
  return c.json({ invite: inviteView(data) }, 201);
});

app.put(`${API_PREFIX}/admin/invites/:id/revoke`, async (c) => {
  const auth = await requireSuperAdmin(c);
  if (!auth) return c.res;
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("invites").update({ status: "REVOKED" }).eq("id", c.req.param("id")).select("*").single();
  if (error || !data) return c.json({ error: "Invite not found" }, 404);
  await auditLog(c, "admin.invite-revoke", { actorId: auth.profile.id, outcome: "success", note: data.code });
  return c.json({ invite: inviteView(data) });
});

app.get(`${API_PREFIX}/admin/invites/:id/redemptions`, async (c) => {
  const auth = await requireSuperAdmin(c);
  if (!auth) return c.res;
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("invite_redemptions").select("*")
    .eq("invite_id", c.req.param("id")).order("redeemed_at", { ascending: false });
  return c.json({
    redemptions: (data ?? []).map((r: any) => ({ id: r.id, userId: r.user_id, userEmail: r.user_email, redeemedAt: r.redeemed_at })),
  });
});

app.post(`${API_PREFIX}/admin/invites/:id/email`, async (c) => {
  const auth = await requireSuperAdmin(c);
  if (!auth) return c.res;
  const parsed = await parseBody(c, Schemas.emailInvite);
  if (!parsed.ok) return parsed.response;
  const admin = getSupabaseAdminClient();
  const { data: invite } = await admin.from("invites").select("*").eq("id", c.req.param("id")).single();
  if (!invite) return c.json({ error: "Invite not found" }, 404);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromAddress = Deno.env.get("RESEND_FROM_ADDRESS") || "FinRatio <onboarding@finratio.site>";
  if (!resendKey) return c.json({ error: "Email is not configured (RESEND_API_KEY missing)" }, 503);

  const signupUrl = `${ALLOWED_ORIGINS[0]}/auth/signup?invite=${encodeURIComponent(invite.code)}`;
  const expiryLine = invite.expires_at ? `This code expires on ${new Date(invite.expires_at).toLocaleString("en-IN")}.` : "This code does not expire.";
  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddress,
      to: [parsed.data.to],
      subject: "You're invited to FinRatio",
      html: `<p>You've been invited to FinRatio.</p>
        <p>Your invite code: <strong style="font-family:monospace;font-size:16px">${invite.code}</strong></p>
        <p><a href="${signupUrl}">Sign up with this code</a></p>
        <p style="color:#64748B;font-size:13px">${expiryLine}</p>`,
    }),
  });
  if (!send.ok) {
    const body = await send.text().catch(() => "");
    console.error("[invite email] Resend error", send.status, body);
    return c.json({ error: "Could not send the invite email" }, 502);
  }
  await auditLog(c, "admin.invite-email", { actorId: auth.profile.id, outcome: "success", note: `${invite.code} -> ${parsed.data.to}` });
  return c.json({ message: "Invite email sent" });
});

// ---- WhatsApp OTP sign-in (public, unauthenticated) ----
app.post(`${API_PREFIX}/auth/phone/send-otp`, async (c) => {
  const parsed = await parseBody(c, Schemas.phoneSend);
  if (!parsed.ok) return parsed.response;
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return c.json({ error: "Enter a valid phone number" }, 400);

  const allowed = await validateRateLimit(`phone-otp:${phone}`, 3, 10 * 60 * 1000);
  if (!allowed) return c.json({ error: "Too many requests. Try again later." }, 429);

  const whatsappUrl = Deno.env.get("WHATSAPP_API_URL");
  const whatsappKey = Deno.env.get("WHATSAPP_API_KEY");
  if (!whatsappUrl || !whatsappKey || !phoneJwtKey) {
    return c.json({ error: "WhatsApp verification is not configured" }, 503);
  }

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("phone_otps").upsert({
    phone, code_hash: await sha256Hex(`${phone}:${code}`),
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), attempts: 0,
  }, { onConflict: "phone" });
  if (error) return c.json({ error: "Could not start verification" }, 500);

  const send = await fetch(whatsappUrl, {
    method: "POST",
    headers: { "X-API-KEY": whatsappKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone.replace("+", ""),
      type: "text",
      text: { body: `Your FinRatio verification code is ${code}. It expires in 5 minutes.` },
    }),
  });
  if (!send.ok) {
    console.error("[phone-otp] WhatsApp send failed", send.status, await send.text().catch(() => ""));
    return c.json({ error: "Could not send the WhatsApp message" }, 502);
  }
  return c.json({ message: "OTP sent" });
});

app.post(`${API_PREFIX}/auth/phone/verify-otp`, async (c) => {
  const parsed = await parseBody(c, Schemas.phoneVerify);
  if (!parsed.ok) return parsed.response;
  const phone = normalizePhone(parsed.data.phone);
  if (!phone || !phoneJwtKey) return c.json({ error: "Enter a valid phone number" }, 400);

  const allowed = await validateRateLimit(`phone-verify:${phone}`, 8, 10 * 60 * 1000);
  if (!allowed) return c.json({ error: "Too many attempts. Try again later." }, 429);

  const admin = getSupabaseAdminClient();
  const { data: row } = await admin.from("phone_otps").select("*").eq("phone", phone).maybeSingle();
  if (!row || new Date(row.expires_at) < new Date() || row.attempts >= 5) {
    return c.json({ error: "Code expired or invalid. Request a new one." }, 400);
  }
  if ((await sha256Hex(`${phone}:${parsed.data.code}`)) !== row.code_hash) {
    await admin.from("phone_otps").update({ attempts: row.attempts + 1 }).eq("phone", phone);
    return c.json({ error: "Incorrect code" }, 400);
  }
  await admin.from("phone_otps").delete().eq("phone", phone);

  const token = await new SignJWT({ email: `${phone}@phone.finratio.local`, name: phone })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(await phoneUid(phone))
    .setIssuer(PHONE_JWT_ISSUER)
    .setAudience(FIREBASE_PROJECT_ID)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(phoneJwtKey);

  return c.json({ token });
});

// ---- Admin: user management (SUPER_ADMIN only) ----
app.get(`${API_PREFIX}/admin/users`, async (c) => {
  const auth = await requireSuperAdmin(c);
  if (!auth) return c.res;
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("profiles").select("*").order("created_at", { ascending: false });
  return c.json({ users: (data ?? []).map((p) => publicUserView(p as Profile)) });
});

app.post(`${API_PREFIX}/admin/users`, async (c) => {
  const auth = await requireSuperAdmin(c);
  if (!auth) return c.res;
  const parsed = await parseBody(c, Schemas.adminCreateUser);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const email = body.email.trim().toLowerCase();
  const role = (body.role ?? "USER") as Role;
  const privileged = role === "SUPER_ADMIN" || role === "ADMIN";
  const mode = privileged || body.calculatorAccessMode === "FULL" ? "FULL" : "CUSTOM";
  const access = mode === "FULL"
    ? CALCULATOR_SLUGS
    : (body.calculatorAccess ?? []).filter((s) => GRANTABLE_SLUGS.includes(s));

  // Create the login in Firebase via the Identity Toolkit REST API (no Admin SDK).
  const signUp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: body.password, returnSecureToken: false }),
  });
  const signUpData = await signUp.json();
  if (!signUp.ok) {
    return c.json({ error: signUpData?.error?.message === "EMAIL_EXISTS" ? "Email already registered" : "Could not create user" }, 400);
  }
  const uid = signUpData.localId as string;

  const admin = getSupabaseAdminClient();
  const { data: profile, error: pErr } = await admin.from("profiles").upsert({
    id: uid, email, name: body.name, role, status: "ACTIVE",
    calculator_access_mode: mode,
    calculator_access: mode === "FULL" ? CALCULATOR_SLUGS : (access.length ? access : [DEFAULT_FEATURE_SLUG]),
    updated_at: nowIso(),
  }, { onConflict: "id" }).select("*").single();
  if (pErr || !profile) return c.json({ error: "User created but profile update failed" }, 500);

  await auditLog(c, "admin.create-user", { actorId: auth.profile.id, targetId: uid, outcome: "success", note: role });
  return c.json({ message: "User created", user: publicUserView(profile as Profile) }, 201);
});

app.put(`${API_PREFIX}/admin/users/:id/role`, async (c) => {
  const auth = await requireSuperAdmin(c);
  if (!auth) return c.res;
  const parsed = await parseBody(c, Schemas.role);
  if (!parsed.ok) return parsed.response;
  const role = parsed.data.role as Role;
  const privileged = role === "SUPER_ADMIN" || role === "ADMIN";
  const admin = getSupabaseAdminClient();
  const patch: Record<string, unknown> = { role, updated_at: nowIso() };
  if (privileged) { patch.calculator_access_mode = "FULL"; patch.calculator_access = CALCULATOR_SLUGS; }
  const { data, error } = await admin.from("profiles").update(patch).eq("id", c.req.param("id")).select("*").single();
  if (error || !data) return c.json({ error: "User not found" }, 404);
  await auditLog(c, "admin.role-change", { actorId: auth.profile.id, targetId: c.req.param("id"), outcome: "success", note: role });
  return c.json({ message: "Role updated", user: publicUserView(data as Profile) });
});

app.put(`${API_PREFIX}/admin/users/:id/suspend`, async (c) => {
  const auth = await requireSuperAdmin(c);
  if (!auth) return c.res;
  const parsed = await parseBody(c, Schemas.suspend);
  if (!parsed.ok) return parsed.response;
  const admin = getSupabaseAdminClient();
  const status = parsed.data.suspended ? "SUSPENDED" : "ACTIVE";
  const { data, error } = await admin.from("profiles").update({ status, updated_at: nowIso() }).eq("id", c.req.param("id")).select("*").single();
  if (error || !data) return c.json({ error: "User not found" }, 404);
  await auditLog(c, "admin.suspend", { actorId: auth.profile.id, targetId: c.req.param("id"), outcome: "success", note: status });
  return c.json({ message: "Status updated", user: publicUserView(data as Profile) });
});

app.put(`${API_PREFIX}/admin/users/:id/access-mode`, async (c) => {
  const auth = await requireSuperAdmin(c);
  if (!auth) return c.res;
  const parsed = await parseBody(c, Schemas.accessMode);
  if (!parsed.ok) return parsed.response;
  const admin = getSupabaseAdminClient();
  const mode = parsed.data.accessMode;
  const patch: Record<string, unknown> = { calculator_access_mode: mode, updated_at: nowIso() };
  if (mode === "FULL") patch.calculator_access = CALCULATOR_SLUGS;
  const { data, error } = await admin.from("profiles").update(patch).eq("id", c.req.param("id")).select("*").single();
  if (error || !data) return c.json({ error: "User not found" }, 404);
  await auditLog(c, "admin.access-mode", { actorId: auth.profile.id, targetId: c.req.param("id"), outcome: "success", note: mode });
  return c.json({ message: "Access mode updated", user: publicUserView(data as Profile) });
});

app.put(`${API_PREFIX}/admin/users/:id/calculator-access`, async (c) => {
  const auth = await requireSuperAdmin(c);
  if (!auth) return c.res;
  const parsed = await parseBody(c, Schemas.calculatorAccess);
  if (!parsed.ok) return parsed.response;
  const cleaned = Array.from(new Set(parsed.data.slugs.filter((s) => GRANTABLE_SLUGS.includes(s))));
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("profiles").update({
    calculator_access_mode: "CUSTOM", calculator_access: cleaned, updated_at: nowIso(),
  }).eq("id", c.req.param("id")).select("*").single();
  if (error || !data) return c.json({ error: "User not found" }, 404);
  await auditLog(c, "admin.calculator-access", { actorId: auth.profile.id, targetId: c.req.param("id"), outcome: "success" });
  return c.json({ message: "Calculator access updated", user: publicUserView(data as Profile) });
});

app.get(`${API_PREFIX}/admin/audit`, async (c) => {
  const auth = await requireSuperAdmin(c);
  if (!auth) return c.res;
  const limit = Math.min(Number(c.req.query("limit") ?? 100) || 100, 500);
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("audit_events")
    .select("id, event, actor_id, target_id, outcome, note, ip, created_at")
    .order("created_at", { ascending: false }).limit(limit);
  return c.json({ events: data ?? [] });
});

// ---- Account: export + delete (self) ----
app.get(`${API_PREFIX}/me/export`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.res;
  const admin = getSupabaseAdminClient();
  const { data: calculations } = await admin.from("calculations").select("*").eq("user_id", auth.uid);
  const { data: uploads } = await admin.from("file_uploads")
    .select("id, filename, content_type, size_bytes, created_at").eq("user_id", auth.uid);
  await auditLog(c, "privacy.export", { actorId: auth.uid, outcome: "success" });
  return c.json(
    { exportedAt: nowIso(), profile: publicUserView(auth.profile), calculations: calculations ?? [], uploads: uploads ?? [] },
    200,
    { "Content-Disposition": `attachment; filename="finratio-export-${auth.uid}.json"` },
  );
});

app.delete(`${API_PREFIX}/me`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.res;
  if (auth.profile.role === "SUPER_ADMIN") {
    return c.json({ error: "Transfer super-admin rights before deleting this account" }, 409);
  }
  // Delete the Firebase login (accounts:delete accepts the caller's own idToken).
  await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: auth.token }),
  });
  // No FK cascade to a Firebase user, so remove owned rows explicitly.
  const admin = getSupabaseAdminClient();
  await admin.from("calculations").delete().eq("user_id", auth.uid);
  await admin.from("file_uploads").delete().eq("user_id", auth.uid);
  await admin.from("profiles").delete().eq("id", auth.uid);
  await auditLog(c, "privacy.account-deleted", { outcome: "success", note: auth.uid });
  return c.json({ message: "Account deleted" });
});

// ---- AI proxy: keeps the OpenRouter key server-side ----
// Every provider below speaks the OpenAI chat-completions shape, so one body
// serves all three. Try the fastest managed route first, then cheaper/free
// fallbacks so users see first tokens sooner without losing resiliency.
function chatProviders() {
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
  const nvidiaKey = Deno.env.get("NVIDIA_API_KEY");
  const gatewayKey = Deno.env.get("AI_GATEWAY_API_KEY");

  return [
    gatewayKey && {
      name: "vercel-ai-gateway",
      url: "https://ai-gateway.vercel.sh/v1/chat/completions",
      key: gatewayKey,
      // Deliberately not a reasoning model: gpt-5-mini spends ~50s on hidden
      // reasoning tokens before it writes anything, which is far too slow for a
      // short summary. Flash answers the same prompt in under ten seconds.
      model: Deno.env.get("AI_GATEWAY_MODEL") || "google/gemini-2.5-flash",
      headers: {} as Record<string, string>,
    },
    nvidiaKey && {
      name: "nvidia",
      url: "https://integrate.api.nvidia.com/v1/chat/completions",
      key: nvidiaKey,
      // Not every NVIDIA-hosted model is warm; llama-3.3-70b routinely hangs
      // past 90s on the free tier, while this one answers in under a second.
      model: Deno.env.get("NVIDIA_MODEL_NAME") || "nvidia/llama-3.3-nemotron-super-49b-v1.5",
      headers: {} as Record<string, string>,
    },
    openRouterKey && {
      name: "openrouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: openRouterKey,
      model: Deno.env.get("OPENROUTER_MODEL_NAME") || "google/gemma-4-31b-it:free",
      headers: {
        "HTTP-Referer": ALLOWED_ORIGINS[0],
        "X-Title": "FinRatio",
      } as Record<string, string>,
    },
  ].filter(Boolean) as Array<{
    name: string; url: string; key: string; model: string; headers: Record<string, string>;
  }>;
}

app.post(`${API_PREFIX}/ai/chat`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.res;

  const providers = chatProviders();
  if (providers.length === 0) return c.json({ error: "AI is not configured" }, 503);

  const allowed = await validateRateLimit(`ai:${auth.uid}`, 60, 60 * 60 * 1000);
  if (!allowed) return c.json({ error: "AI request quota exceeded. Try again later." }, 429);

  if (Number(c.req.header("Content-Length") ?? 0) > MAX_AI_REQUEST_BYTES) {
    return c.json({ error: "Request too large" }, 413);
  }

  const parsed = await parseBody(c, Schemas.aiChat);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const payload = {
    messages: body.messages,
    stream: body.stream === true,
    ...(body.response_format ? { response_format: body.response_format } : {}),
    ...(typeof body.temperature === "number" ? { temperature: body.temperature } : {}),
    ...(typeof body.max_tokens === "number" ? { max_tokens: body.max_tokens } : {}),
  };

  let last: Response | null = null;
  for (const provider of providers) {
    let upstream: Response;
    try {
      upstream = await fetch(provider.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.key}`,
          "Content-Type": "application/json",
          ...provider.headers,
        },
        body: JSON.stringify({ ...payload, model: provider.model }),
        // Per provider, not per request: a cold model can hang indefinitely, and
        // failing over after 12s beats making the user wait out a long timeout -
        // every provider here normally answers well under that.
        signal: AbortSignal.timeout(12_000),
      });
    } catch (error) {
      // Network failure or timeout — treat like an outage and try the next one.
      console.error(`[ai/chat] ${provider.name} unreachable`, error);
      continue;
    }

    if (upstream.ok) {
      // Returning a raw Response replaces the one the CORS middleware decorated,
      // so the headers it set are lost unless they are repeated here. Without
      // them the browser rejects the reply even though the call succeeded.
      const headers: Record<string, string> = {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "no-store",
        "X-AI-Provider": provider.name,
        "Access-Control-Expose-Headers": "X-AI-Provider",
      };
      const origin = c.req.header("Origin");
      if (origin && isAllowedOrigin(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Access-Control-Allow-Credentials"] = "true";
        headers["Vary"] = "Origin";
      }
      return new Response(upstream.body, { status: 200, headers });
    }

    console.error(`[ai/chat] ${provider.name} error`, upstream.status);
    last = upstream;

    // 4xx other than throttling means the request itself is bad, so failing over
    // would just repeat it against another provider.
    if (upstream.status < 500 && upstream.status !== 429) break;
  }

  if (last && last.status === 429) {
    return c.json(
      { error: "Every AI provider is rate-limited right now. Please try again in a few seconds." },
      429,
      { "Retry-After": last.headers.get("Retry-After") ?? "10" },
    );
  }
  return c.json({ error: "AI request failed" }, 502);
});

// ---- User data. Supabase's Firebase third-party auth doesn't reliably map
// tokens to the authenticated role for PostgREST, so the client goes through
// here, where we verify the Firebase token ourselves and use the service role. ----
app.get(`${API_PREFIX}/me`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.res;
  return c.json({ user: publicUserView(auth.profile) });
});

app.put(`${API_PREFIX}/me`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.res;
  const parsed = await parseBody(c, Schemas.profileUpdate);
  if (!parsed.ok) return parsed.response;
  const patch: Record<string, unknown> = { updated_at: nowIso() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.businessConstitution !== undefined) patch.business_constitution = parsed.data.businessConstitution;
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("profiles").update(patch).eq("id", auth.uid).select("*").single();
  return c.json({ user: publicUserView((data ?? auth.profile) as Profile) });
});

app.post(`${API_PREFIX}/feedback`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.res;
  const parsed = await parseBody(c, Schemas.feedback);
  if (!parsed.ok) return parsed.response;
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("feedback").insert({
    user_id: auth.uid, user_email: auth.profile.email,
    type: parsed.data.type, message: parsed.data.message, rating: parsed.data.rating ?? null,
  }).select("*").single();
  if (error || !data) return c.json({ error: "Could not save feedback" }, 500);
  return c.json({ id: data.id, createdAt: data.created_at }, 201);
});

app.post(`${API_PREFIX}/onboarding`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.res;
  const parsed = await parseBody(c, Schemas.onboarding);
  if (!parsed.ok) return parsed.response;
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("profiles")
    .update({ business_constitution: parsed.data.businessConstitution, updated_at: nowIso() })
    .eq("id", auth.uid).select("*").single();
  return c.json({ user: publicUserView((data ?? auth.profile) as Profile) });
});

app.get(`${API_PREFIX}/calculations`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.res;
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("calculations").select("*")
    .eq("user_id", auth.uid).order("created_at", { ascending: false });
  return c.json({
    calculations: (data ?? []).map((r: any) => ({
      id: r.id, userId: r.user_id, calculatorType: r.calculator_type,
      inputs: r.inputs, results: r.results, createdAt: r.created_at,
    })),
  });
});

app.post(`${API_PREFIX}/calculations`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.res;
  const parsed = await parseBody(c, Schemas.calculation);
  if (!parsed.ok) return parsed.response;
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("calculations").insert({
    user_id: auth.uid, calculator_type: parsed.data.calculatorType,
    inputs: parsed.data.inputs, results: parsed.data.results,
  }).select("*").single();
  if (error || !data) return c.json({ error: "Could not save calculation" }, 500);
  return c.json({
    id: data.id, userId: data.user_id, calculatorType: data.calculator_type,
    inputs: data.inputs, results: data.results, createdAt: data.created_at,
  }, 201);
});

app.put(`${API_PREFIX}/calculations/:id`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.res;
  const parsed = await parseBody(c, Schemas.calculationUpdate);
  if (!parsed.ok) return parsed.response;
  if (!parsed.data.inputs && !parsed.data.results) {
    return c.json({ error: "Nothing to update" }, 400);
  }
  const admin = getSupabaseAdminClient();
  const patch: Record<string, unknown> = {};
  if (parsed.data.inputs) patch.inputs = parsed.data.inputs;
  if (parsed.data.results) patch.results = parsed.data.results;
  // Scoped by user_id, not just id, so a caller can't patch another user's
  // saved calculation by guessing/enumerating ids.
  const { data, error } = await admin.from("calculations").update(patch)
    .eq("id", c.req.param("id")).eq("user_id", auth.uid).select("*").single();
  if (error || !data) return c.json({ error: "Calculation not found" }, 404);
  return c.json({
    id: data.id, userId: data.user_id, calculatorType: data.calculator_type,
    inputs: data.inputs, results: data.results, createdAt: data.created_at,
  });
});

app.post(`${API_PREFIX}/uploads`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.res;
  const parsed = await parseBody(c, Schemas.upload);
  if (!parsed.ok) return parsed.response;
  const decoded = Math.floor((parsed.data.fileBase64.length * 3) / 4);
  if (decoded > 10 * 1024 * 1024) return c.json({ error: "File exceeds the 10 MB limit" }, 413);
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("file_uploads").insert({
    user_id: auth.uid, filename: parsed.data.filename,
    content_type: parsed.data.contentType ?? null, size_bytes: decoded,
    file_base64: parsed.data.fileBase64,
  }).select("id").single();
  if (error || !data) return c.json({ error: "Upload failed" }, 500);
  return c.json({ id: data.id }, 201);
});

Deno.serve(app.fetch);
