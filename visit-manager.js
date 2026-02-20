/* ============================
   الحالة العامة
============================ */
let VM_STATE = {
  services: [],
  employees: [],
  selectedServices: [],
  carTypes: []
};


/* ============================
   عند تحميل الصفحة
============================ */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnSubmitVisit").addEventListener("click", vm_submitVisit);
  document.getElementById("btnAddService").addEventListener("click", vm_addService);
  document.getElementById("btnRefreshActive").addEventListener("click", vm_loadActiveVisits);
  document.getElementById("payment_status").addEventListener("change", vm_togglePaymentMethod);

  vm_loadCarTypes();
  vm_loadServices();
  vm_loadEmployees();
  vm_loadActiveVisits();
});

/* ============================
   Toast
============================ */
function showToast(msg, type = "info") {
  const box = document.getElementById("toast-container");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerText = msg;
  box.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, 2500);
}

/* ============================
   تحميل الموظفين
============================ */
async function vm_loadEmployees() {
  const res = await apiGetEmployees();
  if (!res.success) return;

  VM_STATE.employees = res.rows;
  const select = document.getElementById("employee_in");
  select.innerHTML =
    '<option value="">— اختر الموظف —</option>' +
    VM_STATE.employees.map(e => `<option value="${e[0]}">${e[0]}</option>`).join("");
}

/* ============================
   تحميل أنواع السيارات (Brand → Model → Size)
============================ */
async function vm_loadCarTypes() {
  const res = await apiGetCarTypes();
  if (!res.success || !res.rows.length) return;

  // البيانات: brand | model | size
  VM_STATE.carTypes = res.rows;

  const brandSelect = document.getElementById("car_type");
  const modelSelect = document.getElementById("car_model");
  const sizeInput = document.getElementById("car_size");

  // استخراج البراندات بدون تكرار
  const brands = [...new Set(VM_STATE.carTypes.map(r => r[0]).filter(Boolean))];

  // تعبئة البراندات
  brandSelect.innerHTML =
    `<option value="">— اختر البراند —</option>` +
    brands.map(b => `<option value="${b}">${b}</option>`).join("");

  /* ============================
     عند اختيار البراند
  ============================ */
  brandSelect.onchange = () => {
    const brand = brandSelect.value;

    // إعادة ضبط الموديل والحجم
    modelSelect.innerHTML = `<option value="">— اختر الموديل —</option>`;
    sizeInput.value = "";

    if (!brand) return;

    // جلب الموديلات الخاصة بالبراند
    const models = VM_STATE.carTypes.filter(r => r[0] === brand);

    modelSelect.innerHTML =
      `<option value="">— اختر الموديل —</option>` +
      models
        .map(m => `<option value="${m[1]}" data-size="${m[2]}">${m[1]}</option>`)
        .join("");
  };

  /* ============================
     عند اختيار الموديل → الحجم تلقائي
  ============================ */
  modelSelect.onchange = () => {
    const opt = modelSelect.selectedOptions[0];
    sizeInput.value = opt ? opt.dataset.size : "";
  };
}

/* ============================
   تحميل الخدمات
============================ */
async function vm_loadServices() {
  const res = await apiGetServices();
  if (!res.success) return;

  VM_STATE.services = res.services;

  const typeSelect = document.getElementById("service_type");
  const detailSelect = document.getElementById("service_detail");

  const categories = [...new Set(res.services.map(s => s.category))];

  typeSelect.innerHTML = categories
    .map(c => `<option value="${c}">${c}</option>`)
    .join("");

  typeSelect.addEventListener("change", vm_filterServiceDetails);
  detailSelect.addEventListener("change", vm_updatePrice);

  vm_filterServiceDetails();
}

function vm_filterServiceDetails() {
  const type = document.getElementById("service_type").value;
  const detailSelect = document.getElementById("service_detail");

  const filtered = VM_STATE.services.filter(s => String(s.category) === String(type));

  detailSelect.innerHTML = filtered
    .map(
      s => `
<option value="${s.service}" data-price="${s.price}" data-commission="${s.commission}">
  ${s.service}
</option>`
    )
    .join("");

  vm_updatePrice();
}

function vm_updatePrice() {
  const opt = document.getElementById("service_detail").selectedOptions[0];
  if (!opt) return;

  const price = Number(opt.getAttribute("data-price") || 0);
  const commission = Number(opt.getAttribute("data-commission") || 0);

  document.getElementById("price").value = price;
  document.getElementById("points").value = Math.round(price / 10);
  window._currentCommission = commission;
}

