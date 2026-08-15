import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    allowedHosts: true,
    // Same-origin in dev too, or the httpOnly session cookie is silently dropped and auth
    // works in production but mysteriously not locally.
    //
    // /admin is server-rendered and has no client route, so without it here Vite answers with
    // index.html, React matches nothing, and the `*` catch-all redirects to the landing page —
    // the page looks like it silently does nothing. Production serves both from one origin and
    // never needs this.
    proxy: { '/api': 'http://localhost:3000', '/admin': 'http://localhost:3000' }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // favicon.svg is the header logo, not just a tab icon — without it precached the app
      // header renders a broken image offline.
      includeAssets: ['favicon.svg', 'favicon.png', 'apple-touch-icon.png'],
      workbox: {
        // Without this the SW answers /api/* navigations out of the precache with index.html,
        // and the client parses HTML as JSON. Only bites once the API is same-origin.
        // /admin is server-rendered and has no client route, so the same fallback would hand it
        // index.html, React would match nothing, and the `*` catch-all would bounce you to `/` —
        // working in a fresh browser and silently failing in the installed PWA.
        navigateFallbackDenylist: [/^\/api\//, /^\/admin/],
        cleanupOutdatedCaches: true,
        // Push and notificationclick handlers. Kept out of this config so generateSW keeps
        // owning precaching and the denylist above.
        importScripts: ['/push-sw.js']
      },
      manifest: {
        name: 'SenangKit',
        short_name: 'SenangKit',
        // Plugin default is 'en'; index.html declares ms and the description below is Malay.
        lang: 'ms',
        description: 'Simpan rekod yang ada tarikh luput — roadtax, pasport, warranty, sewa, hari jadi, hutang — dan dapat peringatan sebelum tarikh sampai.',
        // #101010 is --color-background in dark mode (src/index.css), which is what the app
        // actually paints. The old #0f172a was slate-900 and belonged to nothing on screen, so
        // the splash and Android status bar flashed a blue-grey the app never uses.
        theme_color: '#101010',
        background_color: '#101010',
        display: 'standalone',
        // Installed users go straight to the tools; `/` is the marketing page and would be a
        // pointless ad for an app they already have. Landing.tsx also redirects out of
        // standalone, for installs whose manifest hasn't been refetched yet.
        start_url: '/app',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
})
