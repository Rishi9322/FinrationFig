import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { Analytics } from '@vercel/analytics/react'
import { router } from './app/routes'
import { Toaster } from './app/components/ui/sonner'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
    <Toaster />
    <Analytics />
  </React.StrictMode>,
)
