/* ============================
الحالة العامة
============================ */
let VM_STATE = {
  services: [],
  employees: [],
  selectedServices: []
};

/* ============================
عند تحميل الصفحة
============================ */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnSubmitVisit").addEventListener("click", vm_submitVisit);
  document.getElementById("btnAddService").addEventListener("click", vm_addService);
  document.getElementById("btnRefreshActive").addEventListener("click", vm_loadActiveVisits);
  document.getElementById("payment_status").addEventListener("change", vm_togglePaymentMethod);

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
تحميل الخدمات
============================ */
async function vm_loadServices() {
  const res = await apiGetServices();
  if (!res.success) return;

  VM_STATE.services = res.services;

  const typeSelect = document.getElementById("service_type");
  const detailSelect = document.getElementById("service_detail");

  const categories = [...new Set(res.services.map(s => s.category))];

  typeSelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join("");

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
  const detailSelect = document.getElementById("service_detail");
  const opt = detailSelect.selectedOptions[0];
  if (!opt) return;

  const name = opt.value;
  const price = Number(document.getElementById("price").value);
  const points = Number(document.getElementById("points").value);
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
  const plate_numbers = document.getElementById("plate_numbers").value.trim();
  const plate_letters = document.getElementById("plate_letters").value.trim().toUpperCase();

  const car_type = document.getElementById("car_type").value;
  const car_size = document.getElementById("car_size").value;

  const parking = document.getElementById("parking_slot").value;
  const employee = document.getElementById("employee_in").value;
  const branch = document.getElementById("branch").value;

  const payment_status = document.getElementById("payment_status").value;
  const payment_method = document.getElementById("payment_method").value || "";

  let discount = Number(document.getElementById("discount").value || 0);

  if (!plate_numbers || !plate_letters || !employee || !parking) {
    showToast("أكمل جميع البيانات", "error");
    return;
  }

  if (VM_STATE.selectedServices.length === 0) {
    showToast("أضف خدمة واحدة على الأقل", "error");
    return;
  }

  // 🔥 ربط اللوحة بالعضوية تلقائيًا
  let membership = await vm_getMembershipByPlate(plate_numbers, plate_letters);
  if (!membership) membership = "GUEST-" + Date.now();

  // 🔥 تسجيل كل خدمة في صف مستقل
  for (let s of VM_STATE.selectedServices) {
    const finalPrice = s.price - discount;
    const finalPoints = s.points;

    const payload = {
      membership,
      plate_numbers,
      plate_letters,
      car_type,
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

  const carsRes = await apiGetAll("Cars");
  let carMap = {};

  if (carsRes.success) {
    carsRes.rows.forEach(r => {
      carMap[r[0]] = {
        car: r[2],
        letters: r[4],
        numbers: r[5]
      };
    });
  }

  box.innerHTML = res.visits
    .map(v => {
      const row = v.row;
      const d = v.data;
      const mem = d[0];

      let plate = "غير معروف";
      let carName = "";

      if (carMap[mem]) {
        plate = `${carMap[mem].numbers} ${carMap[mem].letters}`;
        carName = carMap[mem].car;
      }

      return `
<div class="car-card">
<b>🚗 السيارة:</b> ${carName}<br>
<b>رقم اللوحة:</b> ${plate}<br>
<b>الخدمة:</b> ${d[1]}<br>
<b>السعر:</b> ${d[2]} ريال<br>
<b>الموقف:</b> ${d[12] || "—"}<br>
<b>الموظف:</b> ${d[9] || "—"}<br>
<b>حالة الدفع:</b> ${d[10]}<br>

<label>طريقة الدفع</label>
<select id="pay_${row}">
<option value="كاش">كاش</option>
<option value="شبكة">شبكة</option>
</select>

<button class="btn-primary full" style="margin-top:8px;" onclick="vm_markPaid(${row})">
تحديث حالة الدفع
</button>
</div>`;
    })
    .join("");
}

/* ============================
تحديث حالة الدفع
============================ */
async function vm_markPaid(row) {
  const method = document.getElementById(`pay_${row}`).value;

  const res = await apiPost({
    action: "closeVisit",
    row,
    payment_status: "مدفوع",
    payment_method: method
  });

  if (!res.success) {
    showToast("خطأ في تحديث حالة الدفع", "error");
    return;
  }

  showToast("تم تحديث حالة الدفع", "success");
  vm_loadActiveVisits();
}
