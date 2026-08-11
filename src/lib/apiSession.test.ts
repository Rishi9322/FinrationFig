import { describe, expect, it, vi, beforeEach } from "vitest"

// The edge routes now authenticate with the Supabase access token as a Bearer
// header — no cookies, no CSRF, and never a token in the URL.
vi.mock("./supabaseClient", () => ({
  FUNCTIONS_BASE: "https://project.supabase.co/functions/v1/make-server-bd792702",
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "jwt-abc" } } }),
    },
  },
}))

import { apiRequest } from "./apiSession"

describe("apiRequest", () => {
  beforeEach(() => vi.clearAllMocks())

  it("attaches the Supabase access token as a Bearer header and keeps it out of the URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"))
    vi.stubGlobal("fetch", fetchMock)

    await apiRequest("/admin/users", { method: "POST", body: "{}" })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).not.toContain("token")
    expect(url).not.toContain("sessionToken")
    expect(init.headers.Authorization).toBe("Bearer jwt-abc")
    expect(init.headers["X-CSRF-Token"]).toBeUndefined()
  })
})
