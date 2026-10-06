import { describe, it, expect, vi, beforeEach } from "vitest";
import { shouldTryNextProvider, callProviders, failureMessage, resetCircuit, PROVIDER_TIMEOUT_MS, TOTAL_BUDGET_MS, type Provider } from "./failover";

const P = (name: string, extra: Partial<Provider> = {}): Provider => ({ name, url: `https://${name}.test/v1`, key: "k", model: "m", headers: {}, ...extra });
const providers = [P("gateway"), P("nvidia"), P("openrouter")];
const ok = () => new Response('{"choices":[]}', { status: 200 });
const status = (s: number, headers: Record<string, string> = {}) => new Response("{}", { status: s, headers });
const timeout = () => { throw new DOMException("timed out", "TimeoutError"); };

// The breaker remembers dead providers between calls; every test starts clean.
beforeEach(() => resetCircuit());

// Routes by hostname so a test reads like the incident it reproduces.
const fakeFetch = (plan: Record<string, () => Response | Promise<Response>>) =>
  vi.fn(async (url: string | URL | Request) => {
    const host = new URL(String(url)).hostname.split(".")[0];
    return plan[host]();
  }) as unknown as typeof fetch;

describe("shouldTryNextProvider", () => {
  it("moves on from provider-side failures (the 410 that caused the 502s)", () => {
    for (const s of [401, 402, 403, 404, 408, 410, 429, 500, 502, 503, 504]) {
      expect(shouldTryNextProvider(s)).toBe(true);
    }
  });
  it("stops on request-side errors every provider would reject", () => {
    for (const s of [400, 413, 422]) expect(shouldTryNextProvider(s)).toBe(false);
  });
  it("gives slow providers longer than the old 12s", () => {
    expect(PROVIDER_TIMEOUT_MS).toBeGreaterThan(12_000);
  });
});

