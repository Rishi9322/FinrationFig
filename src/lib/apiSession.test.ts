import { describe, expect, it, vi, beforeEach } from "vitest"

// The edge routes authenticate with the caller's Firebase ID token as a Bearer
// header — never a token in the URL.
vi.mock("./supabaseClient", () => ({
  FUNCTIONS_BASE: "https://project.supabase.co/functions/v1/make-server-bd792702",
}))
vi.mock("./firebaseClient", () => ({
  auth: { currentUser: { getIdToken: vi.fn().mockResolvedValue("fb-id-token") } },
}))

import { apiRequest } from "./apiSession"

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
})
