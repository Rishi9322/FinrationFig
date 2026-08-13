// GA4 init. The measurement id is injected into index.html as data-ga-id and is
// substituted by Vite at build time from VITE_GA_ID. If it is unset the
// placeholder survives verbatim, so nothing is loaded.
var id = document.currentScript.dataset.gaId
if (id && id.indexOf('G-') === 0) {
  var s = document.createElement('script')
  s.async = true
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id)
  document.head.appendChild(s)

  window.dataLayer = window.dataLayer || []
  window.gtag = function () { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  window.gtag('config', id)
}
