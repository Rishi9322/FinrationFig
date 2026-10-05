import { useEffect, useState } from "react"
import { Download, Share, X } from "lucide-react"
import { isIos, isStandalone, readDismissed, recentlyDismissed, writeDismissed } from "../../lib/pwa"

// Chromium's install event is not in lib.dom.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/**
 * Offers "add to home screen". Android/desktop Chrome and Edge give us a real
 * install prompt; iOS has none, so we show the Share -> Add to Home Screen
 * steps. Hidden once installed, and for two weeks after "not now".
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    if (isStandalone() || recentlyDismissed(readDismissed())) return

    const onPrompt = (e: Event) => {
      e.preventDefault() // keep the event so the user can trigger it from our button
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => { setDeferred(null); setIosHint(false) }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)

    // Give iOS visitors a moment with the page before suggesting anything.
    let timer: ReturnType<typeof setTimeout> | undefined
    if (isIos(navigator.userAgent, navigator.maxTouchPoints)) {
      timer = setTimeout(() => setIosHint(true), 8000)
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
      if (timer) clearTimeout(timer)
    }
  }, [])

  if (!deferred && !iosHint) return null

  const dismiss = () => { writeDismissed(); setDeferred(null); setIosHint(false) }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice.catch(() => undefined)
    setDeferred(null) // the event can only be used once
  }

  return (
    <div
      role="dialog"
      aria-label="Install FinRatio"
      // Bottom, so the site header stays visible. It sits just under the cookie
      // banner (z-9999): that one is answered first, then this is revealed.
      className="fixed bottom-0 inset-x-0 z-[9980] flex items-center gap-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-card border-t border-foreground/10 shadow-lg"
    >
      <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-xl shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium text-foreground">Install FinRatio</div>
        {deferred ? (
          <div className="text-muted-foreground text-xs">Add it to your home screen for one-tap access.</div>
        ) : (
          <div className="text-muted-foreground text-xs">
            Tap <Share className="inline h-3.5 w-3.5 -mt-0.5" aria-label="Share" /> then <strong>Add to Home Screen</strong>.
          </div>
        )}
      </div>
      {deferred && (
        <button
          type="button"
          onClick={install}
          className="shrink-0 inline-flex items-center gap-1.5 min-h-10 bg-primary hover:bg-primary-hover text-white text-sm font-medium px-4 py-2.5 rounded-lg"
        >
          <Download className="h-4 w-4" /> Install
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 inline-flex items-center justify-center min-h-10 min-w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
