// Points pdf.js at the worker file bundled with the installed pdfjs-dist
// package instead of an unpinned third-party CDN - keeps it same-origin (no
// CSP allowlist needed) and always version-matched to what's actually
// installed. GlobalWorkerOptions is a module-level singleton shared by every
// pdfjs import in the bundle, so setting it once here covers all callers.
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf"
// @ts-ignore - Vite's ?url suffix resolves to the built asset's served path
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.js?url"

GlobalWorkerOptions.workerSrc = pdfWorkerUrl
