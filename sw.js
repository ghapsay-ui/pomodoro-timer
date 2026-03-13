/**
 * Pomodoro Timer Pro - Service Worker (sw.js)
 * Strategy: Cache-First, Network-Fallback
 */

const CACHE_NAME = 'pomodoro-pro-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './zustand.js',
    './manifest.json'
];

// 1. Install Event: Save all files to the local cache
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('PWA: Pre-caching offline assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); // Force the new service worker to become active immediately
});

// 2. Activate Event: Clean up old caches from previous versions
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('PWA: Clearing old cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// 3. Fetch Event: Serve files from cache if available, otherwise go to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Return the cached file OR fetch from internet
            return response || fetch(event.request).catch(() => {
                // Optional: Return a custom offline page if both fail
                console.log('PWA: Asset not in cache and no internet connection.');
            });
        })
    );
});
