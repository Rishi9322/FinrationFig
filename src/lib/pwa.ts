// Helpers for the installable (add-to-home-screen) app. Pure where possible so
// they can be tested without a browser.

export const INSTALL_DISMISS_KEY = "finratio-install-dismissed";
const DISMISS_DAYS = 14;

/** Already running as an installed app (Android/desktop display-mode, or iOS standalone). */
export function isStandalone(win: Window = window): boolean {
  return (
    win.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    (win.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * iPhone/iPad. iOS never fires `beforeinstallprompt`, so the user has to be
 * told to use Share -> Add to Home Screen. iPadOS 13+ reports itself as a Mac,
 * so it is recognised by touch support.
 */
export function isIos(userAgent: string, maxTouchPoints = 0): boolean {
  return /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && maxTouchPoints > 1);
}

/** True while the user's "not now" is still fresh (so we don't nag). */
export function recentlyDismissed(raw: string | null, now = Date.now()): boolean {
  const at = Number(raw);
  return Number.isFinite(at) && at > 0 && now - at < DISMISS_DAYS * 86_400_000;
}

export function readDismissed(): string | null {
  try { return localStorage.getItem(INSTALL_DISMISS_KEY); } catch { return null; }
}

export function writeDismissed(now = Date.now()): void {
  try { localStorage.setItem(INSTALL_DISMISS_KEY, String(now)); } catch { /* private mode */ }
}

/**
 * After a deploy, a tab opened before it may ask for a lazy chunk (pdf/xlsx
 * parsers...) whose hashed file no longer exists. Reload once to pick up the
 * new build; the session flag stops a reload loop if something else is wrong.
 */
export function recoverFromStaleChunks(): void {
  window.addEventListener("vite:preloadError", () => {
    try {
      if (sessionStorage.getItem("finratio-chunk-reload")) return;
      sessionStorage.setItem("finratio-chunk-reload", "1");
    } catch { /* private mode: reload anyway */ }
    window.location.reload();
  });
}

/** Production only: a worker in `vite dev` would cache stale modules. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability and offline fallback are enhancements; never break the app.
    });
  });
}
