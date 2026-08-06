import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    allowedHosts: true,
    // Same-origin in dev too, or the httpOnly session cookie is silently dropped and auth
    // works in production but mysteriously not locally.
    proxy: { '/api': 'http://localhost:3000' }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      workbox: {
        // Without this the SW answers /api/* navigations out of the precache with index.html,
        // and the client parses HTML as JSON. Only bites once the API is same-origin.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true
      },
      manifest: {
        name: 'SenangKit',
        short_name: 'SenangKit',
        description: 'A lightweight offline-capable tools app',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
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
