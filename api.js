/*  
    ملف API الرسمي للنظام الجديد  
    جميع الصفحات تعتمد عليه  
*/

const API_URL = "https://script.google.com/macros/s/AKfycbx0gJd8hepF4VlyENOMLOZWAP6_U81-SAt9enoQIpCAH9vgAvHxFhMTWIAx-iNtEA0nuw/exec";

/*  
    🔵 GET REQUEST  
    apiGet({ action: "getAll" })
*/
async function apiGet(params = {}) {
    const url = API_URL + "?" + new URLSearchParams(params).toString();

    try {
        const res = await fetch(url);
        return await res.json();
    } catch (e) {
        return { success: false, error: "network_error" };
    }
}

/*  
    🟡 POST REQUEST  
    apiPost({ action: "registerCustomer", name: "..." })
*/
async function apiPost(params = {}) {
    const form = new FormData();
    for (const key in params) {
        form.append(key, params[key]);
    }

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            body: form
        });

        return await res.json();
    } catch (e) {
        return { success: false, error: "network_error" };
    }
}
