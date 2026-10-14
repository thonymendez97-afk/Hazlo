/* ¡Hazlo! — trabajador de servicio.
   Guarda la app en el teléfono para que abra sin internet y abre la app al tocar una notificación.
   Cuando publiques cambios, sube el número de VERSION para que todos reciban la versión nueva. */
const VERSION = 'hazlo-v3';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png', './icons/badge-96.png',
  './fonts/fredoka-500.woff2', './fonts/fredoka-600.woff2', './fonts/fredoka-700.woff2',
  './fonts/nunito-600.woff2', './fonts/nunito-700.woff2', './fonts/nunito-800.woff2',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // La página: primero internet (para recibir cambios); sin conexión, la copia guardada.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (!res.ok) return caches.match('./index.html').then(hit => hit || res);   // si la página falla, la copia guardada
          const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // El resto: la copia guardada al instante y, por detrás, se actualiza para la próxima vez.
  event.respondWith(
    caches.open(VERSION).then(cache => cache.match(req).then(hit => {
      const fresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || fresh;
    }))
  );
});

// Aviso del servidor: llega aunque la app esté cerrada.
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || '¡Hazlo!', {
    body: d.body || 'Tienes una tarea pendiente',
    tag: d.tag || 'hazlo', renotify: true,
    icon: 'icons/icon-192.png', badge: 'icons/badge-96.png',
    data: { id: d.id || '' },
  }));
});

// Tocar una notificación abre (o trae al frente) la app.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow('./');
    })
  );
});
