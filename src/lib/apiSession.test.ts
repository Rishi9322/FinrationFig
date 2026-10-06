import { describe, expect, it, vi, beforeEach } from "vitest"

// The edge routes authenticate with the caller's Firebase ID token as a Bearer
// header - never a token in the URL.
vi.mock("./supabaseClient", () => ({
  FUNCTIONS_BASE: "https://project.supabase.co/functions/v1/make-server-bd792702",
}))
vi.mock("./firebaseClient", () => ({
  auth: { currentUser: { getIdToken: vi.fn().mockResolvedValue("fb-id-token") } },
}))

import { apiRequest, REQUEST_TIMEOUT_MS, AI_REQUEST_TIMEOUT_MS } from "./apiSession"

describe("apiRequest", () => {
  beforeEach(() => vi.clearAllMocks())

  it("attaches the Firebase ID token as a Bearer header and keeps it out of the URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"))
    vi.stubGlobal("fetch", fetchMock)

    await apiRequest("/admin/users", { method: "POST", body: "{}" })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).not.toContain("token")
    expect(init.headers.Authorization).toBe("Bearer fb-id-token")
  })
  // A stalled phone connection never errors - fetch just waits. Without a limit that is an endless spinner.
  const hangingFetch = () => vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_res, rej) => {
    // Like real fetch: an already-aborted signal rejects straight away.
    if (init.signal!.aborted) return rej(new DOMException("aborted", "AbortError"))
    init.signal!.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")))
  }))

  it("gives up on a stalled request with a clear TimeoutError instead of waiting forever", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("fetch", hangingFetch())
    const p = apiRequest("/me")
    const assertion = expect(p).rejects.toMatchObject({ name: "TimeoutError", message: expect.stringContaining("took too long") })
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1)
    await assertion
    vi.useRealTimers()
  })

  it("the AI route is allowed far longer than ordinary calls (the server itself waits up to 130s)", async () => {
    expect(AI_REQUEST_TIMEOUT_MS).toBeGreaterThan(130_000)
    expect(AI_REQUEST_TIMEOUT_MS).toBeGreaterThan(REQUEST_TIMEOUT_MS)
    vi.useFakeTimers()
    vi.stubGlobal("fetch", hangingFetch())
    const p = apiRequest("/ai/chat", { method: "POST", body: "{}" })
    const assertion = expect(p).rejects.toMatchObject({ name: "TimeoutError" })
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1)
    let settled = false
    p.catch(() => { settled = true })
    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toBe(false) // still waiting after the ordinary limit
    await vi.advanceTimersByTimeAsync(AI_REQUEST_TIMEOUT_MS)
    await assertion
    vi.useRealTimers()
  })

  it("a caller's own cancel is reported as a cancel, not as a timeout", async () => {
    vi.stubGlobal("fetch", hangingFetch())
    const ctl = new AbortController()
    const p = apiRequest("/me", { signal: ctl.signal })
    ctl.abort()
    await expect(p).rejects.toMatchObject({ name: "AbortError" })
  })
})
