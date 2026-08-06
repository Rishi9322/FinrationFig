import { toast } from "sonner";

/**
 * Admin write requests. Every admin mutation must go through this — a bare
 * `fetch` swallows non-2xx responses, so the list refetches and the operator
 * sees what looks like success after a failed write.
 *
 * Returns true on success, false on failure. Reports the outcome as a toast.
 */
export async function adminMutate(
  url: string,
  opts: {
    method?: "POST" | "PATCH" | "DELETE";
    body?: unknown;
    success: string;
    error: string;
  },
): Promise<boolean> {
  const { method = "POST", body, success, error } = opts;

  try {
    const res = await fetch(url, {
      method,
      ...(body !== undefined && {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    });

    if (!res.ok) {
      toast.error(error, { description: await describeFailure(res) });
      return false;
    }

    toast.success(success);
    return true;
  } catch (e) {
    toast.error(error, {
      description: e instanceof Error ? e.message : "Network request failed.",
    });
    return false;
  }
}

/** Prefer a server-supplied reason over a bare status code. */
async function describeFailure(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === "string") return data.error;
    if (typeof data?.message === "string") return data.message;
  } catch {
    // non-JSON body — fall through to the status line
  }
  return `${res.status} ${res.statusText}`.trim();
}
