# SenangKit — Specification

An offline-first PWA for **structured personal records that expire or recur**. The problem it
solves: notes apps let you write anything, which means you never look at it again and you miss
the renewal, the warranty, the service, the debt. SenangKit gives each kind of record a fixed
shape so it can be entered fast, read at a glance, and surfaced *before* the deadline.

Stateless calculators and anything the web or the OS already does well were removed on
2026-07-30 (15 tools: Financial Hub, Currency Converter, Fuel & Tolls, Can I Afford It, Trip
Budget, Speed Test, Speedometer, Expense Splitter, Group Split Bill, Carpool Splitter, Packing
Checklist, Payday Countdown, Vehicle Tracker, BMI Calculator, Unit Converter). Checklists,
Nak Beli and Medical ID were dropped the same day — 18 removed in total, 40 entries down to 22,
then Birthdays and Sewa & Kontrak were added, bringing it to 24. On 2026-08-05 the single
Service Reminders tool was split into Servis Kenderaan and Servis Rumah — 25 entries.

## 1. Product rules

- **Device-first, account-optional.** `localStorage` remains the source of truth on the device;
  the server is a mirror. Signed out, every tool still works — data just lives in
  `sessionStorage` and dies with the tab. Sign in with Google and 15 of the 25 entries sync to
  Postgres. The other 10 never touch the network at all (§7).
- **Offline always.** Not "offline capable" — offline is the normal case. Nothing about sync is
  allowed to weaken this: the boot pull is behind a 1.5s timeout and can never delay or block
  the first paint, and every write lands locally and synchronously before the network is
  considered.
- **Network calls are few and named.** `/api/bootstrap` on start when signed in, Google's
  `gsi/client` script when the user taps Sign in, and the Google Fonts stylesheet in
  `index.css:1` (which has always been there, contrary to what this line used to claim).
  Leaflet also fetches OSM tiles inside `/parking`. There is no analytics.
- **`/` is a landing page; the app lives at `/app`.** Marketing renders outside the app shell;
  the PWA's `start_url` is `/app` so installed users never see it.
- **Structure over free text.** A tool exists to impose fields on something you'd otherwise
  scribble in Notes. If a feature doesn't store a record or drive a reminder, it doesn't belong.
- **No calculators.** If Google, the OS, or a bank app answers it in one query, it's out.
- **One tool = one page = one route.** Tools never import each other; the Home dashboard reads
  other tools' `localStorage` read-only to build alerts.
- **Mobile-first.** Phone, portrait, installed to the home screen. Bottom nav, no hover-only UI.
- **Bilingual by feel.** Titles mix English and colloquial Malay (`Lupa parking?`,
  `Catat Hutang`, `Kira Duit Raya`); body copy stays English.

## 2. What's in the app (25 entries, 24 routes + 1 external link)

**Expiry & recurrence — the core**

| Tool | Route | Holds |
|---|---|---|
| Document Expiry | `/document-expiry` | passport, roadtax, licence renewal dates |
| Asset & Warranty | `/asset-warranty` | valuables, purchase + warranty end dates |
| Garaj | `/vehicle-services` | vehicle fleet, service log, fuel/charge log, running cost per km |
| Servis Rumah | `/home-services` | home repairs/servicing log, cost, next-due dates |
| Commitments | `/commitments` | monthly commitments and due days |
| Countdown Day | `/countdown` | dated events and holidays |
| Catat Hutang | `/debt-tracker` | IOUs both directions, settled flag |
| Birthdays | `/birthdays` | birthdays + anniversaries, annual recurrence, gift ideas |
| Sewa & Kontrak | `/tenancy` | tenancy/contract end dates, monthly amount + due day, deposit |

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
| Structured storage | Dexie (IndexedDB) — blobs only, never synced |
| Simple storage | `src/lib/store.ts` over `localStorage` / `sessionStorage` |
| Server | Node ≥22.18 (native TS stripping, no build step), `hono` + `@hono/node-server` |
| Database | Postgres via `pg`, raw SQL, numbered `.sql` migrations run at boot |
| Auth | Google Identity Services → server-verified ID token → opaque session cookie |
| Tests | `node --test` — 23 client, 85 server |
| Maps | Leaflet + react-leaflet (parking); d3-geo + topojson + world-atlas (travel map) |
| PDF | `pdf-lib` (write), `react-pdf`/pdfjs (render) |
| Images | `cropperjs` + `react-cropper`; `sharp` (dev only, icon generation) |
| Drag & drop | `@dnd-kit/*` (Home reordering) |
| Hosting | Railway — one service serves `dist/` and `/api` from the same origin |

