import { apiRequest } from "./apiSession"

export type ClientEventKind = "cma_upload_start" | "cma_upload_end"
export type EventDetail = Record<string, string | number | boolean | null>

/**
 * Fire-and-forget diagnostic breadcrumb. Never throws and never delays the caller:
 * losing an event is fine, breaking the feature it describes is not.
 * Only send non-identifying facts (file type, size, timings), never file names or contents.
 */
export function logClientEvent(kind: ClientEventKind, detail: EventDetail): void {
  try {
    void apiRequest("/events", { method: "POST", body: JSON.stringify({ kind, detail }) }).catch(() => {})
  } catch {
    /* ignore */
  }
}

/** What we can learn about the device's network without asking for anything. */
export function connectionInfo(nav: Navigator = navigator): EventDetail {
  const c = (nav as unknown as { connection?: { effectiveType?: string; saveData?: boolean } }).connection
  return {
    net: c?.effectiveType ?? null,
    saveData: c?.saveData ?? null,
    online: nav.onLine,
    ua: (nav.userAgent || "").slice(0, 120),
  }
}
