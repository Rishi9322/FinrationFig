import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { getCookie, setCookie, deleteCookie } from "npm:hono/cookie";
import { sign, verify } from "npm:hono/jwt";
import { createClient } from "npm:@supabase/supabase-js";
import bcrypt from "npm:bcryptjs";
import { parsePhoneNumberFromString } from "npm:libphonenumber-js";
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

const JWT_SECRET = Deno.env.get("JWT_SECRET") ?? "change-me-in-production";
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
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://finration-fig.vercel.app",
  ...(APP_ORIGIN ? APP_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean) : []),
];
const secureCookies = (Deno.env.get("COOKIE_SECURE") ?? "true") === "true";
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

app.use("*", logger(console.log));

// Simple CORS middleware - no credentials mode, so wildcard is safe
app.use("/*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
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

function getClientIpHeader(forwardedFor: string | undefined): string {
  if (!forwardedFor) return "unknown";
  const [first] = forwardedFor.split(",");
  return first.trim() || "unknown";
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
  const queryToken = c.req.query("sessionToken");
  if (queryToken) return queryToken;

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

  const session = await kv.get(`auth:session:${claims.sid}`) as SessionRecord | null;
  if (session && new Date(session.expiresAt) < new Date()) {
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
  const csrfHeader = c.req.header("X-CSRF-Token") || c.req.header("x-csrf-token") || c.req.query("csrfToken");

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
    <p style="font-size:34px;letter-spacing:8px;font-weight:700;color:#0b3b86">${otp}</p>
    <p>This code expires in 5 minutes.</p>
    <p>If you did not request this, please ignore this email.</p>
  </div>`;
  await sendEmail({ to: email, subject: `FinRatio verification code: ${otp}`, html });
}

async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto">
    <h2 style="color:#0b3b86">Reset your FinRatio password</h2>
    <p>Use the link below to reset your password. It expires in 15 minutes.</p>
    <p><a href="${resetUrl}" style="display:inline-block;background:#0b3b86;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Reset Password</a></p>
    <p>If you did not request a password reset, you can ignore this email.</p>
  </div>`;
  await sendEmail({ to: email, subject: "FinRatio password reset", html });
}

async function sendAccessGrantedEmail(email: string, grantedFeatures: string[]): Promise<void> {
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto">
    <h2 style="color:#0b3b86">New FinRatio calculator access granted</h2>
    <p>Your account now has access to:</p>
    <ul>${grantedFeatures.map((f) => `<li>${f}</li>`).join("")}</ul>
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

    const body = await c.req.json();
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
    const body = await c.req.json();
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

    const body = await c.req.json();
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
    const body = await c.req.json();
    const email = lowerEmail(body.email || "");
    const password = body.password || "";

    const loginKey = `signin:${ip}:${email}`;
    const attemptsAllowed = await validateRateLimit(loginKey, 10, 15 * 60 * 1000);
    if (!attemptsAllowed) return c.json({ error: "Too many attempts. Try again later." }, 429);

    const user = await getUserByEmail(email);
    if (!user) return c.json({ error: "Invalid email or password" }, 401);

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
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

    const body = await c.req.json();
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

    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "http://localhost:5173";
    const resetUrl = `${appBaseUrl}/auth/reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(email)}`;
    
    // Try to send email, but don't fail if it doesn't work
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (emailError) {
      console.warn("[auth/forgot-password] Email send failed:", emailError);
      // Still store the reset token so user can manually use it if needed
      console.log("[auth/forgot-password] Reset URL for debugging:", resetUrl);
    }

    return c.json({ message: "If this email is registered, a reset link has been sent." });
  } catch (error) {
    console.error("[auth/forgot-password]", error);
    return c.json({ error: "An error occurred. Please try again." }, 500);
  }
});

