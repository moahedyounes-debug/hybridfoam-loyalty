/* ============================
   الحالة العامة
============================ */
let VM_STATE = {
  customer: null,
  cars: [],
  selectedMembership: null,
  services: [],
  selectedServices: [],
  employees: []
};

/* ============================
   عند تحميل الصفحة
============================ */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnSearch").addEventListener("click", vm_searchCustomer);
  document.getElementById("btnAddService").addEventListener("click", vm_addService);
  document.getElementById("btnSubmitVisit").addEventListener("click", vm_submitVisit);
  document.getElementById("btnRefreshActive").addEventListener("click", vm_loadActiveVisits);

  document.getElementById("payment_status").addEventListener("change", vm_togglePaymentMethod);

  vm_loadServices();
  vm_loadEmployees();
  vm_loadActiveVisits();

  document.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("input", vm_updateSubmitState);
    el.addEventListener("change", vm_updateSubmitState);
  });
});

/* ============================
   منع الضغط المزدوج
============================ */
function disableButtonTemporarily(btn, text = "جاري التنفيذ...") {
  if (!btn) return () => {};
  btn.disabled = true;
  const original = btn.innerText;
  btn.innerText = text;
  return () => {
    btn.disabled = false;
    btn.innerText = original;
  };
}

/* ============================
   Toast Notifications
============================ */
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

/* ============================
   إظهار/إخفاء طريقة الدفع
============================ */
function vm_togglePaymentMethod() {
  const status = document.getElementById("payment_status").value;
  const wrapper = document.getElementById("payment_method_wrapper");
  const method = document.getElementById("payment_method");

  if (status === "مدفوع") {
    wrapper.style.display = "block";
  } else {
    wrapper.style.display = "none";
    method.value = "";
  }
  vm_updateSubmitState();
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

  vm_updateSubmitState();
}

/* ============================
   فحص اكتمال البيانات
============================ */
function vm_validateVisit() {
  const hasServices = VM_STATE.selectedServices.length > 0;
  const employee = document.getElementById("employee_in").value;
  const payment_status = document.getElementById("payment_status").value;
  const payment_method = document.getElementById("payment_method").value;
  const parking_slot = document.getElementById("parking_slot").value;

  if (!hasServices || !employee || !parking_slot) return false;
  if (!payment_status) return false;
  if (payment_status === "مدفوع" && !payment_method) return false;

  return true;
}

function vm_updateSubmitState() {
  const btn = document.getElementById("btnSubmitVisit");
  btn.disabled = !vm_validateVisit();
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

  detailSelect.innerHTML = filtered.map(s =>
    `<option value="${s.service}" data-price="${s.price}" data-commission="${s.commission}">
      ${s.service}
    </option>`
  ).join("");

  vm_updatePrice();
}

function vm_updatePrice() {
  const detailSelect = document.getElementById("service_detail");
  const opt = detailSelect.selectedOptions[0];
  if (!opt) return;

  const price = Number(opt.getAttribute("data-price") || 0);
  document.getElementById("price").value = price;

  vm_updatePoints();
}

function vm_updatePoints() {
  const price = Number(document.getElementById("price").value || 0);
  const points = Math.round(price / 10);
  document.getElementById("points").value = points;
}

/* ============================
   البحث الذكي
============================ */
async function vm_searchCustomer() {
  const input = document.getElementById("phone").value.trim();
  if (!input) {
    showToast("ادخل رقم الجوال أو العضوية أو رقم اللوحة", "error");
    return;
  }

  let customerRes = null;

  // 1) رقم الجوال
  if (/^05\d{8}$/.test(input)) {
    customerRes = await apiGetCustomerByPhone(input);
  }
  // 2) رقم العضوية
  else if (/^\d+$/.test(input)) {
    customerRes = await apiGetCustomerByMembership(input);
  }
  // 3) رقم اللوحة
  else {
    const cars = await apiGetAll("Cars");
    if (!cars.success) {
      showToast("خطأ في قراءة بيانات السيارات", "error");
      return;
    }

    const matches = cars.rows.filter(r =>
      String(r[5]).includes(input) ||
      String(r[4]).includes(input) ||
      (String(r[4]) + String(r[5])).includes(input)
    );

    if (matches.length === 0) {
      showToast("لا توجد سيارات بهذا الرقم", "error");
      return;
    }

    VM_STATE.cars = matches;

    if (matches.length === 1) {
      customerRes = await apiGetCustomerByMembership(matches[0][0]);
    }
  }

  // إذا وجد عميل
  if (customerRes && customerRes.success) {
    const c = customerRes.customer;

    VM_STATE.customer = {
      name: c[0],
      phone: c[1],
      membership: c[8]
    };

    const infoBox = document.getElementById("customerInfo");
    infoBox.style.display = "block";
    infoBox.innerHTML = `
      الاسم: ${c[0]}<br>
      العضوية: ${c[8]}<br>
      الجوال: ${c[1]}
    `;

    if (!VM_STATE.cars.length) {
      const carsRes = await apiGetCarsByPhone(c[1]);
      if (carsRes.success) {
        VM_STATE.cars = carsRes.cars.map(c => c.data);
      }
    }
  } else {
    VM_STATE.customer = null;
    document.getElementById("customerInfo").style.display = "block";
    document.getElementById("customerInfo").innerHTML =
      "عميل غير مسجل — سيتم إنشاء عضوية ضيف تلقائياً.";
  }

  vm_renderCars();
}

