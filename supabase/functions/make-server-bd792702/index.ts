import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { getCookie, setCookie, deleteCookie } from "npm:hono/cookie";
import { sign, verify } from "npm:hono/jwt";
import { createClient } from "npm:@supabase/supabase-js";
import bcrypt from "npm:bcryptjs";
import { parsePhoneNumberFromString } from "npm:libphonenumber-js";
import { z } from "npm:zod";
import * as kv from "./kv_store.tsx";

type Role = "SUPER_ADMIN" | "ADMIN" | "USER";
type AccountStatus = "ACTIVE" | "SUSPENDED";
type AccessMode = "FULL" | "CUSTOM";

type UserRecord = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  passwordHash: string;
  role: Role;
  status: AccountStatus;
  isVerified: boolean;
  calculatorAccessMode: AccessMode;
  otpCode: string | null;
  otpExpiry: string | null;
  otpAttempts: number;
  resetTokenHash: string | null;
  resetTokenExpiry: string | null;
  createdAt: string;
  updatedAt: string;
  businessConstitution?: string;
};

type SessionRecord = {
  sessionId: string;
  userId: string;
  csrfTokenHash: string;
  expiresAt: string;
};

type CalculatorFeature = {
  id: string;
  slug: string;
  name: string;
  description?: string;
};

type StoredCalculation = {
  id: string;
  userId: string;
  calculatorType: string;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
  createdAt: string;
};

type RateLimitState = {
  count: number;
  windowStart: string;
};

type AuthClaims = {
  sub: string;
  sid: string;
  role: Role;
  exp: number;
};

const app = new Hono();

const API_PREFIX = "/make-server-bd792702";
const OTP_TTL_MS = 5 * 60 * 1000;
const RESET_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const DEFAULT_FEATURE_SLUG = "pid";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".docx", ".csv", ".xlsx", ".xls", ".txt"];
const MAX_AI_REQUEST_BYTES = 256 * 1024;

const JWT_SECRET = Deno.env.get("JWT_SECRET") ?? "";
if (JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set to at least 32 characters. Refusing to start.");
}
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") ?? "deepak.poddar@finratio.sbs";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN");
const ADMIN_EMAIL = lowerEmail(Deno.env.get("ADMIN_EMAIL") ?? "");
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") ?? "";
const ADMIN_NAME = Deno.env.get("ADMIN_NAME") ?? "FinRatio Admin";
const ADMIN_PHONE_NUMBER = Deno.env.get("ADMIN_PHONE_NUMBER") ?? "";
const ALLOWED_ORIGINS = [
  "https://finration-fig.vercel.app",
  ...(APP_ORIGIN ? APP_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean) : []),
];
const secureCookies = (Deno.env.get("COOKIE_SECURE") ?? "true") === "true";

// Vite picks the next free port when 5173 is taken, so dev origins are matched by
// pattern rather than listed - but only behind an explicit opt-in that must never
// be set on the production deployment.
const allowDevOrigins = Deno.env.get("ALLOW_DEV_ORIGINS") === "true";

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return allowDevOrigins && /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/.test(origin);
}
const sessionCookieName = secureCookies ? "__Host-finratio_session" : "finratio_session";
const csrfCookieName = secureCookies ? "__Host-finratio_csrf" : "finratio_csrf";

const CALCULATOR_FEATURES: CalculatorFeature[] = [
  { id: crypto.randomUUID(), slug: "debt-equity", name: "Debt-to-Equity Ratio" },
  { id: crypto.randomUUID(), slug: "quasi-debt-equity", name: "Quasi Debt-to-Equity Ratio" },
  { id: crypto.randomUUID(), slug: "current-ratio", name: "Current Ratio" },
  { id: crypto.randomUUID(), slug: "dscr", name: "Debt Service Coverage Ratio" },
  { id: crypto.randomUUID(), slug: "ebitda", name: "EBITDA" },
  { id: crypto.randomUUID(), slug: "iscr", name: "Interest Service Coverage Ratio" },
  { id: crypto.randomUUID(), slug: "net-working-capital", name: "Net Working Capital" },
  { id: crypto.randomUUID(), slug: "drawing-power", name: "Drawing Power" },
  { id: crypto.randomUUID(), slug: "ageing", name: "Receivables Ageing Analysis" },
  { id: crypto.randomUUID(), slug: "pid", name: "Purchase Invoice Discounting" },
  { id: crypto.randomUUID(), slug: "valuation", name: "Business Valuation" },
  { id: crypto.randomUUID(), slug: "working-capital-cycle", name: "Working Capital Cycle" },
];

// Log method + path only. Never the query string (it can carry tokens) or bodies.
app.use("*", async (c, next) => {
  await next();
  console.log(`${c.req.method} ${new URL(c.req.url).pathname} ${c.res.status}`);
});

// Exact-origin allowlist. Requests from unknown origins get no CORS headers.
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
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-Session-Token");
  c.header("Access-Control-Max-Age", "600");
  c.header("Access-Control-Expose-Headers", "Content-Length");

  // Handle OPTIONS requests
  if (c.req.method === "OPTIONS") {
    return c.json({}, 200);
  }

  await next();
});

// Request schemas. Every mutating route parses its body through one of these, so
// unbounded strings, wrong types and unexpected fields never reach handler logic.
const emailField = z.string().trim().min(3).max(254);
const passwordField = z.string().min(1).max(200);

const Schemas = {
  signup: z.object({
    name: z.string().trim().min(1).max(120),
    email: emailField,
    phoneNumber: z.string().trim().min(1).max(32),
    password: passwordField,
    confirmPassword: passwordField,
  }),
  verifyOtp: z.object({ email: emailField, otp: z.string().trim().regex(/^\d{6}$/) }),
  emailOnly: z.object({ email: emailField }),
  signin: z.object({ email: emailField, password: passwordField }),
  resetPassword: z.object({
    email: emailField,
    token: z.string().regex(/^[0-9a-f]{64}$/),
    password: passwordField,
    confirmPassword: passwordField,
  }),
  onboarding: z.object({ businessConstitution: z.string().trim().min(1).max(200) }),
  calculation: z.object({
    calculatorType: z.string().trim().min(1).max(64),
    inputs: z.record(z.string(), z.unknown()).default({}),
    results: z.record(z.string(), z.unknown()).default({}),
  }),
  upload: z.object({
    filename: z.string().trim().min(1).max(255),
    contentType: z.string().max(255).nullish(),
    // 4/3 accounts for base64 expansion; the decoded size is re-checked in the handler.
    fileBase64: z.string().min(1).max(Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 4),
  }),
  adminCreateUser: z.object({
    name: z.string().trim().min(1).max(120),
    email: emailField,
    phoneNumber: z.string().trim().min(1).max(32),
    password: passwordField,
    role: z.enum(["SUPER_ADMIN", "ADMIN", "USER"]).optional(),
    calculatorAccessMode: z.enum(["FULL", "CUSTOM"]).optional(),
    calculatorAccess: z.array(z.string().max(64)).max(100).optional(),
  }),
  role: z.object({ role: z.enum(["SUPER_ADMIN", "ADMIN", "USER"]) }),
  accessMode: z.object({ accessMode: z.enum(["FULL", "CUSTOM"]) }),
  calculatorAccess: z.object({ slugs: z.array(z.string().max(64)).max(100) }),
  suspend: z.object({ suspended: z.boolean() }),
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

type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: Response };

