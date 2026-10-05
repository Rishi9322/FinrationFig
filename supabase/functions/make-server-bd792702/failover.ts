// Failover for the AI proxy (pure + fetch-injectable, so vitest can drive it).

// Per provider, not per request. Long CMA outputs can take well over 12s, and a
// too-short limit made a slow-but-healthy gateway look dead.
export const PROVIDER_TIMEOUT_MS = 25_000;

// Statuses that mean *our request* is bad: another provider would reject it too,
// so retrying just burns time. Everything else (401/402/403/404/410, 429, 5xx...)
// means *that provider* is unavailable, misconfigured or retired - try the next.
const REQUEST_ERRORS = new Set([400, 413, 422]);

export function shouldTryNextProvider(status: number): boolean {
  return !REQUEST_ERRORS.has(status);
}

export type Provider = {
  name: string; url: string; key: string; model: string; headers: Record<string, string>;
};

export type ProviderResult =
  | { ok: true; upstream: Response; provider: string }
  | { ok: false; status: 429 | 502; retryAfter?: string };

export async function callProviders(
  providers: Provider[],
  payload: Record<string, unknown>,
  opts: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    log?: (message: string, detail?: unknown) => void;
  } = {},
): Promise<ProviderResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? PROVIDER_TIMEOUT_MS;
  const log = opts.log ?? (() => {});

  let last: Response | null = null;
  for (const provider of providers) {
    let upstream: Response;
    try {
      upstream = await fetchImpl(provider.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.key}`,
          "Content-Type": "application/json",
          ...provider.headers,
        },
        body: JSON.stringify({ ...payload, model: provider.model }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      // Network failure or timeout - treat like an outage and try the next one.
      log(`[ai/chat] ${provider.name} unreachable`, error);
      continue;
    }

    if (upstream.ok) return { ok: true, upstream, provider: provider.name };

    log(`[ai/chat] ${provider.name} error`, upstream.status);
    last = upstream;
    if (!shouldTryNextProvider(upstream.status)) break;
  }

  if (last && last.status === 429) {
    return { ok: false, status: 429, retryAfter: last.headers.get("Retry-After") ?? "10" };
  }
  return { ok: false, status: 502 };
}
