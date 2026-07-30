# SenangKit — Specification

An offline-first PWA for **structured personal records that expire or recur**. The problem it
solves: notes apps let you write anything, which means you never look at it again and you miss
the renewal, the warranty, the service, the debt. SenangKit gives each kind of record a fixed
shape so it can be entered fast, read at a glance, and surfaced *before* the deadline.

Stateless calculators and anything the web or the OS already does well were removed on
2026-07-30 (15 tools: Financial Hub, Currency Converter, Fuel & Tolls, Can I Afford It, Trip
Budget, Speed Test, Speedometer, Expense Splitter, Group Split Bill, Carpool Splitter, Packing
Checklist, Payday Countdown, Vehicle Tracker, BMI Calculator, Unit Converter). Checklists,
Nak Beli and Medical ID were dropped the same day — 18 removed in total, 40 entries down to 22.

## 1. Product rules

- **Local-only data.** Nothing leaves the device. The app now makes **zero runtime network
  requests** — no API keys, no accounts, no sync. (Vercel Analytics collects page views only.)
- **Offline always.** Not "offline capable" — offline is the normal case.
- **Structure over free text.** A tool exists to impose fields on something you'd otherwise
  scribble in Notes. If a feature doesn't store a record or drive a reminder, it doesn't belong.
- **No calculators.** If Google, the OS, or a bank app answers it in one query, it's out.
- **One tool = one page = one route.** Tools never import each other; the Home dashboard reads
  other tools' `localStorage` read-only to build alerts.
- **Mobile-first.** Phone, portrait, installed to the home screen. Bottom nav, no hover-only UI.
- **Bilingual by feel.** Titles mix English and colloquial Malay (`Lupa parking?`,
  `Catat Hutang`, `Kira Duit Raya`); body copy stays English.

## 2. What's in the app (22 entries, 21 routes + 1 external link)

**Expiry & recurrence — the core**

| Tool | Route | Holds |
|---|---|---|
| Document Expiry | `/document-expiry` | passport, roadtax, licence renewal dates |
| Asset & Warranty | `/asset-warranty` | valuables, purchase + warranty end dates |
| Service Reminders | `/service-reminders` | recurring maintenance, next-due dates |
| Commitments | `/commitments` | monthly commitments and due days |
| Countdown Day | `/countdown` | dated events and holidays |
| Catat Hutang | `/debt-tracker` | IOUs both directions, settled flag |

**Structured records**

| Tool | Route | Holds |
|---|---|---|
| Important Numbers | `/important-numbers` | account, policy and ID numbers |
| Expense Manager | `/expense-manager` | income, commitments, spending by month |
| Kira Duit Raya | `/duit-raya` | Raya/Angpao recipients, denominations, totals |
| My Travel History | `/travel-history` | trips taken, plotted on a world map |
| My Books | `/book-tracker` | reading progress, wishlist, quotes |
| Habit Tracker | `/habit-tracker` | habits, daily ticks, streaks |
| Minum | `/water-tracker` | daily hydration against a goal |
| Lupa parking? | `/parking` | GPS + photo of where the car is |

**Privacy utilities** — the reason not to use a website for these

| Tool | Route | Why local |
|---|---|---|
| IC Palang | `/ic-scanner` | watermarked IC copies never leave the phone |
| PDF Editor | `/pdf-editor` | sign and annotate PDFs without uploading them |

**Kept for convenience** (small, offline, no better native option)

Kira Pace `/pace-calculator` · Grocery Budget `/grocery-budget` ·
Restaurant Bill Splitter `/restaurant-splitter` · Spin the wheel `/decision-maker` ·
Randomizer `/randomizer` · Birthday Claim (external link)

Categories used by the catalog: Finance, Auto & Travel, Utilities, Lifestyle,
Health & Fitness, Fun.

## 3. Stack

| Concern | Choice |
|---|---|
| Build | Vite 8, `@vitejs/plugin-react` (needs Node 20.19+ / 22.12+) |
| Language | TypeScript ~6, React 19 |
| Routing | `react-router-dom` 7, `BrowserRouter` |
| Styling | Tailwind 3 + CSS custom properties (`src/index.css`, `src/App.css`) |
| Icons | `lucide-react` |
| PWA | `vite-plugin-pwa`, `registerType: 'autoUpdate'` |
| Structured storage | Dexie (IndexedDB) — blobs only |
| Simple storage | `localStorage` — everything else |
| Maps | Leaflet + react-leaflet (parking); d3-geo + topojson + world-atlas (travel map) |
| PDF | `pdf-lib` (write), `react-pdf`/pdfjs (render) |
| Images | `cropperjs` + `react-cropper`; `sharp` (dev only, icon generation) |
| Drag & drop | `@dnd-kit/*` (Home reordering) |
| Hosting | Vercel, SPA rewrite to `/index.html` |

Scripts: `npm run dev`, `build` (`tsc -b && vite build`), `lint`, `preview`.

## 4. Structure