async function parseBody<T>(c: any, schema: z.ZodType<T>): Promise<ParsedBody<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return { ok: false, response: c.json({ error: "Invalid JSON body" }, 400) };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    // Report which fields failed, never the submitted values.
    const fields = result.error.issues.map((issue) => issue.path.join(".")).filter(Boolean);
    return { ok: false, response: c.json({ error: "Invalid request", fields }, 400) };
  }

  return { ok: true, data: result.data };
}

/**
 * Append-only security audit trail. Records who did what, never what was said -
 * no passwords, tokens, file contents or financial values are ever passed here.
 * ponytail: KV list capped at 1000 events; move to a table when you need queries.
 */
async function auditLog(
  c: any,
  event: string,
  detail: { actorId?: string; targetId?: string; outcome: "success" | "failure"; note?: string },
): Promise<void> {
  const ip = getClientIpHeader(c.req.header("x-forwarded-for"));

  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("audit_events").insert({
      event,
      actor_id: detail.actorId ?? null,
      target_id: detail.targetId ?? null,
      outcome: detail.outcome,
      note: detail.note ?? null,
      ip,
    });
    if (error) throw error;
    return;
  } catch (error) {
    console.warn("[audit] database write failed, falling back to KV:", error);
  }

  try {
    const entry = { id: crypto.randomUUID(), event, at: nowIso(), ip, ...detail };
    const existing = await kv.get("audit:events");
    const events = Array.isArray(existing) ? existing : [];
    await kv.set("audit:events", [entry, ...events].slice(0, 1000));
  } catch (error) {
    // Auditing must never break the request it is recording.
    console.error("[audit] write failed", error);
  }
}

function getClientIpHeader(forwardedFor: string | undefined): string {
  if (!forwardedFor) return "unknown";
  // Take the LAST entry: it is appended by the edge proxy in front of us and is
  // the only one a client cannot spoof. The first entry is caller-controlled.
  const parts = forwardedFor.split(",").map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] || "unknown";
}

function nowIso(): string {
  return new Date().toISOString();
}

function lowerEmail(email: string): string {
  return email.trim().toLowerCase();
}

function randomSixDigitOtp(): string {
  return Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
}

function randomTokenHex(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(hash);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (isBcryptHash(hash)) {
    return bcrypt.compare(password, hash);
  }

  return sha256Hex(password).then((legacyHash) => legacyHash === hash);
}

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 10
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password)
  );
}

