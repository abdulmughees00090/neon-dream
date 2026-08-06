// Neon Dream Service Worker v1.1.0
const CACHE_NAME = 'neon-dream-v2';
const OFFLINE_URL = '/offline.html';

// Files to cache on install
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/index.html',
  '/favicon.ico',
  '/favicon.png'
];

// Assets with versioning - cache on fetch
const DYNAMIC_CACHE_URLS = [
  '/pricing.html',
  '/terms.html',
  '/privacy.html',
  '/refund.html'
];

// Install event - cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pre-caching offline assets');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first with cache fallback
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Skip cross-origin requests
  if (requestUrl.origin !== location.origin) {
    return;
  }
  
  // HTML pages - network first, fallback to cache, then offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the fresh response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }
  
  // Static assets - cache first, network fallback
  if (event.request.destination === 'style' ||
      event.request.destination === 'script' ||
      event.request.url.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/)) {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached version, but update in background
            fetch(event.request).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse);
                });
              }
            }).catch(() => {});
            return cachedResponse;
          }
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
            return networkResponse;
          }).catch(() => {
            if (event.request.destination === 'style') {
              return new Response('', { status: 200, headers: { 'Content-Type': 'text/css' } });
            }
            return new Response('', { status: 200 });
          });
        })
    );
    return;
  }
  
  // Everything else - network first, no cache fallback
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        if (event.request.destination === 'image') {
          return new Response('', { status: 200, headers: { 'Content-Type': 'image/png' } });
        }
        return new Response('Network error occurred', { status: 408, statusText: 'Network Error' });
      })
  );
});

// Background sync for analytics or payments
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-analytics') {
    event.waitUntil(sendAnalyticsData());
  }
});

function sendAnalyticsData() {
  // Implement if you want to queue analytics when offline
  return Promise.resolve();
}

// Push notification support (optional)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Your quiet space awaits.',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      url: '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('Neon Dream', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
