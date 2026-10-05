// Failover for the AI proxy (pure + fetch-injectable, so vitest can drive it).

// Default wait per provider if it doesn't set its own (see Provider.timeoutMs).
export const PROVIDER_TIMEOUT_MS = 25_000;

// Everything one request may spend across ALL providers. The edge function is
// killed at ~150s; staying under it means the user always gets an answer or a
// clear error, never a dropped connection.
export const TOTAL_BUDGET_MS = 130_000;

// A provider answering one of these has been retired, un-keyed or removed: it will
// fail the same way every time, so skip it for a while instead of paying for the
// failure on every request.
const PERMANENT = new Set([401, 403, 404, 410]);
const DISABLE_MS = 10 * 60_000;
const disabledUntil = new Map<string, number>();
export function resetCircuit(): void { disabledUntil.clear(); }

// Statuses that mean *our request* is bad: another provider would reject it too,
// so retrying just burns time. Everything else means *that provider* is
// unavailable, misconfigured or retired - try the next.
const REQUEST_ERRORS = new Set([400, 413, 422]);

export function shouldTryNextProvider(status: number): boolean {
  return !REQUEST_ERRORS.has(status);
}

export type Provider = {
  name: string; url: string; key: string; model: string; headers: Record<string, string>;
  /** Overrides the default wait for this provider. */
  timeoutMs?: number;
};

export type Attempt = { provider: string; outcome: number | "timeout" | "network" | "skipped" };
export type FailureReason = "rate-limited" | "timeout" | "unavailable";

export type ProviderResult =
  | { ok: true; upstream: Response; provider: string; attempts: Attempt[] }
  | { ok: false; status: 429 | 502; reason: FailureReason; retryAfter?: string; attempts: Attempt[] };

export async function callProviders(
  providers: Provider[],
  payload: Record<string, unknown>,
  opts: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    budgetMs?: number;
    now?: () => number;
    log?: (message: string, detail?: unknown) => void;
  } = {},
): Promise<ProviderResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? (() => {});
  const now = opts.now ?? Date.now;
  const budget = opts.budgetMs ?? TOTAL_BUDGET_MS;
  const started = now();
  const attempts: Attempt[] = [];

  let lastRetryAfter: string | undefined;
  for (const provider of providers) {
    if ((disabledUntil.get(provider.name) ?? 0) > now()) {
      attempts.push({ provider: provider.name, outcome: "skipped" });
      continue;
    }
    const remaining = budget - (now() - started);
    if (remaining < 2_000) break; // not enough time left for a useful attempt

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
        signal: AbortSignal.timeout(Math.min(provider.timeoutMs ?? opts.timeoutMs ?? PROVIDER_TIMEOUT_MS, remaining)),
      });
    } catch (error) {
      // Network failure or timeout - treat like an outage and try the next one.
      const timedOut = (error as Error)?.name === "TimeoutError" || (error as Error)?.name === "AbortError";
      attempts.push({ provider: provider.name, outcome: timedOut ? "timeout" : "network" });
      log(`[ai/chat] ${provider.name} unreachable`, error);
      continue;
    }

    if (upstream.ok) return { ok: true, upstream, provider: provider.name, attempts };

    attempts.push({ provider: provider.name, outcome: upstream.status });
    log(`[ai/chat] ${provider.name} error`, upstream.status);
    if (PERMANENT.has(upstream.status)) disabledUntil.set(provider.name, now() + DISABLE_MS);
    if (upstream.status === 429) lastRetryAfter = upstream.headers.get("Retry-After") ?? "10";
    if (!shouldTryNextProvider(upstream.status)) break;
  }

  // "Rate-limited" only when throttling is genuinely what happened everywhere;
  // a timeout plus a retired model plus one 429 is an outage, not a rate limit.
  const real = attempts.filter((a) => a.outcome !== "skipped");
  if (real.length > 0 && real.every((a) => a.outcome === 429)) {
    return { ok: false, status: 429, reason: "rate-limited", retryAfter: lastRetryAfter ?? "10", attempts };
  }
  const reason: FailureReason = real.some((a) => a.outcome === "timeout") ? "timeout" : "unavailable";
  return { ok: false, status: 502, reason, attempts };
}

/** What to tell the user. */
export function failureMessage(reason: FailureReason): string {
  switch (reason) {
    case "rate-limited": return "Every AI provider is rate-limited right now. Please try again in a few seconds.";
    case "timeout": return "The AI took too long to respond. Please try again - large documents can need a second attempt.";
    default: return "The AI service is unavailable right now. Please try again in a minute.";
  }
}