function isPrivilegedRole(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

function normalizePhoneNumber(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const normalizedEmail = lowerEmail(email);
  const user = await kv.get(`user:by-email:${normalizedEmail}`);
  if (user) return normalizeUserRecord(user, normalizedEmail);

  const legacyUser = await kv.get(`user:${normalizedEmail}`);
  if (!legacyUser) return null;

  const migratedUser = normalizeUserRecord(legacyUser, normalizedEmail);
  await saveUser(migratedUser);
  const access = await getUserFeatureAccess(migratedUser.id);
  if (access.length === 0) await applyDefaultCalculatorAccess(migratedUser.id);
  return migratedUser;
}

async function getUserById(userId: string): Promise<UserRecord | null> {
  const email = await kv.get(`user:by-id:${userId}`);
  if (!email) return null;
  return getUserByEmail(email);
}

async function saveUser(user: UserRecord): Promise<void> {
  const keys = [`user:by-email:${user.email}`, `user:by-id:${user.id}`];
  const values: unknown[] = [user, user.email];

  if (user.phoneNumber) {
    keys.push(`user:by-phone:${user.phoneNumber}`);
    values.push(user.email);
  }

  await kv.mset(keys, values);
}

function normalizeUserRecord(value: any, fallbackEmail = ""): UserRecord {
  const email = lowerEmail(value?.email || fallbackEmail);
  const createdAt = value?.createdAt || nowIso();

  return {
    id: value?.id || crypto.randomUUID(),
    name: value?.name || email,
    email,
    phoneNumber: value?.phoneNumber || "",
    passwordHash: value?.passwordHash || "",
    role: ["SUPER_ADMIN", "ADMIN", "USER"].includes(value?.role) ? value.role : "USER",
    status: ["ACTIVE", "SUSPENDED"].includes(value?.status) ? value.status : "ACTIVE",
    isVerified: Boolean(value?.isVerified),
    calculatorAccessMode: value?.calculatorAccessMode === "FULL" ? "FULL" : "CUSTOM",
    otpCode: value?.otpCode ?? null,
    otpExpiry: value?.otpExpiry ?? null,
    otpAttempts: Number.isFinite(value?.otpAttempts) ? value.otpAttempts : 0,
    resetTokenHash: value?.resetTokenHash ?? null,
    resetTokenExpiry: value?.resetTokenExpiry ?? null,
    createdAt,
    updatedAt: value?.updatedAt || createdAt,
    businessConstitution: value?.businessConstitution,
  };
}

async function ensureFeaturesCatalog(): Promise<void> {
  const existing = await kv.get("feature:catalog");
  if (!Array.isArray(existing) || existing.length === 0) {
    await kv.set("feature:catalog", CALCULATOR_FEATURES);
  }
}

async function ensureBootstrapAdmin(): Promise<void> {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;

  if (!isStrongPassword(ADMIN_PASSWORD)) {
    console.error("[bootstrap-admin] ADMIN_PASSWORD does not meet password policy");
    return;
  }

  const existing = await getUserByEmail(ADMIN_EMAIL);
  const now = nowIso();
  const user: UserRecord = existing
    ? {
        ...existing,
        name: existing.name || ADMIN_NAME,
        phoneNumber: existing.phoneNumber || ADMIN_PHONE_NUMBER,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        isVerified: true,
        updatedAt: now,
      }
    : {
        id: crypto.randomUUID(),
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        phoneNumber: ADMIN_PHONE_NUMBER,
        passwordHash: "",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        isVerified: true,
        calculatorAccessMode: "FULL",
        otpCode: null,
        otpExpiry: null,
        otpAttempts: 0,
        resetTokenHash: null,
        resetTokenExpiry: null,
        createdAt: now,
        updatedAt: now,
      };

  if (!existing || !isBcryptHash(user.passwordHash) || !(await bcrypt.compare(ADMIN_PASSWORD, user.passwordHash))) {
    user.passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  }

  user.calculatorAccessMode = "FULL";

  await ensureFeaturesCatalog();
  await saveUser(user);
  await setUserFeatureAccess(user.id, CALCULATOR_FEATURES.map((feature) => feature.slug));
}

async function getUserFeatureAccess(userId: string): Promise<string[]> {
  const access = await kv.get(`user:calculator-access:${userId}`);
  if (!Array.isArray(access)) return [];
  return access.filter((slug: unknown) => typeof slug === "string");
}

async function setUserFeatureAccess(userId: string, slugs: string[]): Promise<void> {
  await kv.set(`user:calculator-access:${userId}`, Array.from(new Set(slugs)).sort());
}

async function applyDefaultCalculatorAccess(userId: string): Promise<void> {
  await setUserFeatureAccess(userId, [DEFAULT_FEATURE_SLUG]);
}

async function getCatalogFeatureSlugs(): Promise<string[]> {
  await ensureFeaturesCatalog();
  const features = await kv.get("feature:catalog");

  if (!Array.isArray(features)) {
    return CALCULATOR_FEATURES.map((feature) => feature.slug);
  }

  return features
    .map((feature: any) => feature?.slug)
    .filter((slug: unknown): slug is string => typeof slug === "string");
}

async function getPublicCalculatorAccess(user: UserRecord): Promise<string[]> {
  if (isPrivilegedRole(user.role) || user.calculatorAccessMode === "FULL") {
    return getCatalogFeatureSlugs();
  }

  return getUserFeatureAccess(user.id);
}

async function createUserRecord(params: {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: Role;
  calculatorAccessMode: AccessMode;
  calculatorAccess: string[];
}): Promise<UserRecord> {
  const now = nowIso();
  const user: UserRecord = {
    id: crypto.randomUUID(),
    name: params.name,
    email: params.email,
    phoneNumber: params.phoneNumber,
    passwordHash: await bcrypt.hash(params.password, 12),
    role: params.role,
    status: "ACTIVE",
    isVerified: true,
    calculatorAccessMode: params.calculatorAccessMode,
    otpCode: null,
    otpExpiry: null,
    otpAttempts: 0,
    resetTokenHash: null,
    resetTokenExpiry: null,
    createdAt: now,
    updatedAt: now,
  };

  await saveUser(user);

  if (params.calculatorAccessMode === "FULL" || isPrivilegedRole(params.role)) {
    await setUserFeatureAccess(user.id, await getCatalogFeatureSlugs());
  } else {
    await setUserFeatureAccess(user.id, params.calculatorAccess);
  }

  return user;
}

function authCookieOptions(maxAgeMs = SESSION_TTL_MS) {
  return {
    path: "/",
    secure: secureCookies,
    httpOnly: true,
    sameSite: (secureCookies ? "None" : "Lax") as "None" | "Lax",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

function csrfCookieOptions(maxAgeMs = SESSION_TTL_MS) {
  return {
    path: "/",
    secure: secureCookies,
    httpOnly: false,
    sameSite: (secureCookies ? "None" : "Lax") as "None" | "Lax",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

type AuthSessionResult = {
  sessionToken: string;
  csrfToken: string;
};

async function setAuthSessionCookies(c: any, user: UserRecord): Promise<AuthSessionResult> {
  const sessionId = crypto.randomUUID();
  const csrfToken = randomTokenHex(24);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const claims: AuthClaims = {
    sub: user.id,
    sid: sessionId,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + Math.floor(SESSION_TTL_MS / 1000),
  };

  const jwt = await sign(claims, JWT_SECRET);
  const sessionRecord: SessionRecord = {
    sessionId,
    userId: user.id,
    csrfTokenHash: await sha256Hex(csrfToken),
    expiresAt,
  };

  await kv.set(`auth:session:${sessionId}`, sessionRecord);

  setCookie(c, sessionCookieName, jwt, authCookieOptions());
  setCookie(c, csrfCookieName, csrfToken, csrfCookieOptions());

  return { sessionToken: jwt, csrfToken };
}

async function clearAuthSessionCookies(c: any): Promise<void> {
  const cookieToken = getCookie(c, sessionCookieName) || getSessionTokenFromRequest(c);
  if (cookieToken) {
    try {
      const claims = await verify(cookieToken, JWT_SECRET, "HS256") as AuthClaims;
      await kv.del(`auth:session:${claims.sid}`);
    } catch {
      // ignore bad token on logout
    }
  }

  deleteCookie(c, sessionCookieName, { path: "/" });
  deleteCookie(c, csrfCookieName, { path: "/" });
}

async function validateRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  // Preferred path: one atomic statement in Postgres, so concurrent requests
  // cannot race between reading and writing the counter.
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: Math.ceil(windowMs / 1000),
    });
    if (!error && typeof data === "boolean") return data;
    if (error) throw error;
  } catch (error) {
    console.warn("[rate-limit] falling back to KV:", error);
  }

  // ponytail: KV fallback is read-modify-write and therefore racy. It exists only
  // so a database outage degrades to a weak limit instead of no limit at all.
  const state = await kv.get(`rate:${key}`) as RateLimitState | null;
  const now = Date.now();

  if (!state) {
    await kv.set(`rate:${key}`, { count: 1, windowStart: nowIso() });
    return true;
  }

  const start = new Date(state.windowStart).getTime();
  if (now - start > windowMs) {
    await kv.set(`rate:${key}`, { count: 1, windowStart: nowIso() });
    return true;
  }

  if (state.count >= limit) {
    return false;
  }

  await kv.set(`rate:${key}`, { count: state.count + 1, windowStart: state.windowStart });
  return true;
}

function getSessionTokenFromRequest(c: any): string | undefined {
  // Deliberately no query-string support: URLs leak into logs, history and referrers.
  const explicitToken = c.req.header("X-Session-Token") || c.req.header("x-session-token");
  if (explicitToken) return explicitToken;

  const authorization = c.req.header("Authorization") || c.req.header("authorization") || "";
  const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearerToken && bearerToken !== publicAnonAuthorizationToken()) return bearerToken;
  return undefined;
}

