// GA4 init. The measurement id is injected into index.html as data-ga-id.
var id = document.currentScript.dataset.gaId
if (id && id.indexOf('G-') === 0) {
  window.dataLayer = window.dataLayer || []
  window.gtag = function () { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  window.gtag('config', id)
}
