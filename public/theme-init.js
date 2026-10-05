// Sets the theme class before first paint (no flash of the wrong theme while
// React hydrates). Keep in sync with getInitialTheme() in src/lib/theme.tsx.
// Lives in public/ as an external file because the CSP blocks inline scripts.
(function () {
  try {
    var t = localStorage.getItem("finratio-theme")
    if (t !== "light") document.documentElement.classList.add("dark")
  } catch (e) {
    document.documentElement.classList.add("dark")
  }
})()