function publicAnonAuthorizationToken(): string {
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

function getSupabaseAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase admin configuration is missing");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function requireAuth(c: any): Promise<{ user: UserRecord; claims: AuthClaims } | null> {
  const token = getCookie(c, sessionCookieName) || getSessionTokenFromRequest(c);
  if (!token) {
    c.status(401);
    c.json({ error: "Unauthorized" });
    return null;
  }

  let claims: AuthClaims;
  try {
    claims = await verify(token, JWT_SECRET, "HS256") as AuthClaims;
  } catch {
    c.status(401);
    c.json({ error: "Invalid session" });
    return null;
  }

  // A valid signature is not enough: the session must still exist server-side,
  // belong to the same user, and not be expired. This is what makes logout and
  // revocation actually revoke.
  const session = await kv.get(`auth:session:${claims.sid}`) as SessionRecord | null;
  if (!session || session.userId !== claims.sub || new Date(session.expiresAt) < new Date()) {
    c.status(401);
    c.json({ error: "Session expired" });
    return null;
  }

  const user = await getUserById(claims.sub);
  if (!user) {
    c.status(401);
    c.json({ error: "User not found" });
    return null;
  }

  if (user.status === "SUSPENDED") {
    c.status(403);
    c.json({ error: "Account suspended" });
    return null;
  }

  return { user, claims };
}

async function requireCsrfForMutation(c: any, auth: { claims: AuthClaims }): Promise<boolean> {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method)) return true;

  const session = await kv.get(`auth:session:${auth.claims.sid}`) as SessionRecord | null;
  const csrfCookie = getCookie(c, csrfCookieName);
  const csrfHeader = c.req.header("X-CSRF-Token") || c.req.header("x-csrf-token");

  if (!csrfHeader) {
    c.status(403);
    c.json({ error: "CSRF validation failed" });
    return false;
  }

  if (csrfCookie && csrfCookie !== csrfHeader) {
    c.status(403);
    c.json({ error: "CSRF validation failed" });
    return false;
  }

  const tokenHash = await sha256Hex(csrfHeader);
  if (session && tokenHash !== session.csrfTokenHash) {
    c.status(403);
    c.json({ error: "CSRF validation failed" });
    return false;
  }

  return true;
}

function publicUserView(user: UserRecord, featureAccess: string[]) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    status: user.status,
    isVerified: user.isVerified,
    calculatorAccessMode: user.calculatorAccessMode,
    createdAt: user.createdAt,
    calculatorAccess: featureAccess,
    businessConstitution: user.businessConstitution,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("[sendEmail] RESEND_API_KEY not configured. Email would have been sent to:", params.to);
    console.warn("[sendEmail] Subject:", params.subject);
    // Don't throw error - allow the app to work without email in development
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `FinRatio <${RESEND_FROM_EMAIL}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Email send failed: ${body}`);
  }
}

async function sendVerificationOtpEmail(email: string, otp: string): Promise<void> {
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto">
    <h2 style="color:#0b3b86">FinRatio Email Verification</h2>
    <p>Your one-time verification code is:</p>
    <p style="font-size:34px;letter-spacing:8px;font-weight:700;color:#0b3b86">${escapeHtml(otp)}</p>
    <p>This code expires in 5 minutes.</p>
    <p>If you did not request this, please ignore this email.</p>
  </div>`;
  await sendEmail({ to: email, subject: `FinRatio verification code: ${otp}`, html });
}

async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto">
    <h2 style="color:#0b3b86">Reset your FinRatio password</h2>
    <p>Use the link below to reset your password. It expires in 15 minutes.</p>
    <p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#0b3b86;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Reset Password</a></p>
    <p>If you did not request a password reset, you can ignore this email.</p>
  </div>`;
  await sendEmail({ to: email, subject: "FinRatio password reset", html });
}

