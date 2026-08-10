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
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
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
        description: 'A lightweight offline-capable tools app',
        theme_color: '#0f172a',
        background_color: '#0f172a',
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
