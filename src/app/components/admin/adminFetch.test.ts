import { describe, expect, it, vi, beforeEach } from "vitest";
import { adminMutate } from "./adminFetch";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
import { toast } from "sonner";

const res = (init: { ok: boolean; status?: number; body?: unknown }) =>
  ({
    ok: init.ok,
    status: init.status ?? 200,
    statusText: init.ok ? "OK" : "Internal Server Error",
    json: async () => {
      if (init.body === undefined) throw new Error("not json");
      return init.body;
    },
  }) as Response;

describe("adminMutate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports success only on a 2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res({ ok: true })));

    await expect(adminMutate("/x", { success: "done", error: "nope" })).resolves.toBe(true);
    expect(toast.success).toHaveBeenCalledWith("done");
    expect(toast.error).not.toHaveBeenCalled();
  });

  // The bug this file exists to prevent: a non-2xx must not read as success.
  it("reports failure on a non-2xx, surfacing the server's reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(res({ ok: false, status: 500, body: { error: "db down" } })),
    );

    await expect(adminMutate("/x", { success: "done", error: "nope" })).resolves.toBe(false);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("nope", { description: "db down" });
  });

  it("falls back to the status line when the error body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res({ ok: false, status: 503 })));

    await adminMutate("/x", { success: "done", error: "nope" });
    expect(toast.error).toHaveBeenCalledWith("nope", {
      description: "503 Internal Server Error",
    });
  });

  it("reports failure when the request never lands", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(adminMutate("/x", { success: "done", error: "nope" })).resolves.toBe(false);
    expect(toast.error).toHaveBeenCalledWith("nope", { description: "offline" });
  });

  it("sends a JSON body only when one is given", async () => {
    const f = vi.fn().mockResolvedValue(res({ ok: true }));
    vi.stubGlobal("fetch", f);

    await adminMutate("/x", { success: "s", error: "e" });
    expect(f.mock.calls[0][1]).toEqual({ method: "POST" });

    await adminMutate("/y", { method: "DELETE", body: { a: 1 }, success: "s", error: "e" });
    expect(f.mock.calls[1][1]).toEqual({
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: '{"a":1}',
    });
  });
});
