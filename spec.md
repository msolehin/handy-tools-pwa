# SenangKit — Specification

A single-page, offline-first PWA holding ~40 small everyday tools (finance, auto, travel,
health, lifestyle, utilities) aimed at Malaysian users. No backend, no accounts, no server
state: every tool computes locally and stores its own data in the browser.

## 1. Product rules

- **Local-only data.** Nothing leaves the device except two optional network calls (§6). No
  auth, no sync, no analytics of user data (Vercel Analytics collects page views only).
- **Offline first.** Every tool must work with the network off. Anything needing the network
  caches its last good result and degrades to that.
- **One tool = one page = one route.** Tools never depend on each other's internals; they
  read each other's `localStorage` keys read-only (the Home dashboard does this for alerts).
- **Mobile-first.** Layout targets a phone in portrait, installed to the home screen.
  Bottom nav, thumb-reachable controls, no hover-only affordances.
- **Bilingual by feel.** Tool titles mix English and colloquial Malay (`Lupa parking?`,
  `Catat Hutang`, `Kira Duit Raya`). Body copy stays English.

## 2. Stack

| Concern | Choice |
|---|---|
| Build | Vite 8, `@vitejs/plugin-react` |
| Language | TypeScript ~6, React 19 |
| Routing | `react-router-dom` 7, `BrowserRouter` |
| Styling | Tailwind 3 + CSS custom properties, `src/index.css` / `src/App.css` |
| Icons | `lucide-react` |
| PWA | `vite-plugin-pwa`, `registerType: 'autoUpdate'` |
| Structured storage | Dexie (IndexedDB) — blobs only |
| Simple storage | `localStorage` — everything else |
| Maps | Leaflet + react-leaflet; d3-geo + topojson + world-atlas for the travel map |
| PDF | `pdf-lib` (write), `react-pdf`/pdfjs (render) |
| Images | `cropperjs` + `react-cropper` |
| Drag & drop | `@dnd-kit/*` (Home reordering) |
| Hosting | Vercel, SPA rewrite to `/index.html` |

Scripts: `npm run dev`, `build` (`tsc -b && vite build`), `lint`, `preview`.

## 3. Structure

```
src/
  main.tsx        entry; captures beforeinstallprompt, registers SW with update confirm
  App.tsx         router — one <Route> per tool under a shared <Layout>
  db.ts           Dexie schema (v2)
  index.css       theme variables + ~30 keyframe animations shared by tools
  components/
    Layout.tsx    app shell: header, bottom nav, pinned tools, settings, notification bar
    CategoryChips.tsx, CompassNavigator.tsx, ScrollToTop.tsx
  pages/          one file per tool + Home.tsx (dashboard/catalog)
```

Pages are self-contained: state, persistence, math, and markup all live in the page file.
That is deliberate — no shared "tool framework" exists and none should be added until three
tools genuinely need the same non-trivial logic.

## 4. Shell (`Layout.tsx`)

- **Header** with title/back, hides on scroll-down.
- **Bottom nav**: Home, up to N user-pinned tools (`pinnedTools`), More menu, Settings.
  Nav is hideable via a toggle.
- **Notification bar**: on Home, scrolling down swaps the bottom bar for a rotating alert
  ticker fed by a `home:alerts` `CustomEvent` dispatched from `Home.tsx`. Alert order follows
  the user's saved `home_alert_order`.
- **Theme**: dark by default; `html.light` class toggles the light palette. Persisted in
  `theme`. Tailwind colors resolve from `--color-*` RGB triples, so tools must use the
  semantic classes (`bg-surface`, `text-muted`, …) and never hardcoded slate/zinc values.
- **Install prompt**: `beforeinstallprompt` is captured in `main.tsx` before React mounts and
  re-broadcast as a `pwa-installable` event; Layout renders the install CTA when not already
  standalone.

## 5. Home (`Home.tsx`)

Catalog + dashboard. Owns the tool registry (`DEFAULT_TOOLS`: `id`, `to`, `title`, `desc`,
`Icon`, `category`).

- 39 tool routes; 37 catalogued cards + 1 external link (`befday.com`). Two routes
  (`/affordability`, `/trip-budget`) are live but commented out of the catalog.
- Categories: Finance, Auto & Travel, Utilities, Lifestyle, Health & Fitness, Fun.
- View modes: `list` | `grid` (2/3/4 cols) | `category` | `alphabet`, persisted.
- Favorites, last-5 recents, manual drag reorder (dnd-kit), search, and a NEW/HOT badge
  driven by per-tool launch dates in `NEW_TOOLS` (`new` for 7 days, then `hot`).
- **Cross-tool alerts**: reads other tools' `localStorage` and emits alerts of type
  `document | event | commitment | payday | water | debt | expense | habit | warranty | service`,
  each with a `daysLeft` used for default sorting.
- Animations are user-toggleable (`handy-animations`); respect that flag in new tools.

## 6. Data

**Dexie (`HandyToolsDB`, v2)** — used only where a Blob or file must be kept:
`parkingLocations` (photo + GPS), `pdfSignatures`, `pdfTexts`.

**localStorage** — everything else, one or more keys per tool, prefixed by tool
(`expense_manager_data`, `habit_tracker_data`, `de_documents`, `cd_events`, `vt_records`, …).
Shell/dashboard keys: `theme`, `pinnedTools`, `handy-animations`, `handy-tools-favorites`,
`handy-tools-recents`, `handy-tools-recents-minimized`, `home_view_mode`, `home_grid_cols`,
`home_tool_order`, `home_alert_order`, `hot_tools_promoted_v3`.

Rules for new tools: pick a unique prefix; wrap every read in try/catch and fall back to a
default (corrupt or absent JSON must never white-screen the app); never store secrets.

## 7. Device & network capabilities

| Capability | Used by |
|---|---|
| Geolocation | ParkingLocator, Speedometer, CompassNavigator |
| DeviceOrientation | CompassNavigator, WaterTracker, Home (water tilt) |
| Camera (`<input capture="environment">`) | ICScanner |
| Clipboard | ImportantNumbers, ParkingLocator |
| Notifications | Layout |
| Network — FX rates | CurrencyConverter → `open.er-api.com`, cached for offline |
| Network — throughput | SpeedTest → `speed.cloudflare.com/__down` / `__up` |

Every capability must be feature-detected and permission-denial must leave a usable page.

## 8. Adding a tool

1. `src/pages/YourTool.tsx` — self-contained, own `localStorage` prefix.
2. Route in `App.tsx`.
3. Entry in `DEFAULT_TOOLS` in `Home.tsx` (+ `NEW_TOOLS` date for the badge).
4. If it has a deadline/threshold worth surfacing, push an alert from Home's alert effect.
5. Verify: works offline, works in both themes, works with animations off, survives a
   cleared/corrupt storage key.

## 9. Non-goals

No backend, accounts, or cross-device sync. No i18n framework. No test suite or component
library today — add either only when a concrete failure demands it.
