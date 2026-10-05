// Bump this version on EVERY code deploy/edit. A new version forces the
// browser to install a fresh service worker and (via `activate`) delete the
// old cache, so users always receive the latest HTML/CSS/JS instead of stale
// cached copies. v92: robust UISelect positioning, dynamic option observer, and shipping insight filter reliability.
const CACHE_NAME = 'planner-cache-v92';
const urlsToCache = [
    '/',
    '/index.html',
    '/loose_load_planner.html',
    '/volume_capacity_planner.html',
    '/do_summary_generator.html',
    '/truck_planning.html',
    '/shipping_insight.html',
    '/do_details.html',
    '/do_activity_trend.html',
    '/challenger_list.html',
    '/batch_analytics.html',
    '/do_load_planner.html',
    '/packing_sheet.html',
    '/ocr_scanner.html',
    '/css/styles.css',
    '/js/loose_load_planner.js',
    '/js/volume_capacity_planner.js',
    '/js/do_summary_generator.js',
    '/js/components/ui-select.js',
    '/js/components/ui-date-picker.js',
    '/js/components/ui-tooltip.js',
    '/manifest.json',
    '/icons/icon.svg',
    // Packing List App (integrated module, self-contained in /packing-sheet/)
    '/packing-sheet/index.html',
    '/packing-sheet/css/main.css',
    '/packing-sheet/js/icons.js',
    '/packing-sheet/js/main.js',
    '/packing-sheet/js/App.js',
    '/packing-sheet/js/data/sampleData.js',
    '/packing-sheet/js/utils/verifyDo.js',
    '/packing-sheet/js/utils/lookupParser.js',
    '/packing-sheet/js/utils/excelExport.js',
    '/packing-sheet/js/utils/packingImport.js',
    '/packing-sheet/js/utils/excelImport.js',
    '/packing-sheet/js/components/StatsBar.js',
    '/packing-sheet/js/components/HeaderControls.js',
    '/packing-sheet/js/components/QuickImportModal.js',
    '/packing-sheet/js/components/MasterLookupModal.js',
    '/packing-sheet/js/components/ConfirmVerifyModal.js',
    '/packing-sheet/js/components/ConfirmDialog.js',
    '/packing-sheet/js/components/PackingSheetForm.js',
    '/packing-sheet/js/vendor/react.production.min.js',
    '/packing-sheet/js/vendor/react-dom.production.min.js',
    '/packing-sheet/js/vendor/xlsx.full.min.js',
    '/packing-sheet/js/vendor/exceljs.min.js',
    '/packing-sheet/js/vendor/tailwind.js'
];

self.addEventListener('install', event => {
    // Take control as soon as the new SW finishes installing (no waiting for
    // all existing tabs to close), so cache-busting version bumps apply fast.
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                // Use a try-catch for addAll, or fetch individual items so if one fails the rest still cache
                return Promise.allSettled(
                    urlsToCache.map(url => {
                        return cache.add(url).catch(err => {
                            console.warn(`[Service Worker] Failed to cache ${url}:`, err);
                        });
                    })
                );
            })
    );
});

// App code (HTML/CSS/JS) must ALWAYS come from the network when online so
// users never see stale code. Only fall back to cache when offline.
// Static vendor assets keep the network-first-then-cache behaviour.
function isAppCode(request) {
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return false;
    return request.mode === 'navigate'
        || /\.(html|css|js)$/.test(url.pathname)
        || url.pathname === '/' ;
}

self.addEventListener('fetch', event => {
    const { request } = event;

    // Only handle GET; let everything else pass through.
    if (request.method !== 'GET') return;

    // NETWORK-FIRST for app code: try network, update cache, fall back to cache offline.
    if (isAppCode(request)) {
        event.respondWith(
            fetch(request, { cache: 'no-store' })
                .then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
                    }
                    return networkResponse;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // DEFAULT (vendor/CDN/etc.): network-first, cache update, offline fallback.
    event.respondWith(
        fetch(request)
            .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
                }
                return networkResponse;
            })
            .catch(() => caches.match(request))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            ))
            // Immediately control all open pages so the new cache/code is used
            // without requiring a manual reload.
            .then(() => self.clients.claim())
    );
});
