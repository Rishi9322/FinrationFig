import { describe, it, expect, vi } from "vitest";
import { shouldTryNextProvider, callProviders, PROVIDER_TIMEOUT_MS, type Provider } from "./failover";

const P = (name: string): Provider => ({ name, url: `https://${name}.test/v1`, key: "k", model: "m", headers: {} });
const providers = [P("gateway"), P("nvidia"), P("openrouter")];
const ok = () => new Response('{"choices":[]}', { status: 200 });
const status = (s: number, headers: Record<string, string> = {}) => new Response("{}", { status: s, headers });

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
    const f = fakeFetch({
      gateway: () => { throw new DOMException("timed out", "TimeoutError"); },
      nvidia: () => status(410),
      openrouter: ok,
    });
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
    expect(r).toEqual({ ok: false, status: 502 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("returns 502 when every provider is down", async () => {
    const f = fakeFetch({ gateway: () => status(410), nvidia: () => status(401), openrouter: () => status(503) });
    expect(await callProviders(providers, {}, { fetchImpl: f })).toEqual({ ok: false, status: 502 });
  });

  it("returns 429 with Retry-After only when the last failure was throttling", async () => {
    const f = fakeFetch({ gateway: () => status(500), nvidia: () => status(500), openrouter: () => status(429, { "Retry-After": "7" }) });
    expect(await callProviders(providers, {}, { fetchImpl: f })).toEqual({ ok: false, status: 429, retryAfter: "7" });
  });

  it("sends the provider's own model and auth header", async () => {
    const f = vi.fn(async () => ok()) as unknown as typeof fetch;
    await callProviders([{ ...P("gateway"), model: "gemini", key: "secret" }], { messages: [1] }, { fetchImpl: f });
    const [, init] = (f as any).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ messages: [1], model: "gemini" });
    expect(init.headers.Authorization).toBe("Bearer secret");
  });

  it("handles an empty provider list", async () => {
    expect(await callProviders([], {}, { fetchImpl: fakeFetch({}) })).toEqual({ ok: false, status: 502 });
  });
});
