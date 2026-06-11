const CACHE_NAME = 'haccp-lite-v12';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/icon.svg',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS))
  );
  // NO llamamos a self.skipWaiting() automáticamente. 
  // Esperamos la señal del usuario para no romper la app en uso.
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Escuchar mensaje del frontend para actualizar
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', e => {
  // Ignorar API de Supabase y extensiones de Chrome u otros dominios raros
  if (e.request.url.includes('supabase.co') || !e.request.url.startsWith(self.location.origin)) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then(networkResponse => {
        // Opcional: Cachear dinámicamente otros estáticos si es necesario
        // Pero NO la DB
        if(networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return networkResponse;
      });
    }).catch(() => {
      // Fallback offline (ej. si falla la red al pedir una ruta)
      if (e.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
