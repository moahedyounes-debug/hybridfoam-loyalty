/*
    ملف API الرسمي للنظام الجديد
    جميع الصفحات تعتمد عليه
*/
console.log("API JS VERSION:", Date.now());

const API_URL = "https://script.google.com/macros/s/AKfycbxl9KqogxgM4ZWizxCD4wl_F3AY4PYZzYItH1a3IsJVvpK0qH7iNEpRc0VH6EVaxwIpQA/exec";

/* 🔥 تعطيل كاش Service Worker لهذا الملف */
if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "SKIP_CACHE", file: "api.js" });
}

/*
    🔵 GET REQUEST (تحويل GET إلى POST داخليًا لتجاوز CORS)
*/
async function apiGet(params = {}) {

    params.action = params.action || "getAll";
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

/*
    🟡 POST REQUEST
*/
async function apiPost(params = {}) {

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