/* ============================
   إضافة خدمة
============================ */
function vm_addService() {
  const opt = document.getElementById("service_detail").selectedOptions[0];
  if (!opt) return;

  const name = opt.value;
  const price = Number(document.getElementById("price").value || 0);
  const points = Number(document.getElementById("points").value || 0);
  const commission = window._currentCommission || 0;

  VM_STATE.selectedServices.push({ name, price, points, commission });
  vm_renderSelectedServices();
}

function vm_renderSelectedServices() {
  const box = document.getElementById("servicesList");
  const totalSpan = document.getElementById("totalPrice");

  if (VM_STATE.selectedServices.length === 0) {
    box.innerHTML = "لم يتم إضافة خدمات بعد.";
    totalSpan.innerText = "0";
    return;
  }

  let total = 0;
  box.innerHTML = VM_STATE.selectedServices
    .map((s, idx) => {
      total += s.price;
      return `
<div style="display:flex;justify-content:space-between;margin-bottom:6px;">
  <span>${s.name} — ${s.price} ريال (${s.points} نقطة)</span>
  <button onclick="vm_removeService(${idx})" style="font-size:12px;">حذف</button>
</div>`;
    })
    .join("");

  totalSpan.innerText = total;
}

function vm_removeService(index) {
  VM_STATE.selectedServices.splice(index, 1);
  vm_renderSelectedServices();
}

/* ============================
   إظهار/إخفاء طريقة الدفع
============================ */
function vm_togglePaymentMethod() {
  const status = document.getElementById("payment_status").value;
  const wrapper = document.getElementById("payment_method_wrapper");
  wrapper.style.display = status === "مدفوع" ? "block" : "none";
}

/* ============================
   البحث عن العضوية باللوحة
============================ */
async function vm_getMembershipByPlate(numbers, letters) {
  const res = await apiGetAll("Cars");
  if (!res.success) return null;

  for (let r of res.rows) {
    const membership = r[0];
    const carLetters = String(r[4] || "").toUpperCase();
    const carNumbers = String(r[5] || "");
    if (carLetters === letters.toUpperCase() && carNumbers === numbers) {
      return membership;
    }
  }
  return null;
}

/* ============================
   تسجيل الزيارة (صف لكل خدمة)
============================ */
async function vm_submitVisit() {
  const btn = document.getElementById("btnSubmitVisit");
  if (btn.disabled) return;

  btn.disabled = true;
  btn.textContent = "جاري تسجيل الزيارة...";

  const plate_numbers = document.getElementById("plate_numbers").value.trim();
  const plate_letters = document.getElementById("plate_letters").value.trim().toUpperCase();
  const car_type = document.getElementById("car_type").value;
  const car_model = document.getElementById("car_model").value;
  const car_size = document.getElementById("car_size").value;
  const parking = document.getElementById("parking_slot").value;
  const employee = document.getElementById("employee_in").value;
  const branch = document.getElementById("branch").value;
  const payment_status = document.getElementById("payment_status").value;
  const payment_method = document.getElementById("payment_method").value || "";
  let discount = Number(document.getElementById("discount").value || 0);

  if (!plate_numbers || !plate_letters) {
    showToast("رقم اللوحة مطلوب", "error");
    btn.disabled = false;
    btn.textContent = "تسجيل الزيارة";
    return;
  }

  if (!employee) {
    showToast("اختر الموظف", "error");
    btn.disabled = false;
    btn.textContent = "تسجيل الزيارة";
    return;
  }

  if (!parking) {
    showToast("رقم الموقف مطلوب", "error");
    btn.disabled = false;
    btn.textContent = "تسجيل الزيارة";
    return;
  }

  if (VM_STATE.selectedServices.length === 0) {
    showToast("أضف خدمة واحدة على الأقل", "error");
    btn.disabled = false;
    btn.textContent = "تسجيل الزيارة";
    return;
  }

  let membership = await vm_getMembershipByPlate(plate_numbers, plate_letters);
  membership = String(membership || "");
  if (!membership) {
    membership = "GUEST-" + Date.now();
  }

  for (let s of VM_STATE.selectedServices) {
    const finalPrice = s.price - discount;
    const finalPoints = s.points;

    const payload = {
      membership,
      plate_numbers,
      plate_letters,
      car_type,
      car_model,
      car_size,
      service_detail: s.name,
      price: finalPrice,
      points: finalPoints,
      employee_in: employee,
      employee_out: "",
      branch,
      commission: s.commission,
      payment_status,
      parking_slot: parking,
      rating: ""
    };

    if (payment_status === "مدفوع") {
      payload.payment_method = payment_method;
    }

    await apiAddVisit(payload);

    if (!membership.startsWith("GUEST")) {
      await apiAddPoints(membership, finalPoints);
    }

    discount = 0;
  }

  showToast("تم تسجيل الزيارة بنجاح", "success");
  VM_STATE.selectedServices = [];
  vm_renderSelectedServices();
  vm_loadActiveVisits();

  btn.disabled = false;
  btn.textContent = "تسجيل الزيارة";
}

