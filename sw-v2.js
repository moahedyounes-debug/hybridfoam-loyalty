// اسم الكاش الجديد
const CACHE_NAME = "raghwa-v2";

// الملفات التي نريد تخزينها (بدون api.js)
const ASSETS = [
    "customer-register.html",
    "customer-dashboard.html",
    "customer-login.html",
    "customer-home.html",
    "customer-cars.html",
    "customer-bookings.html",
    "customer-visits.html",
    "customer-notifications.html",
    "customer-rate.html",
    "customer-membership.html",
    "visit-manager.html",
    "visit-manager.js",
    "visit-manager.css",
    "logo.png",
    "manifest.json"
];

// عند التثبيت → نحذف الكاش القديم وننشئ الجديد
self.addEventListener("install", event => {
    event.waitUntil(
        caches.delete(CACHE_NAME).then(() => {
            return caches.open(CACHE_NAME).then(cache => {
                return cache.addAll(ASSETS);
            });
        })
    );
    self.skipWaiting();
});

// عند التفعيل → حذف أي كاش قديم
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// منع تخزين api.js نهائيًا
self.addEventListener("fetch", event => {
    const url = event.request.url;

    // لا نخزن api.js ولا طلبات API
    if (url.includes("api.js") || url.includes("script.google.com")) {
        return event.respondWith(fetch(event.request));
    }

    // باقي الملفات من الكاش
    event.respondWith(
        caches.match(event.request).then(res => {
            return res || fetch(event.request);
        })
    );
});
