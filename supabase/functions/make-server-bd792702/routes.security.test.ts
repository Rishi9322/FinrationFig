// A guard against the commonest way an API grows a hole: a new route added without the login / role check.
// It reads the function's source, finds every route, and checks the first thing each one does.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(__dirname, "index.ts"), "utf8");

type Route = { method: string; path: string; head: string };
const routes: Route[] = [];
const re = /^app\.(get|post|put|patch|delete)\(`\$\{API_PREFIX\}([^`]*)`/gm;
const found = [...source.matchAll(re)];
found.forEach((m, i) => {
  // the route's own handler: up to the next route, and no more than its first 900 characters
  const start = m.index ?? 0;
  const end = Math.min(found[i + 1]?.index ?? source.length, start + 900);
  routes.push({ method: m[1].toUpperCase(), path: m[2], head: source.slice(start, end) });
});

// Routes that are public on purpose (everything else must authenticate).
const PUBLIC = new Set(["/health", "/blog", "/blog/:slug", "/news", "/auth/phone/send-otp", "/auth/phone/verify-otp"]);

describe("every API route checks who is calling", () => {
  it("finds the routes (so this test cannot pass by matching nothing)", () => {
    expect(routes.length).toBeGreaterThan(30);
  });

  it("admin routes require an admin role", () => {
    const admin = routes.filter((r) => r.path.startsWith("/admin/"));
    expect(admin.length).toBeGreaterThan(10);
    const open = admin.filter((r) => !/requireSuperAdmin\(c\)|requireAdmin\(c\)/.test(r.head));
    expect(open.map((r) => `${r.method} ${r.path}`)).toEqual([]);
  });

  it("every other non-public route requires a signed-in caller", () => {
    const open = routes
      .filter((r) => !PUBLIC.has(r.path) && !r.path.startsWith("/admin/"))
      .filter((r) => !/requireAuth\(c\)/.test(r.head));
    expect(open.map((r) => `${r.method} ${r.path}`)).toEqual([]);
  });

  it("the public list is exactly the routes that do not authenticate (nothing on it is accidentally protected or forgotten)", () => {
    const unauthenticated = routes.filter((r) => !/requireAuth\(c\)|requireSuperAdmin\(c\)|requireAdmin\(c\)/.test(r.head)).map((r) => r.path);
    expect(new Set(unauthenticated)).toEqual(PUBLIC);
  });
});

describe("the costly and sensitive routes are limited", () => {
  const rate = (p: string) => routes.find((r) => r.path === p)!.head;
  it.each([
    ["/ai/chat", /validateRateLimit\(`ai:/],
    ["/uploads", /validateRateLimit\(`upload:/],
    ["/calculations", /validateRateLimit\(`calc-save:/],
    ["/feedback", /validateRateLimit\(`feedback:/],
    ["/events", /validateRateLimit\(`events:/],
  ])("%s has a per-account limit", (p, pattern) => {
    expect(source.slice(source.indexOf("`${API_PREFIX}" + p + "`"), source.indexOf("`${API_PREFIX}" + p + "`") + 1800)).toMatch(pattern);
    expect(rate(p)).toBeTruthy();
  });

  it("the phone OTP sender is limited per number AND per address (it needs no sign-in and sends paid messages)", () => {
    const block = source.slice(source.indexOf("`${API_PREFIX}/auth/phone/send-otp`"), source.indexOf("`${API_PREFIX}/auth/phone/send-otp`") + 1200);
    expect(block).toMatch(/phone-otp:\$\{phone\}/);
    expect(block).toMatch(/phone-otp-ip:/);
  });
});

describe("a profile (and so access) can only be created through the invite check or by an admin", () => {
  it("the only inserts into profiles are the invite path and the admin create route", () => {
    const writes = [...source.matchAll(/from\("profiles"\)\s*\.\s*(insert|upsert)\(/g)].length;
    expect(writes).toBe(2);
  });
  it("the invite path runs before the profile insert", () => {
    const redeem = source.indexOf("redeemInviteForSignup(inviteCode");
    const insert = source.search(/from\("profiles"\)\s*\.insert\(/);
    expect(redeem).toBeGreaterThan(0);
    expect(insert).toBeGreaterThan(redeem);
  });
});