async function sendAccessGrantedEmail(email: string, grantedFeatures: string[]): Promise<void> {
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto">
    <h2 style="color:#0b3b86">New FinRatio calculator access granted</h2>
    <p>Your account now has access to:</p>
    <ul>${grantedFeatures.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
    <p>Sign in to use your newly enabled calculators.</p>
  </div>`;
  await sendEmail({ to: email, subject: "FinRatio calculator access updated", html });
}

async function getCalculationsForUser(userId: string): Promise<StoredCalculation[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("calculations")
      .select("id, user_id, calculator_type, inputs, results, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      return data.map((row: any) => ({
        id: String(row.id),
        userId: String(row.user_id),
        calculatorType: String(row.calculator_type),
        inputs: (row.inputs ?? {}) as Record<string, unknown>,
        results: (row.results ?? {}) as Record<string, unknown>,
        createdAt: String(row.created_at),
      }));
    }
  } catch (error) {
    console.warn("[calculations:get] falling back to KV storage:", error);
  }

  const calculations = await kv.get(`calculations:${userId}`);
  return Array.isArray(calculations) ? calculations : [];
}

async function saveCalculationRecord(calculation: StoredCalculation): Promise<void> {
  const calculations = await getCalculationsForUser(calculation.userId);
  const next = [calculation, ...calculations.filter((item) => item.id !== calculation.id)].slice(0, 200);

  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("calculations").upsert({
      id: calculation.id,
      user_id: calculation.userId,
      calculator_type: calculation.calculatorType,
      inputs: calculation.inputs,
      results: calculation.results,
      created_at: calculation.createdAt,
    }, { onConflict: "id" });

    if (error) throw error;
  } catch (error) {
    console.error("[calculations:post] database write failed, falling back to KV:", error);
  }

  await kv.set(`calculations:${calculation.userId}`, next);
}

app.get(`${API_PREFIX}/health`, async (c) => {
  await ensureFeaturesCatalog();
  await ensureBootstrapAdmin();
  return c.json({ status: "ok" });
});

app.post(`${API_PREFIX}/auth/signup`, async (c) => {
  try {
    const ip = getClientIpHeader(c.req.header("x-forwarded-for"));
    const allowed = await validateRateLimit(`signup:${ip}`, 10, 15 * 60 * 1000);
    if (!allowed) return c.json({ error: "Too many signup attempts" }, 429);

    const parsed = await parseBody(c, Schemas.signup);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const name = (body.name || "").trim();
    const email = lowerEmail(body.email || "");
    const phoneRaw = (body.phoneNumber || "").trim();
    const password = body.password || "";
    const confirmPassword = body.confirmPassword || "";

    if (!name || !email || !phoneRaw || !password || !confirmPassword) {
      return c.json({ error: "All fields are required" }, 400);
    }

    if (!isStrongPassword(password)) {
      return c.json({ error: "Password must be 10+ chars with upper/lower/number/symbol" }, 400);
    }

    if (password !== confirmPassword) {
      return c.json({ error: "Passwords do not match" }, 400);
    }

    const phoneNumber = normalizePhoneNumber(phoneRaw);
    if (!phoneNumber) {
      return c.json({ error: "Invalid phone number" }, 400);
    }

    if (await getUserByEmail(email)) {
      return c.json({ error: "Email already registered" }, 409);
    }

    const existingPhoneOwner = await kv.get(`user:by-phone:${phoneNumber}`);
    if (existingPhoneOwner) {
      return c.json({ error: "Phone number already registered" }, 409);
    }

    const otp = randomSixDigitOtp();
    const user: UserRecord = {
      id: crypto.randomUUID(),
      name,
      email,
      phoneNumber,
      passwordHash: await bcrypt.hash(password, 12),
      role: "USER",
      status: "ACTIVE",
      isVerified: false,
      calculatorAccessMode: "CUSTOM",
      otpCode: otp,
      otpExpiry: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      otpAttempts: 0,
      resetTokenHash: null,
      resetTokenExpiry: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await ensureFeaturesCatalog();
    await saveUser(user);
    await applyDefaultCalculatorAccess(user.id);

    await sendVerificationOtpEmail(user.email, otp);

    return c.json({ message: "Signup successful. Verify your email OTP.", email: user.email }, 201);
  } catch (error) {
    console.error("[auth/signup]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

app.post(`${API_PREFIX}/auth/verify-otp`, async (c) => {
  try {
    const parsed = await parseBody(c, Schemas.verifyOtp);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const email = lowerEmail(body.email || "");
    const otp = String(body.otp || "").trim();

    const user = await getUserByEmail(email);
    if (!user) return c.json({ error: "User not found" }, 404);
    if (user.status === "SUSPENDED") return c.json({ error: "Account suspended" }, 403);

    if (user.isVerified) {
      const access = await getPublicCalculatorAccess(user);
      const session = await setAuthSessionCookies(c, user);
      return c.json({ message: "Already verified", user: publicUserView(user, access), session });
    }

    if (!/^\d{6}$/.test(otp)) {
      return c.json({ error: "OTP must be 6 digits" }, 400);
    }

    if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
      return c.json({ error: "Too many attempts. Request a new OTP." }, 429);
    }

    if (!user.otpExpiry || new Date(user.otpExpiry) < new Date()) {
      return c.json({ error: "OTP expired. Request a new OTP." }, 400);
    }

    if (user.otpCode !== otp) {
      user.otpAttempts += 1;
      user.updatedAt = nowIso();
      await saveUser(user);
      return c.json({ error: "Invalid OTP" }, 400);
    }

    user.isVerified = true;
    user.otpCode = null;
    user.otpExpiry = null;
    user.otpAttempts = 0;
    user.updatedAt = nowIso();
    await saveUser(user);

    const access = await getPublicCalculatorAccess(user);
    const session = await setAuthSessionCookies(c, user);

    return c.json({ message: "Email verified", user: publicUserView(user, access), session });
  } catch (error) {
    console.error("[auth/verify-otp]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

app.post(`${API_PREFIX}/auth/resend-otp`, async (c) => {
  try {
    const ip = getClientIpHeader(c.req.header("x-forwarded-for"));
    const allowed = await validateRateLimit(`resend-otp:${ip}`, 8, 15 * 60 * 1000);
    if (!allowed) return c.json({ error: "Too many OTP requests" }, 429);

    const parsed = await parseBody(c, Schemas.emailOnly);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const email = lowerEmail(body.email || "");
    const user = await getUserByEmail(email);

    if (!user) return c.json({ error: "User not found" }, 404);
    if (user.isVerified) return c.json({ message: "Already verified" });

    const otp = randomSixDigitOtp();
    user.otpCode = otp;
    user.otpExpiry = new Date(Date.now() + OTP_TTL_MS).toISOString();
    user.otpAttempts = 0;
    user.updatedAt = nowIso();
    await saveUser(user);

    await sendVerificationOtpEmail(user.email, otp);

    return c.json({ message: "OTP resent" });
  } catch (error) {
    console.error("[auth/resend-otp]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

app.post(`${API_PREFIX}/auth/signin`, async (c) => {
  try {
    await ensureBootstrapAdmin();

    const ip = getClientIpHeader(c.req.header("x-forwarded-for"));
    const parsed = await parseBody(c, Schemas.signin);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const email = lowerEmail(body.email || "");
    const password = body.password || "";

    const loginKey = `signin:${ip}:${email}`;
    const attemptsAllowed = await validateRateLimit(loginKey, 10, 15 * 60 * 1000);
    if (!attemptsAllowed) return c.json({ error: "Too many attempts. Try again later." }, 429);

    const user = await getUserByEmail(email);
    if (!user) return c.json({ error: "Invalid email or password" }, 401);

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      await auditLog(c, "auth.signin", { actorId: user.id, outcome: "failure", note: "bad-password" });
      return c.json({ error: "Invalid email or password" }, 401);
    }

    if (!isBcryptHash(user.passwordHash)) {
      user.passwordHash = await bcrypt.hash(password, 12);
      user.updatedAt = nowIso();
      await saveUser(user);
    }

    if (user.status === "SUSPENDED") return c.json({ error: "Account suspended" }, 403);

    if (!user.isVerified) {
      return c.json({ error: "Please verify your email first", needsVerification: true }, 403);
    }

    const access = await getPublicCalculatorAccess(user);
    const session = await setAuthSessionCookies(c, user);

    await auditLog(c, "auth.signin", { actorId: user.id, outcome: "success" });
    return c.json({ message: "Signin successful", user: publicUserView(user, access), session });
  } catch (error) {
    console.error("[auth/signin]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

app.post(`${API_PREFIX}/auth/forgot-password`, async (c) => {
  try {
    const ip = getClientIpHeader(c.req.header("x-forwarded-for"));
    const allowed = await validateRateLimit(`forgot:${ip}`, 8, 15 * 60 * 1000);
    if (!allowed) return c.json({ error: "Too many requests" }, 429);

    const parsed = await parseBody(c, Schemas.emailOnly);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const email = lowerEmail(body.email || "");
    const user = await getUserByEmail(email);

    // Always return success-like response to avoid account enumeration.
    if (!user) {
      return c.json({ message: "If this email is registered, a reset link has been sent." });
    }

    const resetToken = randomTokenHex(32);
    user.resetTokenHash = await sha256Hex(resetToken);
    user.resetTokenExpiry = new Date(Date.now() + RESET_TTL_MS).toISOString();
    user.updatedAt = nowIso();
    await saveUser(user);

    // The reset link must point at an origin we control, or we hand attackers a
    // token-delivery redirect.
    const configuredBaseUrl = Deno.env.get("APP_BASE_URL") || "";
    const appBaseUrl = isAllowedOrigin(configuredBaseUrl) ? configuredBaseUrl : ALLOWED_ORIGINS[ALLOWED_ORIGINS.length - 1];
    const resetUrl = `${appBaseUrl}/auth/reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(email)}`;
    
    // Try to send email, but don't fail if it doesn't work
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (emailError) {
      // Never log the reset URL or token - logs would become a credential store.
      console.warn("[auth/forgot-password] Email send failed for user", user.id, emailError);
    }

    return c.json({ message: "If this email is registered, a reset link has been sent." });
  } catch (error) {
    console.error("[auth/forgot-password]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

app.post(`${API_PREFIX}/auth/reset-password`, async (c) => {
  try {
    const parsed = await parseBody(c, Schemas.resetPassword);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const email = lowerEmail(body.email || "");
    const token = String(body.token || "");
    const password = body.password || "";
    const confirmPassword = body.confirmPassword || "";

    if (!token || !password || !confirmPassword) {
      return c.json({ error: "Invalid request" }, 400);
    }

    if (!isStrongPassword(password)) {
      return c.json({ error: "Password must be 10+ chars with upper/lower/number/symbol" }, 400);
    }

    if (password !== confirmPassword) {
      return c.json({ error: "Passwords do not match" }, 400);
    }

    const user = await getUserByEmail(email);
    if (!user || !user.resetTokenHash || !user.resetTokenExpiry) {
      return c.json({ error: "Invalid or expired reset token" }, 400);
    }

    if (new Date(user.resetTokenExpiry) < new Date()) {
      return c.json({ error: "Reset token expired" }, 400);
    }

    const tokenHash = await sha256Hex(token);
    if (tokenHash !== user.resetTokenHash) {
      return c.json({ error: "Invalid or expired reset token" }, 400);
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetTokenHash = null;
    user.resetTokenExpiry = null;
    user.updatedAt = nowIso();
    await saveUser(user);

    await clearAuthSessionCookies(c);

    await auditLog(c, "auth.password-reset", { actorId: user.id, outcome: "success" });
    return c.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("[auth/reset-password]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

app.post(`${API_PREFIX}/auth/logout`, async (c) => {
  await clearAuthSessionCookies(c);
  return c.json({ message: "Signed out" });
});

app.get(`${API_PREFIX}/auth/me`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.body(null, 401);

  const access = await getPublicCalculatorAccess(auth.user);
  return c.json({ user: publicUserView(auth.user, access) });
});

// Subject access request: everything held about the caller, in one download.
app.get(`${API_PREFIX}/me/export`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.body(null, 401);

  const { passwordHash: _p, otpCode: _o, resetTokenHash: _r, ...profile } = auth.user;
  const calculations = await getCalculationsForUser(auth.user.id);
  const access = await getUserFeatureAccess(auth.user.id);

  let uploads: unknown[] = [];
  try {
    const supabase = getSupabaseAdminClient();
    // Metadata only - the document bytes are excluded to keep the export usable.
    const { data } = await supabase
      .from("file_uploads")
      .select("id, filename, content_type, size_bytes, created_at")
      .eq("user_id", auth.user.id);
    uploads = data ?? [];
  } catch (error) {
    console.warn("[me/export] upload metadata unavailable:", error);
  }

  await auditLog(c, "privacy.export", { actorId: auth.user.id, outcome: "success" });

  return c.json(
    { exportedAt: nowIso(), profile, calculatorAccess: access, calculations, uploads },
    200,
    { "Content-Disposition": `attachment; filename="finratio-export-${auth.user.id}.json"` },
  );
});

// Account deletion. Removes the user everywhere we hold them; the database
// cascades handle calculations, uploads, access grants and sessions.
app.delete(`${API_PREFIX}/me`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.body(null, 401);
  if (!(await requireCsrfForMutation(c, auth))) return c.body(null, 403);

  // A super-admin deleting themselves could leave the deployment unadministrable.
  if (auth.user.role === "SUPER_ADMIN") {
    return c.json({ error: "Transfer super-admin rights before deleting this account" }, 409);
  }

  const { id, email, phoneNumber } = auth.user;

  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("app_users").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.warn("[me:delete] database delete failed, continuing with KV:", error);
  }

  await kv.del(`user:by-email:${email}`);
  await kv.del(`user:by-id:${id}`);
  if (phoneNumber) await kv.del(`user:by-phone:${phoneNumber}`);
  await kv.del(`user:${email}`);
  await kv.del(`calculations:${id}`);
  await kv.del(`uploads:${id}`);
  await kv.del(`user:calculator-access:${id}`);

  await clearAuthSessionCookies(c);
  // actorId is intentionally omitted: the row it referenced no longer exists.
  await auditLog(c, "privacy.account-deleted", { outcome: "success", note: id });

  return c.json({ message: "Account deleted" });
});

app.get(`${API_PREFIX}/features`, async (c) => {
  await ensureFeaturesCatalog();
  const features = await kv.get("feature:catalog");
  return c.json({ features: Array.isArray(features) ? features : [] });
});

app.get(`${API_PREFIX}/calculations/:userId`, async (c) => {
  try {
    const auth = await requireAuth(c);
    if (!auth) return c.body(null, 401);

    const targetUserId = c.req.param("userId");
    const isPrivileged = auth.user.role === "SUPER_ADMIN" || auth.user.role === "ADMIN";
    if (!isPrivileged && targetUserId !== auth.user.id) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const calculations = await getCalculationsForUser(targetUserId);
    return c.json({ calculations });
  } catch (error) {
    console.error("[calculations:get]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

app.post(`${API_PREFIX}/calculations`, async (c) => {
  try {
    const auth = await requireAuth(c);
    if (!auth) return c.body(null, 401);
    if (!(await requireCsrfForMutation(c, auth))) return c.body(null, 403);

    const parsed = await parseBody(c, Schemas.calculation);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const calculatorType = String(body.calculatorType || "");
    const inputs = body.inputs ?? {};
    const results = body.results ?? {};

    if (!calculatorType) {
      return c.json({ error: "calculatorType is required" }, 400);
    }

    const access = await getUserFeatureAccess(auth.user.id);
    const isPrivileged = auth.user.role === "SUPER_ADMIN" || auth.user.role === "ADMIN";
    // "cma-document" stores saved CMA analyses (not a gated calculator feature) -
    // any authenticated user may save/read their own documents.
    if (!isPrivileged && calculatorType !== "cma-document" && !access.includes(calculatorType)) {
      return c.json({ error: "Access restricted" }, 403);
    }

    const record: StoredCalculation = {
      id: crypto.randomUUID(),
      userId: auth.user.id,
      calculatorType,
      inputs,
      results,
      createdAt: nowIso(),
    };

    await saveCalculationRecord(record);
    return c.json(record, 201);
  } catch (error) {
    console.error("[calculations:post]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

app.post(`${API_PREFIX}/uploads`, async (c) => {
  try {
    const auth = await requireAuth(c);
    if (!auth) return c.body(null, 401);
    if (!(await requireCsrfForMutation(c, auth))) return c.body(null, 403);

    const parsed = await parseBody(c, Schemas.upload);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const filename = String(body.filename || "").trim();
    const contentType = typeof body.contentType === "string" ? body.contentType : null;
    const fileBase64 = String(body.fileBase64 || "");

    if (!filename || !fileBase64) {
      return c.json({ error: "filename and fileBase64 are required" }, 400);
    }

    // Client-reported sizeBytes is untrusted; measure the payload we actually got.
    const decodedBytes = Math.floor((fileBase64.length * 3) / 4);
    if (decodedBytes > MAX_UPLOAD_BYTES) {
      return c.json({ error: `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit` }, 413);
    }

    if (!ALLOWED_UPLOAD_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(ext))) {
      return c.json({ error: "Unsupported file type" }, 415);
    }

    const record = {
      id: crypto.randomUUID(),
      user_id: auth.user.id,
      filename,
      content_type: contentType,
      size_bytes: decodedBytes,
      file_base64: fileBase64,
      created_at: nowIso(),
    };

    try {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase.from("file_uploads").insert(record);
      if (error) throw error;
    } catch (dbError) {
      console.warn("[uploads:post] database write failed, falling back to KV:", dbError);
      const existingUploads = await kv.get(`uploads:${auth.user.id}`);
      const uploads = Array.isArray(existingUploads) ? existingUploads : [];
      const nextUploads = [record, ...uploads.filter((item: any) => item?.id !== record.id)].slice(0, 100);
      await kv.set(`uploads:${auth.user.id}`, nextUploads);
    }

    return c.json({ id: record.id }, 201);
  } catch (error) {
    console.error("[uploads:post]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

app.post(`${API_PREFIX}/auth/onboarding`, async (c) => {
  try {
    const auth = await requireAuth(c);
    if (!auth) return c.body(null, 401);
    if (!(await requireCsrfForMutation(c, auth))) return c.body(null, 403);

    const parsed = await parseBody(c, Schemas.onboarding);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const businessConstitution = (body.businessConstitution || "").trim();

    if (!businessConstitution) {
      return c.json({ error: "Business constitution is required" }, 400);
    }

    auth.user.businessConstitution = businessConstitution;
    auth.user.updatedAt = nowIso();
    await saveUser(auth.user);

    const access = await getUserFeatureAccess(auth.user.id);
    return c.json({ message: "Onboarding completed", user: publicUserView(auth.user, access) });
  } catch (error) {
    console.error("[auth/onboarding]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

app.get(`${API_PREFIX}/admin/users`, async (c) => {
  await ensureBootstrapAdmin();

  const auth = await requireAuth(c);
  if (!auth) return c.body(null, 401);
  if (auth.user.role !== "SUPER_ADMIN") return c.json({ error: "Forbidden" }, 403);

  const users = await kv.getByPrefix("user:by-email:") as UserRecord[];
  const rows = await Promise.all(users.map(async (user) => {
    const access = await getPublicCalculatorAccess(user);
    return publicUserView(user, access);
  }));

  return c.json({ users: rows.sort((a, b) => a.createdAt > b.createdAt ? -1 : 1) });
});

app.put(`${API_PREFIX}/admin/users/:id/role`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.body(null, 401);
  if (!(await requireCsrfForMutation(c, auth))) return c.body(null, 403);
  if (auth.user.role !== "SUPER_ADMIN") return c.json({ error: "Forbidden" }, 403);

  const user = await getUserById(c.req.param("id"));
  if (!user) return c.json({ error: "User not found" }, 404);

  const parsed = await parseBody(c, Schemas.role);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const role = body.role as Role;
  if (!["SUPER_ADMIN", "ADMIN", "USER"].includes(role)) {
    return c.json({ error: "Invalid role" }, 400);
  }

  user.role = role;
  if (isPrivilegedRole(role)) {
    user.calculatorAccessMode = "FULL";
    await setUserFeatureAccess(user.id, await getCatalogFeatureSlugs());
  }
  user.updatedAt = nowIso();
  await saveUser(user);

  const access = await getPublicCalculatorAccess(user);
  await auditLog(c, "admin.role-change", { actorId: auth.user.id, targetId: user.id, outcome: "success", note: role });
  return c.json({ message: "Role updated", user: publicUserView(user, access) });
});

app.post(`${API_PREFIX}/admin/users`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.body(null, 401);
  if (!(await requireCsrfForMutation(c, auth))) return c.body(null, 403);
  if (auth.user.role !== "SUPER_ADMIN") return c.json({ error: "Forbidden" }, 403);

  const parsed = await parseBody(c, Schemas.adminCreateUser);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const name = String(body.name || "").trim();
  const email = lowerEmail(String(body.email || ""));
  const phoneRaw = String(body.phoneNumber || "").trim();
  const password = String(body.password || "");
  const role = ["SUPER_ADMIN", "ADMIN", "USER"].includes(body.role) ? body.role as Role : "USER";
  const calculatorAccessMode = body.calculatorAccessMode === "FULL" ? "FULL" : "CUSTOM";

  if (!name || !email || !phoneRaw || !password) {
    return c.json({ error: "Name, email, phone number, and password are required" }, 400);
  }

  if (!isStrongPassword(password)) {
    return c.json({ error: "Password must be 10+ chars with upper/lower/number/symbol" }, 400);
  }

  const phoneNumber = normalizePhoneNumber(phoneRaw);
  if (!phoneNumber) {
    return c.json({ error: "Invalid phone number" }, 400);
  }

  if (await getUserByEmail(email)) {
    return c.json({ error: "Email already registered" }, 409);
  }

  const existingPhoneOwner = await kv.get(`user:by-phone:${phoneNumber}`);
  if (existingPhoneOwner) {
    return c.json({ error: "Phone number already registered" }, 409);
  }

  await ensureFeaturesCatalog();
  const features = await kv.get("feature:catalog") as CalculatorFeature[];
  const validSlugs = new Set(Array.isArray(features) ? features.map((feature) => feature.slug) : CALCULATOR_FEATURES.map((feature) => feature.slug));
  const access = Array.isArray(body.calculatorAccess)
    ? Array.from(new Set(body.calculatorAccess.filter((slug: unknown) => typeof slug === "string" && validSlugs.has(slug))))
    : [];

  const resolvedAccess = calculatorAccessMode === "FULL"
    ? await getCatalogFeatureSlugs()
    : access.length > 0
      ? access
      : [DEFAULT_FEATURE_SLUG];

  const user = await createUserRecord({
    name,
    email,
    phoneNumber,
    password,
    role,
    calculatorAccessMode: calculatorAccessMode === "FULL" || isPrivilegedRole(role) ? "FULL" : "CUSTOM",
    calculatorAccess: resolvedAccess,
  });

  const publicView = await publicUserView(user, await getPublicCalculatorAccess(user));
  return c.json({ message: "User created", user: publicView }, 201);
});

app.put(`${API_PREFIX}/admin/users/:id/suspend`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.body(null, 401);
  if (!(await requireCsrfForMutation(c, auth))) return c.body(null, 403);
  if (auth.user.role !== "SUPER_ADMIN") return c.json({ error: "Forbidden" }, 403);

  const user = await getUserById(c.req.param("id"));
  if (!user) return c.json({ error: "User not found" }, 404);

  const parsed = await parseBody(c, Schemas.suspend);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  user.status = body.suspended ? "SUSPENDED" : "ACTIVE";
  user.updatedAt = nowIso();
  await saveUser(user);
  await auditLog(c, "admin.suspend", { actorId: auth.user.id, targetId: user.id, outcome: "success", note: user.status });

  const access = await getPublicCalculatorAccess(user);
  return c.json({ message: "Status updated", user: publicUserView(user, access) });
});

app.put(`${API_PREFIX}/admin/users/:id/access-mode`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.body(null, 401);
  if (!(await requireCsrfForMutation(c, auth))) return c.body(null, 403);
  if (auth.user.role !== "SUPER_ADMIN") return c.json({ error: "Forbidden" }, 403);

  const user = await getUserById(c.req.param("id"));
  if (!user) return c.json({ error: "User not found" }, 404);

  const parsed = await parseBody(c, Schemas.accessMode);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const accessMode: AccessMode = body.accessMode === "FULL" ? "FULL" : "CUSTOM";
  user.calculatorAccessMode = accessMode;
  user.updatedAt = nowIso();
  await saveUser(user);

  if (accessMode === "FULL" || isPrivilegedRole(user.role)) {
    await setUserFeatureAccess(user.id, await getCatalogFeatureSlugs());
  }

  const access = await getPublicCalculatorAccess(user);
  await auditLog(c, "admin.access-mode", { actorId: auth.user.id, targetId: user.id, outcome: "success", note: accessMode });
  return c.json({ message: "Access mode updated", user: publicUserView(user, access) });
});

app.put(`${API_PREFIX}/admin/users/:id/calculator-access`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.body(null, 401);
  if (!(await requireCsrfForMutation(c, auth))) return c.body(null, 403);
  if (auth.user.role !== "SUPER_ADMIN") return c.json({ error: "Forbidden" }, 403);

  const user = await getUserById(c.req.param("id"));
  if (!user) return c.json({ error: "User not found" }, 404);

  await ensureFeaturesCatalog();
  const features = await kv.get("feature:catalog") as CalculatorFeature[];
  const validSlugs = new Set(features.map((f) => f.slug));

  const parsed = await parseBody(c, Schemas.calculatorAccess);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const slugs = Array.isArray(body.slugs) ? body.slugs.filter((slug: unknown) => typeof slug === "string") : [];
  const cleaned = Array.from(new Set(slugs.filter((slug) => validSlugs.has(slug))));

  user.calculatorAccessMode = "CUSTOM";
  user.updatedAt = nowIso();
  await saveUser(user);

  await setUserFeatureAccess(user.id, cleaned);
  await sendAccessGrantedEmail(user.email, cleaned);

  const updatedAccess = await getPublicCalculatorAccess(user);
  await auditLog(c, "admin.calculator-access", { actorId: auth.user.id, targetId: user.id, outcome: "success" });
  return c.json({ message: "Calculator access updated", user: publicUserView(user, updatedAccess) });
});

// An audit trail nobody can read is not a control. Super-admins only.
app.get(`${API_PREFIX}/admin/audit`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.body(null, 401);
  if (auth.user.role !== "SUPER_ADMIN") return c.json({ error: "Forbidden" }, 403);

  const limit = Math.min(Number(c.req.query("limit") ?? 100) || 100, 500);

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("audit_events")
      .select("id, event, actor_id, target_id, outcome, note, ip, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return c.json({ events: data ?? [] });
  } catch (error) {
    console.warn("[admin/audit] falling back to KV:", error);
    const events = await kv.get("audit:events");
    return c.json({ events: Array.isArray(events) ? events.slice(0, limit) : [] });
  }
});

// AI proxy. The OpenRouter key stays server-side; the browser never sees it.
// The client sends only `messages` (+ optional response_format/temperature/stream);
// model selection and all provider headers are decided here.
app.post(`${API_PREFIX}/ai/chat`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.body(null, 401);
  if (!(await requireCsrfForMutation(c, auth))) return c.body(null, 403);

  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openRouterKey) return c.json({ error: "AI is not configured" }, 503);

  const allowed = await validateRateLimit(`ai:${auth.user.id}`, 60, 60 * 60 * 1000);
  if (!allowed) return c.json({ error: "AI request quota exceeded. Try again later." }, 429);

  if (Number(c.req.header("Content-Length") ?? 0) > MAX_AI_REQUEST_BYTES) {
    return c.json({ error: "Request too large" }, 413);
  }

  const parsed = await parseBody(c, Schemas.aiChat);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const messages = body.messages;

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
      messages,
      stream: body.stream === true,
      ...(body.response_format ? { response_format: body.response_format } : {}),
      ...(typeof body.temperature === "number" ? { temperature: body.temperature } : {}),
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!upstream.ok) {
    // Never echo the provider body: it can carry key hints and account details.
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

Deno.serve(app.fetch);
