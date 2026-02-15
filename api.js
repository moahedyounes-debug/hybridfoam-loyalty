// api.js – موحد لكل المشروع

const API_URL = 'https://script.google.com/macros/s/AKfycbxybD4tx9fy5QI9mJktGIiRoCrfaeX5FDeyfT6aQpR7XnRI2m3t5lSRNXhvWqRNoDMuFA/exec'



async function apiPost(params) {
  const form = new URLSearchParams();
  Object.keys(params).forEach(k => {
    if (params[k] !== undefined && params[k] !== null) {
      form.append(k, params[k]);
    }
  });

  const res = await fetch(API_URL, {
    method: 'POST',
    body: form
  });

  return res.json();
}

async function apiGetAll(sheet) {
  return apiPost({ action: 'getAll', sheet });
}

// اختصارات سريعة

async function apiLoginSupervisor(username, password) {
  return apiPost({
    action: 'loginSupervisor',
    username,
    password
  });
}

async function apiGetCustomerByPhone(phone) {
  return apiPost({
    action: 'getCustomerByPhone',
    phone
  });
}

async function apiGetCustomerByMembership(membership) {
  return apiPost({
    action: 'getCustomerByMembership',
    membership
  });
}

async function apiGetCarsByPhone(phone) {
  return apiPost({
    action: 'getCarsByPhone',
    phone
  });
}

async function apiGetCarByMembership(membership) {
  return apiPost({
    action: 'getCarByMembership',
    membership
  });
}

async function apiAddCar(data) {
  return apiPost({
    action: 'addCar',
    ...data
  });
}

async function apiGetVisitsByMembership(membership) {
  return apiPost({
    action: 'getVisitsByMembership',
    membership
  });
}

async function apiGetBookingsByPhone(phone) {
  return apiPost({
    action: 'getBookingsByPhone',
    phone
  });
}

async function apiAddVisit(data) {
  return apiPost({
    action: 'addVisit',
    ...data
  });
}

async function apiGetActiveVisits() {
  return apiPost({
    action: 'getActiveVisits'
  });
}

async function apiGetServices() {
  return apiPost({
    action: 'getServices'
  });
}

async function apiGetBranches() {
  return apiPost({
    action: 'getBranches'
  });
}