/* ============================
   عرض السيارات
============================ */
function vm_renderCars() {
  const box = document.getElementById("carsBox");
  const list = document.getElementById("carsList");

  list.innerHTML = "";
  box.style.display = "block";

  if (VM_STATE.cars.length === 1) {
    VM_STATE.selectedMembership = VM_STATE.cars[0][0] || null;
    document.getElementById("visitBox").style.display = "block";
    vm_updateSubmitState();
    return;
  }

  VM_STATE.cars.forEach((c, idx) => {
    const div = document.createElement("div");
    div.className = "car-item";
    div.innerHTML = `
      <strong>${c[2]}</strong> (${c[3]})<br>
      لوحة: ${c[5]} ${c[4]}<br>
      عضوية: ${c[0] || "ضيف"}
    `;

    div.addEventListener("click", () => {
      VM_STATE.selectedMembership = c[0] || null;

      document.querySelectorAll(".car-item").forEach(el => el.classList.remove("selected"));
      div.classList.add("selected");

      document.getElementById("visitBox").style.display = "block";
      vm_updateSubmitState();
    });

    list.appendChild(div);
  });
}

/* ============================
   إضافة خدمة
============================ */
function vm_addService() {
  const detailSelect = document.getElementById("service_detail");
  const opt = detailSelect.selectedOptions[0];
  if (!opt) return;

  const name = opt.value;
  const price = Number(document.getElementById("price").value || 0);
  const points = Number(document.getElementById("points").value || 0);

  VM_STATE.selectedServices.push({ name, price, points });

  vm_renderSelectedServices();
  vm_updateSubmitState();
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

  box.innerHTML = VM_STATE.selectedServices.map((s, idx) => {
    total += s.price;
    return `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span>${s.name} — ${s.price} ريال (${s.points} نقطة)</span>
        <button onclick="vm_removeService(${idx})" style="font-size:12px;">حذف</button>
      </div>
    `;
  }).join("");

  totalSpan.innerText = total;
}

function vm_removeService(index) {
  VM_STATE.selectedServices.splice(index, 1);
  vm_renderSelectedServices();
  vm_updateSubmitState();
}

/* ============================
   تسجيل الزيارة
============================ */
async function vm_submitVisit() {
  const btn = document.getElementById("btnSubmitVisit");
  const enable = disableButtonTemporarily(btn, "جاري تسجيل الزيارة...");

  try {
    if (!vm_validateVisit()) {
      showToast("أكمل جميع البيانات", "error");
      enable();
      return;
    }

    let membership = VM_STATE.selectedMembership;
    if (!membership) membership = "GUEST-" + Date.now();

    const employee_in = document.getElementById("employee_in").value;
    const payment_status = document.getElementById("payment_status").value;
    const payment_method = document.getElementById("payment_method").value || "";
    const parking_slot = document.getElementById("parking_slot").value;
    const branch = document.getElementById("branch").value;
    const discount = Number(document.getElementById("discount").value || 0);

    const totalPrice =
      VM_STATE.selectedServices.reduce((sum, s) => sum + s.price, 0) - discount;

    const totalPoints =
      VM_STATE.selectedServices.reduce((sum, s) => sum + s.points, 0);

    const serviceNames = VM_STATE.selectedServices.map(s => s.name).join(" + ");

    const res = await apiAddVisit({
      membership,
      service_detail: serviceNames,
      price: totalPrice,
      points: totalPoints,
      employee_in,
      employee_out: "",
      branch,
      commission: "",
      payment_status,
      payment_method,
      parking_slot,
      rating: ""
    });

    if (!res.success) {
      showToast("خطأ في تسجيل الزيارة", "error");
      enable();
      return;
    }

    showToast("تم تسجيل الزيارة بنجاح", "success");

    VM_STATE.selectedServices = [];
    vm_renderSelectedServices();
    vm_loadActiveVisits();
    vm_updateSubmitState();

    enable();

  } catch (e) {
    showToast("حدث خطأ غير متوقع", "error");
    enable();
  }
}

/* ============================
   تحميل السيارات داخل المغسلة
============================ */
async function vm_loadActiveVisits() {
  const box = document.getElementById("activeVisitsList");
  box.innerHTML = "جاري التحميل...";

  const res = await apiGetActiveVisits();
  if (!res.success || !res.visits || res.visits.length === 0) {
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

  box.innerHTML = res.visits.map(v => {
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
      </div>
    `;
  }).join("");
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
