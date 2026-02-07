// رابط الـ API
const API_URL = "https://script.google.com/macros/s/AKfycbzhV1_rDRVPmbIhxyPDKx2yTTnXU0cPLBPaJ3iodITD76aK_DX0vDD-C0rx0FaNu812tQ/exec";

// GET Request
async function apiGet(params) {
    const url = API_URL + "?" + new URLSearchParams(params);
    const res = await fetch(url);
    return res.json();
}

// POST Request
async function apiPost(body) {
    const form = new FormData();
    Object.keys(body).forEach(key => form.append(key, body[key]));

    const res = await fetch(API_URL, {
        method: "POST",
        body: form
    });

    return res.json();
}