app.post(`${API_PREFIX}/auth/reset-password`, async (c) => {
  try {
    const body = await c.req.json();
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

    const body = await c.req.json();
    const calculatorType = String(body.calculatorType || "");
    const inputs = body.inputs ?? {};
    const results = body.results ?? {};

    if (!calculatorType) {
      return c.json({ error: "calculatorType is required" }, 400);
    }

    const access = await getUserFeatureAccess(auth.user.id);
    const isPrivileged = auth.user.role === "SUPER_ADMIN" || auth.user.role === "ADMIN";
    if (!isPrivileged && !access.includes(calculatorType)) {
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

    const body = await c.req.json();
    const filename = String(body.filename || "").trim();
    const contentType = typeof body.contentType === "string" ? body.contentType : null;
    const sizeBytes = Number(body.sizeBytes);
    const fileBase64 = String(body.fileBase64 || "");

    if (!filename || !fileBase64) {
      return c.json({ error: "filename and fileBase64 are required" }, 400);
    }

    const record = {
      id: crypto.randomUUID(),
      user_id: auth.user.id,
      filename,
      content_type: contentType,
      size_bytes: Number.isFinite(sizeBytes) ? Math.round(sizeBytes) : null,
      file_base64: fileBase64,
      created_at: nowIso(),
    };

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("file_uploads").insert(record);
    if (error) throw error;

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

    const body = await c.req.json();
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

  const body = await c.req.json();
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
  return c.json({ message: "Role updated", user: publicUserView(user, access) });
});

app.post(`${API_PREFIX}/admin/users`, async (c) => {
  const auth = await requireAuth(c);
  if (!auth) return c.body(null, 401);
  if (!(await requireCsrfForMutation(c, auth))) return c.body(null, 403);
  if (auth.user.role !== "SUPER_ADMIN") return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json();
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

  const body = await c.req.json();
  user.status = body.suspended ? "SUSPENDED" : "ACTIVE";
  user.updatedAt = nowIso();
  await saveUser(user);

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

  const body = await c.req.json();
  const accessMode: AccessMode = body.accessMode === "FULL" ? "FULL" : "CUSTOM";
  user.calculatorAccessMode = accessMode;
  user.updatedAt = nowIso();
  await saveUser(user);

  if (accessMode === "FULL" || isPrivilegedRole(user.role)) {
    await setUserFeatureAccess(user.id, await getCatalogFeatureSlugs());
  }

  const access = await getPublicCalculatorAccess(user);
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

  const body = await c.req.json();
  const slugs = Array.isArray(body.slugs) ? body.slugs.filter((slug: unknown) => typeof slug === "string") : [];
  const cleaned = Array.from(new Set(slugs.filter((slug) => validSlugs.has(slug))));

  user.calculatorAccessMode = "CUSTOM";
  user.updatedAt = nowIso();
  await saveUser(user);

  await setUserFeatureAccess(user.id, cleaned);
  await sendAccessGrantedEmail(user.email, cleaned);

  const updatedAccess = await getPublicCalculatorAccess(user);
  return c.json({ message: "Calculator access updated", user: publicUserView(user, updatedAccess) });
});

app.get(`${API_PREFIX}/resend/api-keys`, (c) => c.json([]));
app.post(`${API_PREFIX}/resend/api-keys`, (c) => c.json({ success: true }));
app.delete(`${API_PREFIX}/resend/api-keys/:id`, (c) => c.json({ success: true }));

// Test endpoint for email delivery verification
app.post(`${API_PREFIX}/test/send-email`, async (c) => {
  try {
    const { to } = await c.req.json();

    if (!to || typeof to !== "string" || !to.includes("@")) {
      return c.json({ error: "Invalid recipient email" }, 400);
    }

    if (!RESEND_API_KEY) {
      return c.json({ error: "RESEND_API_KEY not configured" }, 500);
    }

    const testHtml = `
      <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;padding:20px">
        <h2 style="color:#0b3b86">FinRatio Test Email</h2>
        <p>This is a test email to verify your Resend integration is working correctly.</p>
        <div style="background:#f0f0f0;padding:15px;border-radius:5px;margin:20px 0">
          <p><strong>Sender:</strong> ${RESEND_FROM_EMAIL}</p>
          <p><strong>Recipient:</strong> ${to}</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        </div>
        <p>If you received this email, your email configuration is working correctly!</p>
      </div>
    `;

    await sendEmail({
      to,
      subject: "FinRatio Test Email Verification",
      html: testHtml,
    });

    return c.json({
      success: true,
      message: "Test email sent successfully",
      details: {
        from: RESEND_FROM_EMAIL,
        to,
        subject: "FinRatio Test Email Verification",
      },
    });
  } catch (error) {
    console.error("Test email error:", error);
    return c.json(
      {
        error: "Failed to send test email",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

Deno.serve(app.fetch);
