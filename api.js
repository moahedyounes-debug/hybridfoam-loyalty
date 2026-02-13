/*
    ملف API الرسمي للنظام الجديد
    جميع الصفحات تعتمد عليه
*/
console.log("API JS VERSION:", Date.now());

const API_URL = "https://script.google.com/macros/s/AKfycbwcsxE4qiIJuNNvD3XIPGWBRJhG8hQr2TA9LGaM4Y2hBV1E0ZQELMLSp1k_cByfmFSKHw/exec";

/* 🔥 تعطيل كاش Service Worker لهذا الملف */
if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "SKIP_CACHE", file: "api.js" });
}

/*
    🔵 GET REQUEST
*/
async function apiGet(params = {}) {

    // 🔥 يمنع الكاش من GitHub Pages + Service Worker + المتصفح
    // تم تغيير "_" إلى "t" لأن "_" يسبب مشاكل GET مع Google Apps Script
    params.t = Date.now();

    const url = API_URL + "?" + new URLSearchParams(params).toString();

    try {
        const res = await fetch(url, {
            method: "GET",
            cache: "no-store",
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

    // نفس الشي هنا — تغيير "_" إلى "t"
    params.t = Date.now();

    const form = new FormData();
    for (const key in params) {
        form.append(key, params[key]);
    }

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            cache: "no-store",
            body: form
        });

        return await res.json();
    } catch (e) {
        return { success: false, error: "network_error" };
    }
}