/* ============================
   تحميل السيارات داخل المغسلة
============================ */
async function vm_loadActiveVisits() {
  const box = document.getElementById("activeVisitsList");
  box.innerHTML = "جاري التحميل...";

  const res = await apiGetActiveVisits();
  if (!res.success || !res.visits.length) {
    box.innerHTML = "لا توجد سيارات غير مدفوعة حالياً.";
    return;
  }

  box.innerHTML = res.visits
    .map(v => {
      const row = v.row;
      const d = v.data;

      const carName = `${d[VISIT_COL.CAR_TYPE] || ""} ${d[VISIT_COL.CAR_MODEL] || ""}`.trim();
      const plate = `${d[VISIT_COL.PLATE_NUMBERS] || ""} ${d[VISIT_COL.PLATE_LETTERS] || ""}`.trim();

      return `
<div class="car-card">
  <b>🚗 السيارة:</b> ${carName || "غير معروف"}<br>
  <b>رقم اللوحة:</b> ${plate || "غير معروف"}<br>
  <b>الخدمة:</b> ${d[VISIT_COL.SERVICE] || "—"}<br>
  <b>السعر:</b> ${d[VISIT_COL.PRICE] || 0} ريال<br>
  <b>الموقف:</b> ${d[VISIT_COL.PARKING] || "—"}<br>
  <b>الموظف:</b> ${d[VISIT_COL.EMP_IN] || "—"}<br>
  <b>حالة الدفع:</b> ${d[VISIT_COL.PAY_STATUS] || "غير مدفوع"}<br>
  <b>كاش:</b> ${d[VISIT_COL.CASH_AMOUNT] || 0} ريال<br>
  <b>شبكة:</b> ${d[VISIT_COL.CARD_AMOUNT] || 0} ريال<br>
  <b>الإجمالي المدفوع:</b> ${d[VISIT_COL.TOTAL_PAID] || 0} ريال<br>

  <div class="row" style="margin-top:8px;">
    <div style="flex:1;margin-left:4px;">
      <label>كاش</label>
      <input type="number" id="cash_${row}" placeholder="0" style="width:100%;">
    </div>
    <div style="flex:1;margin-right:4px;">
      <label>شبكة</label>
      <input type="number" id="card_${row}" placeholder="0" style="width:100%;">
    </div>
  </div>

  <label style="margin-top:6px;display:block;">طريقة الدفع</label>
  <select id="pay_${row}">
    <option value="">— اختر —</option>
    <option value="كاش">كاش</option>
    <option value="شبكة">شبكة</option>
    <option value="كاش + شبكة">كاش + شبكة</option>
  </select>

  <button class="btn-primary full" style="margin-top:8px;" onclick="vm_markPaid(${row})">
    تحديث حالة الدفع
  </button>
</div>`;
    })
    .join("");
}

/* ============================
   تحديث حالة الدفع (يدعم الدفع الجزئي)
============================ */
async function vm_markPaid(row) {
  const cashVal = Number(document.getElementById(`cash_${row}`).value || 0);
  const cardVal = Number(document.getElementById(`card_${row}`).value || 0);
  const method = document.getElementById(`pay_${row}`).value;

  if (cashVal === 0 && cardVal === 0) {
    showToast("أدخل مبلغ كاش أو شبكة", "error");
    return;
  }

  const res = await apiPost({
    action: "closeVisit",
    row,
    cash_amount: cashVal,
    card_amount: cardVal,
    payment_method: method || "غير محدد"
  });

  if (!res.success) {
    showToast("خطأ في تحديث حالة الدفع", "error");
    return;
  }

  showToast("تم تحديث حالة الدفع", "success");
  vm_loadActiveVisits();
}
