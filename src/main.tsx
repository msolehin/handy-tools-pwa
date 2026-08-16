import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import { bootstrap, onLateHydrate } from './lib/store'
import { getLang } from './lib/lang'

// Apply the saved theme before anything renders. This used to live only in Layout, which the
// landing page deliberately renders outside of — without it a light-mode user gets a dark
// landing page, and everyone gets a flash of dark before Layout mounts. Layout still owns the
// toggle; this only sets the initial class.
if (localStorage.getItem('theme') === 'light') {
  document.documentElement.classList.add('light');
}

// Same reasoning for the language: set <html lang> before the first render rather than in an
// effect, so assistive tech and the browser's own translation prompt never see the wrong one.
document.documentElement.lang = getLang();

// Capture the PWA install prompt as early as possible (it can fire before React mounts)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).__deferredInstallPrompt = e;
  window.dispatchEvent(new Event('pwa-installable'));
});
window.addEventListener('appinstalled', () => {
  (window as any).__deferredInstallPrompt = null;
});

// vite.config.ts registers with `registerType: 'autoUpdate'`, and in that mode vite-plugin-pwa
// reloads the page ITSELF the moment a new worker activates — no prompt, mid-form, and whatever
// was being typed is gone. That is the "it suddenly refreshed" every deploy handed to whoever
// was mid-record. Passing onNeedReload is precisely what suppresses that built-in reload; the
// old onNeedRefresh/confirm here never ran at all, because onNeedRefresh only fires in prompt
// mode. UpdateBar picks this up and lets the user choose the moment.
registerSW({
  onNeedReload() { window.dispatchEvent(new Event('sw:update-ready')) },
})

const root = ReactDOM.createRoot(document.getElementById('root')!)
let generation = 0
const paint = () => root.render(
  <React.StrictMode>
    <App key={generation} />
  </React.StrictMode>,
)

// Every page reads storage synchronously at mount and never re-reads, so synced data has to
// be in place before the first render. Everything in bootstrap() before its first `await` is
// the on-device mirror fill, so it has already run by the time this line returns — paint can
// happen immediately and the network pull continues in the background, remounting through
// onLateHydrate when it lands. Awaiting it instead is what forced a 1.5s abort on the pull,
// and a pull that aborts leaves a signed-in user sitting in guest mode with no data.
void bootstrap().catch(() => {})
paint()

// Remount, so every lazy useState initialiser and []-dep mount effect re-runs against the
// fresh data. This throws away the entire tree — open modals, half-typed forms, scroll
// position — so the store only asks for it when the identity behind the data changed: a
// sign-in, an import, or a conflict the user just resolved. A routine background pull no
// longer comes through here; it used to, and firing mid-edit was indistinguishable from the
// app refreshing itself.
onLateHydrate(() => { generation++; paint() })
