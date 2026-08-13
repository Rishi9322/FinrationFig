import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js";
import { z } from "npm:zod";
import { jwtVerify, createRemoteJWKSet } from "npm:jose";

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
  "debt-equity", "quasi-debt-equity", "current-ratio", "dscr", "ebitda", "iscr",
  "net-working-capital", "drawing-power", "ageing", "pid", "valuation", "working-capital-cycle",
];
const DEFAULT_FEATURE_SLUG = "pid";

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
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
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
  calculation: z.object({
    calculatorType: z.string().trim().min(1).max(64),
    inputs: z.record(z.string(), z.unknown()).default({}),
    results: z.record(z.string(), z.unknown()).default({}),
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

// Verify the caller's Firebase ID token, then load their profile (the authority
// on role/status). Auto-provisions a default USER profile if none exists yet.
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
  } catch (_e) {
    c.status(401); c.res = c.json({ error: "Invalid session" }); return null;
  }

  const admin = getSupabaseAdminClient();
  let { data: profile } = await admin.from("profiles").select("*").eq("id", uid).single();
  if (!profile) {
    const insert = await admin.from("profiles")
      .insert({ id: uid, email: email.toLowerCase(), name: name || email.split("@")[0] })
      .select("*").single();
    profile = insert.data;
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

function resolvedAccess(p: Profile): string[] {
  return p.role === "SUPER_ADMIN" || p.role === "ADMIN" || p.calculator_access_mode === "FULL"
    ? CALCULATOR_SLUGS
    : p.calculator_access ?? [];
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
    : (body.calculatorAccess ?? []).filter((s) => CALCULATOR_SLUGS.includes(s));

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
  const cleaned = Array.from(new Set(parsed.data.slugs.filter((s) => CALCULATOR_SLUGS.includes(s))));
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
app.post(`${API_PREFIX}/ai/chat`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.res;

  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openRouterKey) return c.json({ error: "AI is not configured" }, 503);

  const allowed = await validateRateLimit(`ai:${auth.uid}`, 60, 60 * 60 * 1000);
  if (!allowed) return c.json({ error: "AI request quota exceeded. Try again later." }, 429);

  if (Number(c.req.header("Content-Length") ?? 0) > MAX_AI_REQUEST_BYTES) {
    return c.json({ error: "Request too large" }, 413);
  }

  const parsed = await parseBody(c, Schemas.aiChat);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      "HTTP-Referer": ALLOWED_ORIGINS[ALLOWED_ORIGINS.length - 1],
      "X-Title": "FinRatio",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENROUTER_MODEL_NAME") || "anthropic/claude-3.5-sonnet",
      messages: body.messages,
      stream: body.stream === true,
      ...(body.response_format ? { response_format: body.response_format } : {}),
      ...(typeof body.temperature === "number" ? { temperature: body.temperature } : {}),
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!upstream.ok) {
    console.error("[ai/chat] upstream error", upstream.status);
    return c.json({ error: "AI request failed" }, upstream.status === 429 ? 429 : 502);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
});

// ---- User data. Supabase's Firebase third-party auth doesn't reliably map
// tokens to the authenticated role for PostgREST, so the client goes through
// here, where we verify the Firebase token ourselves and use the service role. ----
app.get(`${API_PREFIX}/me`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.res;
  return c.json({ user: publicUserView(auth.profile) });
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
