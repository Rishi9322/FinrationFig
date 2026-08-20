import { useEffect } from "react"
import { RouterProvider } from "react-router"
import { router } from "./routes"
import { Toaster } from "./components/ui/sonner"
import { Analytics } from "@vercel/analytics/react"
import { getRouteMeta } from "../lib/routeMeta"

// Per-route <title>/<meta description>/<link canonical>. The app is a client
// router (createBrowserRouter, not nested layout routes with an Outlet), so
// this hooks the router's own subscription instead of threading a component
// into every page - one integration point instead of twenty.
function applyRouteMeta(pathname: string) {
  const meta = getRouteMeta(pathname)
  document.title = meta.title
  document.querySelector('meta[name="description"]')?.setAttribute("content", meta.description)
  const canonical = document.querySelector('link[rel="canonical"]')
  if (canonical) canonical.setAttribute("href", `https://finratio.site${pathname}`)
}

function useRouteMeta() {
  useEffect(() => {
    applyRouteMeta(window.location.pathname)
    return router.subscribe((state) => applyRouteMeta(state.location.pathname))
  }, [])
}

export default function App() {
  useRouteMeta()
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
      <Analytics />
    </>
  )
}