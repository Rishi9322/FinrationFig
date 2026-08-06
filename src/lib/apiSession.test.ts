import { describe, expect, it, vi, beforeEach } from "vitest"
import { apiRequest } from "./apiSession"

describe("apiRequest", () => {
  beforeEach(() => {
    document.cookie = "finratio_csrf=csrf-value; path=/"
  })

  it("sends cookies, echoes the CSRF cookie in a header, and never puts tokens in the URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"))
    vi.stubGlobal("fetch", fetchMock)

    await apiRequest("/calculations", { method: "POST", body: "{}" })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).not.toContain("sessionToken")
    expect(url).not.toContain("csrfToken")
    expect(init.credentials).toBe("include")
    expect(init.headers["X-CSRF-Token"]).toBe("csrf-value")
  })

  it("omits the CSRF header on reads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"))
    vi.stubGlobal("fetch", fetchMock)

    await apiRequest("/auth/me")

    expect(fetchMock.mock.calls[0][1].headers["X-CSRF-Token"]).toBeUndefined()
  })
})
