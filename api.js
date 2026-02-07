const API_URL = "https://script.google.com/macros/s/AKfycbzhV1_rDRVPmbIhxyPDKx2yTTnXU0cPLBPaJ3iodITD76aK_DX0vDD-C0rx0FaNu812tQ/exec";

async function apiGet(params) {
  const res = await fetch(API_URL + "?" + new URLSearchParams(params));
  return res.json();
}

async function apiPost(body) {
  const form = new FormData();
  Object.keys(body).forEach(k => form.append(k, body[k]));
  const res = await fetch(API_URL, { method: "POST", body: form });
  return res.json();
}
