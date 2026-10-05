import { describe, it, expect, vi, beforeEach } from "vitest";

const apiRequest = vi.fn();
vi.mock("./apiSession", () => ({ apiRequest: (...a: unknown[]) => apiRequest(...a) }));

import { aiChat, retryDelayMs } from "./ai";

const body = { messages: [{ role: "user" as const, content: "hi" }] };
const okRes = () => new Response('{"choices":[]}', { status: 200 });
const fail = (status: number, json: unknown = { error: "boom" }) => new Response(JSON.stringify(json), { status });
const noWait = vi.fn(async () => {});

beforeEach(() => { apiRequest.mockReset(); noWait.mockClear(); });

describe("retryDelayMs", () => {
  it("retries fast failures twice with growing backoff, then stops", () => {
    for (const s of [429, 502, 503, 504]) {
      expect(retryDelayMs(s, "unavailable", 0)).toBe(1500);
      expect(retryDelayMs(s, "unavailable", 1)).toBe(3000);
      expect(retryDelayMs(s, "unavailable", 2)).toBeNull();
    }
  });
  it("a timeout is retried only once", () => {
    expect(retryDelayMs(502, "timeout", 0)).toBe(500);
    expect(retryDelayMs(502, "timeout", 1)).toBeNull();
  });
  it("real errors are never retried", () => {
    for (const s of [400, 401, 403, 404, 413, 422]) expect(retryDelayMs(s, undefined, 0)).toBeNull();
  });
});

describe("aiChat", () => {
  it("returns straight away on success", async () => {
    apiRequest.mockResolvedValueOnce(okRes());
    await aiChat(body, { sleep: noWait });
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(noWait).not.toHaveBeenCalled();
  });

  it("the user never sees a transient failure: 502 then 429 then success is one quiet result", async () => {
    apiRequest.mockResolvedValueOnce(fail(502, { error: "x", reason: "unavailable" }))
      .mockResolvedValueOnce(fail(429, { error: "x", reason: "rate-limited" }))
      .mockResolvedValueOnce(okRes());
    const res = await aiChat(body, { sleep: noWait });
    expect(res.ok).toBe(true);
    expect(apiRequest).toHaveBeenCalledTimes(3);
    expect(noWait.mock.calls.map((c) => c[0])).toEqual([1500, 3000]);
  });

  it("gives up after the retries and surfaces the server's honest message and reason", async () => {
    apiRequest.mockImplementation(async () => fail(502, { error: "The AI service is unavailable right now.", reason: "unavailable" }));
    await expect(aiChat(body, { sleep: noWait })).rejects.toMatchObject({
      message: "The AI service is unavailable right now.", status: 502, reason: "unavailable",
    });
    expect(apiRequest).toHaveBeenCalledTimes(3);
  });

  it("a timeout gets exactly one retry", async () => {
    apiRequest.mockImplementation(async () => fail(502, { error: "took too long", reason: "timeout" }));
    await expect(aiChat(body, { sleep: noWait })).rejects.toMatchObject({ reason: "timeout" });
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it("an auth or bad-request error is thrown immediately, not retried", async () => {
    apiRequest.mockResolvedValueOnce(fail(401, { error: "Invalid session" }));
    await expect(aiChat(body, { sleep: noWait })).rejects.toMatchObject({ status: 401, message: "Invalid session" });
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it("a dropped connection (fetch throws) is retried quietly too", async () => {
    apiRequest.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(okRes());
    expect((await aiChat(body, { sleep: noWait })).ok).toBe(true);
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it("a persistent network failure is finally thrown", async () => {
    apiRequest.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(aiChat(body, { sleep: noWait })).rejects.toThrow("Failed to fetch");
    expect(apiRequest).toHaveBeenCalledTimes(3);
  });
});

describe("aiChat retry:false (optional calls such as classification)", () => {
  it("fails fast on a transient error instead of retrying", async () => {
    apiRequest.mockResolvedValue(fail(502, { error: "down", reason: "unavailable" }));
    await expect(aiChat(body, { sleep: noWait, retry: false })).rejects.toMatchObject({ status: 502 });
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(noWait).not.toHaveBeenCalled();
  });
  it("and on a dropped connection", async () => {
    apiRequest.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(aiChat(body, { sleep: noWait, retry: false })).rejects.toThrow("Failed to fetch");
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
