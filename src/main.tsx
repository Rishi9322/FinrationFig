import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import { registerWebMcpTools } from './lib/webmcp'
import './styles/index.css'

registerWebMcpTools()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
