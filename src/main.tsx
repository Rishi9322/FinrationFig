import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import { registerWebMcpTools } from './lib/webmcp'
import { registerServiceWorker, recoverFromStaleChunks } from './lib/pwa'
import { initNative } from './lib/native'
import './styles/index.css'

registerWebMcpTools()
registerServiceWorker()
recoverFromStaleChunks()
void initNative() // no-op in a browser; status bar, back button and splash screen in the app

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
