const CACHE_NAME = 'planner-cache-v2';
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
    '/css/styles.css',
    '/js/loose_load_planner.js',
    '/js/volume_capacity_planner.js',
    '/js/do_summary_generator.js',
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
    '/packing-sheet/js/components/PackingSheetForm.js',
    '/packing-sheet/js/vendor/react.production.min.js',
    '/packing-sheet/js/vendor/react-dom.production.min.js',
    '/packing-sheet/js/vendor/xlsx.full.min.js',
    '/packing-sheet/js/vendor/exceljs.min.js',
    '/packing-sheet/js/vendor/tailwind.js'
];

self.addEventListener('install', event => {
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

self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // If network fetch is successful, clone it and update the cache
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // If network fails (offline), fallback to cache
                return caches.match(event.request);
            })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
