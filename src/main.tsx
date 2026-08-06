import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import { bootstrap, onLateHydrate } from './lib/store'

// Apply the saved theme before anything renders. This used to live only in Layout, which the
// landing page deliberately renders outside of — without it a light-mode user gets a dark
// landing page, and everyone gets a flash of dark before Layout mounts. Layout still owns the
// toggle; this only sets the initial class.
if (localStorage.getItem('theme') === 'light') {
  document.documentElement.classList.add('light');
}

// Capture the PWA install prompt as early as possible (it can fire before React mounts)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).__deferredInstallPrompt = e;
  window.dispatchEvent(new Event('pwa-installable'));
});
window.addEventListener('appinstalled', () => {
  (window as any).__deferredInstallPrompt = null;
});

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content available. Reload?')) {
      updateSW(true)
    }
  },
})

const root = ReactDOM.createRoot(document.getElementById('root')!)
let generation = 0
const paint = () => root.render(
  <React.StrictMode>
    <App key={generation} />
  </React.StrictMode>,
)

// Every page reads storage synchronously at mount and never re-reads, so synced data has to
// be in place before the first render. bootstrap() fills from the on-device mirror instantly
// and only then touches the network, behind its own timeout — it can never block the paint.
bootstrap().catch(() => {}).finally(paint)

// A pull that landed after the first paint: remount so every lazy useState initialiser and
// []-dep mount effect re-runs against the fresh data.
onLateHydrate(() => { generation++; paint() })
