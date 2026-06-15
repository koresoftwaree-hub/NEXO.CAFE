const CACHE_NAME = 'nexo-cache-v3'; 

// Lista de archivos clave que el celular debe guardar en memoria
const urlsToCache = [
  './',
  './index.html',
  './caja.html',
  './admin.html',
  './manifest.json',
  './icon.png',
  
  // Archivos de las carpetas
  './css/style.css',
  './css/caja.css',
  './js/firebase-config.js',
  './js/app.js',
  './js/caja.js'
  // ❌ Se borró la librería de qrcodejs de aquí
];

// 1. INSTALACIÓN: Guarda los archivos en caché
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Archivos de Nexo Cafe cacheados correctamente');
        return cache.addAll(urlsToCache);
      })
  );
  // Fuerza al Service Worker a activarse inmediatamente
  self.skipWaiting(); 
});

// 2. ACTIVACIÓN: Limpia cachés viejos si actualizas la app
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Borrando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. FETCH: Estrategia Stale-While-Revalidate (Ultra Rápida + Siempre Actualizada)
self.addEventListener('fetch', (event) => {
  // Ignoramos peticiones a Firebase, extensiones del navegador y al servidor de QR
  if (
    event.request.url.includes('firestore.googleapis.com') || 
    event.request.url.includes('identitytoolkit') ||
    event.request.url.includes('api.qrserver.com') || // ✅ Volvimos a ignorar la API del QR
    !event.request.url.startsWith('http')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Lanzamos la petición a internet en segundo plano para buscar novedades
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Si la red nos trae un archivo nuevo y válido, lo guardamos silenciosamente en el caché
        if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }
        return networkResponse;
      }).catch(() => {
        // Ignoramos errores de red (el usuario está offline, usará el caché)
      });

      // Devolvemos el caché instantáneo si existe.
      return cachedResponse || fetchPromise;
    })
  );
});
