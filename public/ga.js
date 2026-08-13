// Cookie consent + GA4. The measurement id is injected into index.html as
// data-ga-id and substituted by Vite at build time from VITE_GA_ID; if it is
// unset the placeholder survives verbatim and nothing here runs.
//
// Analytics is opt-in: GA is not loaded until the visitor accepts, so no
// analytics cookie is set before consent.
(function () {
  var data = document.currentScript.dataset
  var id = data.gaId
  var clarityId = data.clarityId
  var hasGa = id && id.indexOf('G-') === 0
  // Placeholders survive verbatim when the env var is unset, so require a
  // plausible id rather than mere presence.
  var hasClarity = clarityId && clarityId.indexOf('%') !== 0
  if (!hasGa && !hasClarity) return

  var KEY = 'finratio-cookie-consent'

  function loadAnalytics() {
    if (hasGa) {
      var s = document.createElement('script')
      s.async = true
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id)
      document.head.appendChild(s)

      window.dataLayer = window.dataLayer || []
      window.gtag = function () { window.dataLayer.push(arguments) }
      window.gtag('js', new Date())
      window.gtag('config', id)
    }

    if (hasClarity) {
      window.clarity = window.clarity || function () {
        (window.clarity.q = window.clarity.q || []).push(arguments)
      }
      var c = document.createElement('script')
      c.async = true
      c.src = 'https://www.clarity.ms/tag/' + encodeURIComponent(clarityId)
      document.head.appendChild(c)
    }
  }

  function showBanner() {
    var style = document.createElement('style')
    style.textContent =
      '#cookie-consent{position:fixed;bottom:0;left:0;right:0;z-index:9999;' +
      'display:flex;flex-wrap:wrap;align-items:center;justify-content:center;' +
      'gap:.75rem 1.25rem;padding:1rem 1.25rem;background:#0F172A;color:#E2E8F0;' +
      'border-top:1px solid #1E293B;font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}' +
      '#cookie-consent p{margin:0;max-width:60ch}' +
      '#cookie-consent div{display:flex;gap:.5rem;flex-shrink:0}' +
      '#cookie-consent button{padding:.5rem 1rem;border-radius:6px;cursor:pointer;' +
      'font:inherit;font-weight:500;border:1px solid #334155;background:transparent;color:#E2E8F0}' +
      '#cookie-consent button:hover{background:#1E293B}' +
      '#cookie-consent button.accept{background:#2563EB;border-color:#2563EB;color:#fff}' +
      '#cookie-consent button.accept:hover{background:#1D4ED8}'
    document.head.appendChild(style)

    var bar = document.createElement('div')
    bar.id = 'cookie-consent'
    bar.setAttribute('role', 'dialog')
    bar.setAttribute('aria-label', 'Cookie consent')

    var text = document.createElement('p')
    text.textContent =
      'We use analytics cookies to understand how FinRatio is used. ' +
      'They are optional — the site works fine without them.'

    var actions = document.createElement('div')
    var decline = document.createElement('button')
    decline.textContent = 'Decline'
    var accept = document.createElement('button')
    accept.className = 'accept'
    accept.textContent = 'Accept'

    function close(choice) {
      try { localStorage.setItem(KEY, choice) } catch (_e) { /* private mode */ }
      bar.remove()
      if (choice === 'accepted') loadAnalytics()
    }
    decline.addEventListener('click', function () { close('declined') })
    accept.addEventListener('click', function () { close('accepted') })

    actions.appendChild(decline)
    actions.appendChild(accept)
    bar.appendChild(text)
    bar.appendChild(actions)
    document.body.appendChild(bar)
    accept.focus()
  }

  var choice = null
  try { choice = localStorage.getItem(KEY) } catch (_e) { /* private mode */ }

  if (choice === 'accepted') loadAnalytics()
  else if (choice !== 'declined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner)
    } else showBanner()
  }
})()
