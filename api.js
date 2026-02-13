/*
    ملف API الرسمي للنظام الجديد
    جميع الصفحات تعتمد عليه
*/

const API_URL = "https://script.google.com/macros/s/AKfycbznQtjojuZpFnsqWdz0-8wNlho75FbOigJoQn47OnW26gLOzaWJZ3QgP67t7eKII8_6DA/exec";

/* 🔥 تعطيل كاش Service Worker لهذا الملف */
if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "SKIP_CACHE", file: "api.js" });
}

/*
    🔵 GET REQUEST
*/
async function apiGet(params = {}) {

    // 🔥 يمنع الكاش من GitHub Pages + Service Worker + المتصفح
    params._ = Date.now();

    const url = API_URL + "?" + new URLSearchParams(params).toString();

    try {
        const res = await fetch(url, {
            method: "GET",
            cache: "no-store",   // 🔥 يمنع SW من تخزينه
            headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        });

        return await res.json();
    } catch (e) {
        return { success: false, error: "network_error" };
    }
}

/*
    🟡 POST REQUEST
*/
async function apiPost(params = {}) {

    params._ = Date.now();

    const form = new FormData();
    for (const key in params) {
        form.append(key, params[key]);
    }

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            cache: "no-store",   // 🔥 يمنع SW من تخزينه
            body: form
        });

        return await res.json();
    } catch (e) {
        return { success: false, error: "network_error" };
    }
}
