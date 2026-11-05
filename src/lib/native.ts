/**
 * Is this code running inside the installed iOS/Android app (Capacitor) rather than a browser?
 * Capacitor injects window.Capacitor into the webview, so this needs no import and adds nothing to the
 * web bundle. Used to switch off things that only make sense in a browser (service worker, "install this
 * site" prompt, popup sign-in).
 */
export function isNative(): boolean {
  if (typeof window === "undefined") return false
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return cap?.isNativePlatform?.() === true
}

/**
 * Native-only setup: status bar colours, the Android back button, and hiding the splash screen.
 * The plugins are imported on demand, so the website never downloads them.
 */
export async function initNative(): Promise<void> {
  if (!isNative()) return
  const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/status-bar"),
    import("@capacitor/splash-screen"),
  ])

  // The bars are navy in dark mode (light icons). When the user switches the app to its light theme, the page
  // behind the bars turns light, so the icons must turn dark.
  const syncBars = () => {
    const dark = document.documentElement.classList.contains("dark")
    void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined)
  }
  syncBars()
  new MutationObserver(syncBars).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

  // Android's back button: go back through the app's own history, and leave the app at the root.
  void App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else void App.exitApp()
  })

  await SplashScreen.hide()
}