Scripts: `npm run dev` (Vite, proxies `/api` to :3000), `dev:server`, `build`
(`tsc -b && vite build`), `start` (`node server/index.ts`), `lint`, `test`, `test:server`.

Env: `DATABASE_URL`, `VITE_GOOGLE_CLIENT_ID` (public — this flow has no client secret).
Both optional: with neither set the app boots and every tool works, sign-in just says it
isn't configured.

## 4. Structure

```
make-icons.mjs    regenerates public/ icons from logo.png — bolt only, on #0f172a
server/
  index.ts        entry: runs migrations, then listens
  app.ts          routes + static/SPA serving (separate so tests can drive app.fetch)
  db.ts           pool, boot migration runner (advisory-locked), tx() helper
  auth.ts         Google token verification, sessions, requireUser, CSRF origin check
  tools.ts        per-tool blob <-> rows mappers. Adding a tool = one entry + one migration
  migrations/     001_auth, 002_sync, 003_simple_tools, 004_remaining_tools
src/
  main.tsx        entry; applies the saved theme, awaits store bootstrap before first paint
  App.tsx         router — landing at /, then a PATHLESS <Layout> route so every tool keeps
                  its original URL while the catalog sits at /app. Catch-all redirects to /.
  lib/tools.ts    DEFAULT_TOOLS registry + the derived MAIN_TOOLS / SIDE_TOOLS split
  components/landing/  Landing, ExpiryWall (the hero signature), ToolSections
  db.ts           Dexie schema (v2) — device-local blobs, never synced
  index.css       theme variables + ~30 keyframe animations shared by tools
  lib/
    store.ts      the storage boundary (§7). Pages call this, not localStorage
    auth.ts       sign-in state, lazy GIS loading
    downscale.ts  shared image shrinking before anything is stored
  components/
    Layout.tsx    app shell: header, bottom nav, pinned tools, settings, notification bar
    AccountPanel.tsx, ImportPrompt.tsx
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
- Favorites (drag-reorderable, dnd-kit), last-5 recents, search, NEW/HOT badges.
- The catalog itself has a **fixed order and is not reorderable** — `DEFAULT_TOOLS` is laid out in
  §2 priority order (expiry & recurrence, then structured records, then privacy utilities), and
  `EXTRA_IDS` splits the "kept for convenience" tools (plus Minum) out into a **Lain-lain**
  section at the bottom. Reordering a tool means moving it in the registry, not shuffling it per device.
- Badges: `NEW_TOOLS` (a launch date — `new` for 7 days) then `HOT_IDS`, which alone decides
  `hot`. An expired `NEW_TOOLS` date no longer implies `hot`.
- **Alerts**: reads other tools' `localStorage` and emits alerts of type
  `document | event | commitment | water | debt | expense | habit | warranty | service`, each
  with `daysLeft` (and sometimes `percentage`) used for sorting and the progress fills.
- New tools should reuse an existing alert type rather than add one: a type costs a branch in
  the card colour ternary, the icon ternary, the prefix line, and `ALERT_PREFIX` in Layout.
  Birthdays reuse `event`; Sewa & Kontrak reuses `document` (contract ending) and `commitment`
  (rent due); Servis Kenderaan and Servis Rumah both reuse `service`.
- Animations are user-toggleable (`handy-animations`) — respect the flag in new tools.

## 7. Data

Everything goes through **`src/lib/store.ts`**, which has a `localStorage`-shaped API and
routes each key into one of three tiers:

| Tier | Signed out | Signed in |
|---|---|---|
| **Synced** (19 keys, 15 tools) | `sessionStorage`, read-only fallback to any pre-existing `localStorage` value | memory + `acct:`-prefixed `localStorage` mirror + debounced push |
| **Device prefs** | `localStorage` | `localStorage` — never synced |
| **Stateless tools** | `localStorage` | `localStorage` — never synced |

The read-only legacy fallback is load-bearing: without it every existing install would open to
an empty app the day this shipped.

**Synced keys** — `birthdays_data`, `tenancy_data`, `de_documents`, `cd_events`,
`debt_tracker_ious`, `habit_tracker_data`, `important_numbers_data`, `expense_manager_data`,
`duit_raya_manager_data`, `travel_history_data`, `water_tracker_data`,
`garage_fleet`, `garage_records`, `garage_logs`, `home_services_data`, `home_custom_titles`,
`asset_warranty_tracker_data`, `asset_warranty_custom_categories`, `book_tracker_data`,
`book_tracker_custom_categories`.

`SYNCED_KEYS` and the server's `TOOLS` map must match exactly — a key on one side only pushes
to a 404 forever, silently. There is a test asserting it.

**Never synced** — IC Palang, PDF Editor, Lupa parking?, Kira Pace, Grocery Budget, Restaurant
Bill Splitter, Spin the wheel, Randomizer. Their keys (`gb_*`, `rs_*`, `dm_*`, `pc_*`) and all
shell prefs (`theme`, `pinnedTools`, `handy-animations`, `handy-tools-favorites`,
`handy-tools-recents`, `handy-tools-recents-minimized`, `home_view_mode`, `home_grid_cols`,
`home_alert_order`, `sk_img_v2_*`) stay per-device
on purpose.

**Dexie (`HandyToolsDB`, v2)** — Blobs only, device-local, never synced: `parkingLocations`
(photo + GPS), `pdfSignatures`, `pdfTexts`.

**Server** — real typed tables per tool, 25 in total. Writes replace a whole tool's rows in one
transaction; each tool carries a `rev` and a stale push gets `409` plus the server's copy
rather than silently overwriting another device. Three details that corrupt data if forgotten:

- `water_days` is keyed `(user_id, date)` and **upserted, never delete-then-inserted** — the
  device keeps one day, the server accumulates the history it throws away.
- The water date is **unpadded** (`2026-8-6`) and string-compared. Return a padded date and
  the tracker decides it's a new day and resets today's intake to zero.
- Optional fields must come back **absent, not `null`** (`dropNulls`), or every round trip
  changes the blob's shape.

Keys left behind by the removed tools (`fin_*`, `lc_*`, `aff_*`, `es_*`, `tb_trips`,
`fuel_custom_prices`, `packing_items`, `paycheck_config`, `vt_records`, `bmi_height`,
`bmi_weight`, `my_checklists_data`, `nak_beli_data`, `emergency_card_data`,
`service_reminders_data`) are now dead. Nothing
reads them; they sit harmlessly in existing installs until the user clears site data.

Rules for new tools: unique key prefix; go through `store`, never `localStorage` directly;
wrap every read in try/catch with a default (corrupt or missing JSON must never white-screen
the app — and once a value can arrive from an API response, that stops being theoretical).

**`important_numbers_data` holds account, policy and ID numbers.** It syncs, and it is not
encrypted beyond the host's disk encryption. That is a deliberate, known trade against the
app's original "nothing leaves the device" pitch.

## 8. Reminders

Alert logic still lives as ~12 hardcoded branches inside `Home.tsx`, each parsing a different
tool's storage shape. Every tool should instead write `{ title, dueDate, repeat, toolRef }`
into one shared reminders store, so a new tool gets reminders for free.

Notifications still only appear **while the app is open**. The backend that used to be the
blocker now exists — `habit_completions` and `commitment_payments` were deliberately exploded
into rows rather than kept as JSON precisely so a daily job can query them. What remains is
push subscriptions plus a scheduler.

## 9. Adding a tool

1. `src/pages/YourTool.tsx` — self-contained, own key prefix, reads/writes via `store`.
2. Route in `App.tsx`.
3. Entry in `DEFAULT_TOOLS` in `Home.tsx` (+ a `NEW_TOOLS` date for the badge).
4. If it has a deadline or threshold, emit an alert from Home's alert effect.
5. If it should sync: add the key to `SYNCED_KEYS`, a descriptor to `server/tools.ts`, a
   migration, and a fixture to `server/tools.test.ts`. If it shouldn't, do none of that — it
   keeps working exactly as before.
6. Verify: works offline, works signed out, works in both themes, works with animations off,
   survives a cleared or corrupt storage key.

Before adding one, answer: **what record does it hold, and what does it remind me of?** No
answer means no tool.

## 10. Non-goals

No i18n framework. No component library. No ORM — every write is "replace this tool's rows in
a transaction", which is where Drizzle and Prisma earn nothing.

Deliberately deferred, each with a named trigger:

| Shortcut | Upgrade when |
|---|---|
| Whole-blob replace per tool, last-write-wins guarded by `rev` + 409 | concurrent multi-device editing becomes real |
| Images as base64 `text` inside the tool blob (downscaled to 300/600/900px client-side) | any single tool blob passes ~5MB |
| Forward-only migrations, no down files | a bad migration actually ships |
| Dexie blobs stay device-local | someone asks for parking photos across devices |
| `travel_history_data` exploded across 4 tables | never — but jsonb `itinerary`/`checklist` is the escape hatch if it becomes a maintenance cost |

Tests cover the paths that move user data: descriptor round-trips per tool, the API's auth /
conflict / import behaviour, and the store's tier routing, offline queueing and import flow.
They are not a general test suite and shouldn't grow into one.