```
make-icons.mjs    regenerates public/ icons from logo.png — bolt only, on #0f172a
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

Pages are self-contained: state, persistence, logic and markup in one file. Deliberate — there
is no shared "tool framework" and none should be added until three tools genuinely need the
same non-trivial logic. The one exception worth building is the reminder engine (§8).

## 5. Shell (`Layout.tsx`)

- **Header** with title/back, hides on scroll-down.
- **Bottom nav**: Home, user-pinned tools (`pinnedTools`), More menu, Settings. Hideable.
- **Notification bar**: on Home, scrolling down swaps the bottom bar for a rotating alert
  ticker fed by a `home:alerts` `CustomEvent` from `Home.tsx`, ordered by `home_alert_order`.
- **Theme**: dark default; `html.light` swaps the palette, persisted in `theme`. Tailwind
  colors resolve from `--color-*` RGB triples — use the semantic classes (`bg-surface`,
  `text-muted`), never hardcoded slate/zinc.
- **Install prompt**: `beforeinstallprompt` is captured in `main.tsx` before React mounts and
  rebroadcast as `pwa-installable`; Layout shows the CTA when not already standalone.

## 6. Home (`Home.tsx`)

Catalog + dashboard. Owns the registry `DEFAULT_TOOLS` (`id`, `to`, `title`, `desc`, `Icon`,
`category`, hover classes).

- View modes: `list` | `grid` (2/3/4 cols) | `category` | `alphabet`, persisted.
- Favorites, last-5 recents, manual drag reorder (dnd-kit), search, NEW/HOT badges.
- Badges come from two lists: `NEW_TOOLS` (a launch date — `new` for 7 days, then it rolls over
  to `hot` forever) and `HOT_IDS`. So clearing a tool's HOT badge means removing it from **both**;
  dropping it from `HOT_IDS` alone leaves a stale `NEW_TOOLS` date still rendering `hot`.
- **Alerts**: reads other tools' `localStorage` and emits alerts of type
  `document | event | commitment | water | debt | expense | habit | warranty | service`, each
  with `daysLeft` (and sometimes `percentage`) used for sorting and the progress fills.
- Animations are user-toggleable (`handy-animations`) — respect the flag in new tools.

## 7. Data

**Dexie (`HandyToolsDB`, v2)** — only where a Blob must be kept: `parkingLocations` (photo +
GPS), `pdfSignatures`, `pdfTexts`.

**localStorage** — everything else, one or more keys per tool:
`de_documents`, `cd_events`, `asset_warranty_tracker_data`, `asset_warranty_custom_categories`,
`service_reminders_data`, `debt_tracker_data`, `debt_tracker_ious`, `expense_manager_data`,
`duit_raya_manager_data`, `habit_tracker_data`, `water_tracker_data`, `book_tracker_data`,
`book_tracker_custom_categories`, `gb_budget`, `gb_items`, `rs_people`, `rs_taxes`,
`dm_options`, `dm_question`, `dm_isMultiSpin`, `dm_totalSpins`, `pc_*` (pace).

Shell/dashboard keys: `theme`, `pinnedTools`, `handy-animations`, `handy-tools-favorites`,
`handy-tools-recents`, `handy-tools-recents-minimized`, `home_view_mode`, `home_grid_cols`,
`home_tool_order`, `home_alert_order`, `hot_tools_promoted_v3`.

Keys left behind by the removed tools (`fin_*`, `lc_*`, `aff_*`, `es_*`, `tb_trips`,
`fuel_custom_prices`, `packing_items`, `paycheck_config`, `vt_records`, `bmi_height`,
`bmi_weight`, `my_checklists_data`, `nak_beli_data`, `emergency_card_data`) are now dead. Nothing
reads them; they sit harmlessly in existing installs until the user clears site data.

Rules for new tools: unique key prefix; wrap every read in try/catch with a default (corrupt or
missing JSON must never white-screen the app); never store secrets.

## 8. Reminders (the gap)

Alert logic currently lives as ~9 hardcoded branches inside `Home.tsx`, each parsing a
different tool's storage shape. Under the product thesis this is backwards: every tool should
write `{ title, dueDate, repeat, toolRef }` into one shared reminders store, and Home and the
nav bar should just render it sorted. Then a new tool gets reminders for free.

Notifications today only appear **while the app is open** — which is exactly the forgetting
problem the app exists to fix. Real push (or email) requires a server holding push
subscriptions plus a daily job, and would be the first and only justified backend. Until then,
reminders are best-effort on app open.

## 9. Adding a tool

1. `src/pages/YourTool.tsx` — self-contained, own `localStorage` prefix.
2. Route in `App.tsx`.
3. Entry in `DEFAULT_TOOLS` in `Home.tsx` (+ a `NEW_TOOLS` date for the badge).
4. If it has a deadline or threshold, emit an alert from Home's alert effect.
5. Verify: works offline, works in both themes, works with animations off, survives a cleared
   or corrupt storage key.

Before adding one, answer: **what record does it hold, and what does it remind me of?** No
answer means no tool.

## 10. Non-goals

No backend (until push), no accounts, no cross-device sync. No i18n framework. No test suite
or component library today — add either only when a concrete failure demands it.
