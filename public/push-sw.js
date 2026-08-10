// Pulled into the generated service worker via workbox.importScripts in vite.config.ts.
//
// A separate file rather than converting the setup to injectManifest: generateSW already
// handles precaching and the navigateFallbackDenylist for /api and /admin, and rebuilding
// that by hand to add twenty lines would risk both.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // A malformed payload must not kill the handler — show something rather than nothing.
  }

  const title = data.title || 'SenangKit';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'senangkit-reminder',
      data: { href: data.href || '/app' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || '/app';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Focus an open tab rather than stacking a second copy of the app.
      for (const client of list) {
        if (client.url.includes(href) && 'focus' in client) return client.focus();
      }
      if (list.length && 'focus' in list[0]) {
        return list[0].focus().then(() => list[0].navigate(href));
      }
      return self.clients.openWindow(href);
    })
  );
});