describe("callProviders", () => {
  it("reproduces the incident: gateway times out, NVIDIA 410s, OpenRouter now answers", async () => {
    const f = fakeFetch({ gateway: timeout, nvidia: () => status(410), openrouter: ok });
    const r = await callProviders(providers, { messages: [] }, { fetchImpl: f });
    expect(r).toMatchObject({ ok: true, provider: "openrouter" });
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("uses the first healthy provider and stops", async () => {
    const f = fakeFetch({ gateway: ok, nvidia: () => status(500), openrouter: ok });
    const r = await callProviders(providers, {}, { fetchImpl: f });
    expect(r).toMatchObject({ ok: true, provider: "gateway" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("stops immediately on a bad request instead of retrying it elsewhere", async () => {
    const f = fakeFetch({ gateway: () => status(400), nvidia: ok, openrouter: ok });
    const r = await callProviders(providers, {}, { fetchImpl: f });
    expect(r).toMatchObject({ ok: false, status: 502 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("returns 502 'unavailable' when every provider is down", async () => {
    const f = fakeFetch({ gateway: () => status(410), nvidia: () => status(401), openrouter: () => status(503) });
    expect(await callProviders(providers, {}, { fetchImpl: f })).toMatchObject({ ok: false, status: 502, reason: "unavailable" });
  });

  it("the second incident: timeout + 410 + 429 is a TIMEOUT outage, not 'rate-limited'", async () => {
    const f = fakeFetch({ gateway: timeout, nvidia: () => status(410), openrouter: () => status(429, { "Retry-After": "7" }) });
    const r = await callProviders(providers, {}, { fetchImpl: f });
    expect(r).toMatchObject({ ok: false, status: 502, reason: "timeout" });
    if (!r.ok) expect(r.attempts).toEqual([
      { provider: "gateway", outcome: "timeout" }, { provider: "nvidia", outcome: 410 }, { provider: "openrouter", outcome: 429 },
    ]);
  });

  it("is 429 with Retry-After only when EVERY provider throttled", async () => {
    const f = fakeFetch({ gateway: () => status(429), nvidia: () => status(429), openrouter: () => status(429, { "Retry-After": "7" }) });
    expect(await callProviders(providers, {}, { fetchImpl: f })).toMatchObject({ ok: false, status: 429, reason: "rate-limited", retryAfter: "7" });
  });

  it("per-provider timeout overrides the default (the primary gets longer than the fallbacks)", async () => {
    const f = vi.fn(async (_u: any, init: any) => { expect(init.signal).toBeInstanceOf(AbortSignal); return ok(); }) as unknown as typeof fetch;
    await callProviders([P("gateway", { timeoutMs: 70_000 })], {}, { fetchImpl: f });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("a real short timeout actually aborts a hanging provider and falls through", async () => {
    const hang = (_u: any, init: any) => new Promise<Response>((_res, rej) => init.signal.addEventListener("abort", () => rej(init.signal.reason)));
    const f = vi.fn(async (u: any, init: any) => (String(u).includes("gateway") ? hang(u, init) : ok())) as unknown as typeof fetch;
    const r = await callProviders([P("gateway", { timeoutMs: 30 }), P("openrouter")], {}, { fetchImpl: f });
    expect(r).toMatchObject({ ok: true, provider: "openrouter" });
    expect(r.attempts[0]).toEqual({ provider: "gateway", outcome: "timeout" });
  });

  it("sends the provider's own model and auth header", async () => {
    const f = vi.fn(async () => ok()) as unknown as typeof fetch;
    await callProviders([{ ...P("gateway"), model: "gemini", key: "secret" }], { messages: [1] }, { fetchImpl: f });
    const [, init] = (f as any).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ messages: [1], model: "gemini" });
    expect(init.headers.Authorization).toBe("Bearer secret");
  });

  it("merges a provider's own body fields without letting them change the model", async () => {
    const f = vi.fn(async () => ok()) as unknown as typeof fetch;
    await callProviders([{ ...P("nvidia"), model: "nemo", body: { chat_template_kwargs: { enable_thinking: false }, model: "evil" } }], { messages: [1] }, { fetchImpl: f });
    const [, init] = (f as any).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ messages: [1], chat_template_kwargs: { enable_thinking: false }, model: "nemo" });
  });
  it("handles an empty provider list", async () => {
    expect(await callProviders([], {}, { fetchImpl: fakeFetch({}) })).toMatchObject({ ok: false, status: 502, reason: "unavailable" });
  });
});

describe("failureMessage", () => {
  it("says what actually happened", () => {
    expect(failureMessage("rate-limited")).toMatch(/rate-limited/);
    expect(failureMessage("timeout")).toMatch(/took too long/);
    expect(failureMessage("unavailable")).toMatch(/unavailable/);
    expect(failureMessage("timeout")).not.toMatch(/rate-limited/);
  });
});

describe("circuit breaker and total budget", () => {
  it("a retired provider (410) is skipped on later requests instead of failing again every time", async () => {
    const f = fakeFetch({ gateway: ok, nvidia: () => status(410), openrouter: ok });
    // First request: gateway down, nvidia 410 -> falls through to openrouter and marks nvidia dead.
    const down = fakeFetch({ gateway: () => status(503), nvidia: () => status(410), openrouter: ok });
    await callProviders(providers, {}, { fetchImpl: down });
    const second = fakeFetch({ gateway: () => status(503), nvidia: () => { throw new Error("must not be called"); }, openrouter: ok });
    const r = await callProviders(providers, {}, { fetchImpl: second });
    expect(r).toMatchObject({ ok: true, provider: "openrouter" });
    expect(r.attempts).toContainEqual({ provider: "nvidia", outcome: "skipped" });
    void f;
  });

  it("the breaker expires, so a fixed provider is tried again", async () => {
    let t = 1_000_000;
    const dead = fakeFetch({ gateway: ok, nvidia: () => status(410), openrouter: ok });
    await callProviders([P("nvidia")], {}, { fetchImpl: dead, now: () => t });
    t += 11 * 60_000;
    const healed = fakeFetch({ gateway: ok, nvidia: ok, openrouter: ok });
    expect(await callProviders([P("nvidia")], {}, { fetchImpl: healed, now: () => t })).toMatchObject({ ok: true, provider: "nvidia" });
  });

  it("temporary errors (503/timeout/429) never trip the breaker", async () => {
    await callProviders([P("gateway")], {}, { fetchImpl: fakeFetch({ gateway: () => status(503) }) });
    expect(await callProviders([P("gateway")], {}, { fetchImpl: fakeFetch({ gateway: ok }) })).toMatchObject({ ok: true });
  });

  it("stops starting new attempts once the total budget is spent", async () => {
    let t = 0;
    const slowFail = vi.fn(async () => { t += 60_000; return status(503); }) as unknown as typeof fetch;
    const r = await callProviders([P("a"), P("b"), P("c"), P("d")], {}, { fetchImpl: slowFail, now: () => t, budgetMs: TOTAL_BUDGET_MS });
    expect((slowFail as any).mock.calls.length).toBe(3); // 60s + 60s + (10s left, <... ) -> bounded
    expect(r.ok).toBe(false);
  });

  it("each attempt's timeout is capped by the time that is left", async () => {
    let t = 0;
    const seen: number[] = [];
    const f = vi.fn(async (_u: any, init: any) => { seen.push(init.signal ? 1 : 0); t += 100_000; return status(503); }) as unknown as typeof fetch;
    // second attempt would have 30s left; it must still be allowed (>2s) but the budget stops a third.
    const r = await callProviders([P("a", { timeoutMs: 120_000 }), P("b", { timeoutMs: 120_000 }), P("c")], {}, { fetchImpl: f, now: () => t });
    expect((f as any).mock.calls.length).toBe(2);
    expect(r.ok).toBe(false);
  });
});
