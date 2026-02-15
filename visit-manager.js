// visit-manager.js

let VM_STATE = {
  customer: null,
  cars: [],
  selectedMembership: null,
  selectedPlate: null,
  services: [],
  selectedServices: [],
  branches: [],
  employees: []
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnSearch").addEventListener("click", vm_searchCustomer);
  document.getElementById("btnAddService").addEventListener("click", vm_addService);
  document.getElementById("btnSubmitVisit").addEventListener("click", vm_submitVisit);
  document.getElementById("btnRefreshActive").addEventListener("click", vm_loadActiveVisits);

  vm_loadServices();
  vm_loadBranches();
  vm_loadEmployees();
  vm_loadActiveVisits();
});

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
   تحميل الفروع
============================ */

async function vm_loadBranches() {
  const res = await apiGetBranches();
  if (!res.success) return;

  const branches = res.rows || [];
  VM_STATE.branches = branches;

  const select = document.getElementById("branch");

  if (branches.length === 1) {
    const b = branches[0];
    select.innerHTML = `<option value="${b[0]}">${b[0]} - ${b[1]}</option>`;
    return;
  }

  select.innerHTML =
    '<option value="">— اختر الفرع —</option>' +
    branches.map(b => `<option value="${b[0]}">${b[0]} - ${b[1]}</option>`).join("");
}

/* ============================
   تحميل الموظفين
============================ */
async function vm_loadEmployees() {
  const res = await apiGetEmployees();
  if (!res.success) return;

  const employees = res.rows || [];
  const select = document.getElementById("employee_in");

  select.innerHTML = '<option value="">— اختر الموظف —</option>' +
    employees.map(e => `<option value="${e[0]}">${e[0]}</option>`).join("");
}

/* ============================
   البحث الذكي
============================ */

async function vm_searchCustomer() {
  const input = document.getElementById("phone").value.trim();

  if (!input) {
    alert("ادخل رقم الجوال أو العضوية أو رقم اللوحة");
    return;
  }

  let customerRes = null;

  // 1) رقم الجوال
  if (/^05\d{8}$/.test(input)) {
    customerRes = await apiGetCustomerByPhone(input);
  }
  // 2) رقم عضوية
  else if (/^\d+$/.test(input) && input.length >= 6) {
    customerRes = await apiGetCustomerByMembership(input);
  }
  // 3) لوحة
  else {
    customerRes = await vm_searchByPlate(input);
  }

  if (!customerRes || !customerRes.success) {
    alert("لم يتم العثور على العميل");
    return;
  }

  const c = customerRes.customer;

  VM_STATE.customer = {
    name: c[0],
    phone: c[1],
    membership: c[8],
    city: c[4]
  };

  const infoBox = document.getElementById("customerInfo");
  infoBox.style.display = "block";
  infoBox.innerHTML = `
    الاسم: ${VM_STATE.customer.name}<br>
    العضوية: ${VM_STATE.customer.membership}<br>
    المدينة: ${VM_STATE.customer.city}
  `;

  const carsRes = await apiGetCarsByPhone(VM_STATE.customer.phone);

  if (!carsRes.success || carsRes.cars.length === 0) {
    alert("لا توجد سيارات مسجلة لهذا العميل");
    return;
  }

  VM_STATE.cars = carsRes.cars.map(c => c.data);
  vm_renderCars();
}

async function vm_searchByPlate(plateInput) {
  const plate = plateInput.trim().toLowerCase();
  const cars = await apiGet({ action: "getAll", sheet: "Cars" });

  if (!cars.success) return null;

  const foundCar = cars.rows.find(r => {
    const letters = String(r[4] || "").toLowerCase();
    const numbers = String(r[5] || "").toLowerCase();
    const full1 = (letters + numbers).toLowerCase();
    const full2 = (numbers + letters).toLowerCase();

    return (
      letters === plate ||
      numbers === plate ||
      full1 === plate ||
      full2 === plate
    );
  });

  if (!foundCar) return null;

  const membership = foundCar[0];
  if (!membership) return null;

  return await apiGetCustomerByMembership(membership);
}

/* ============================
   عرض السيارات بشكل بسيط
============================ */

function vm_renderCars() {
  const box = document.getElementById("carsBox");
  const list = document.getElementById("carsList");

  box.style.display = "block";
  list.innerHTML = "";

  VM_STATE.cars.forEach((c) => {
    const membership = c[0];
    const car = c[2];
    const plateLetters = c[4];
    const plateNumbers = c[5];

    const div = document.createElement("div");
    div.className = "car-item-simple";

    div.innerHTML = `
      لوحة: ${plateNumbers} ${plateLetters} — ${car}
    `;

    div.addEventListener("click", () => {
      VM_STATE.selectedMembership = membership;

      document.querySelectorAll(".car-item-simple").forEach(el => {
        el.style.background = "transparent";
        el.style.color = "inherit";
      });

      div.style.background = "#0D47A1";
      div.style.color = "white";

      document.getElementById("visitBox").style.display = "block";
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
}

function vm_renderSelectedServices() {
  const box = document.getElementById("servicesList");
  const totalSpan = document.getElementById("totalPrice");

  if (VM_STATE.selectedServices.length === 0) {
    box.innerHTML = '<div style="font-size:13px;color:#6b7280;">لم يتم إضافة خدمات بعد.</div>';
    totalSpan.innerText = "0";
    return;
  }

  let total = 0;

  box.innerHTML = VM_STATE.selectedServices.map((s, idx) => {
    total += s.price;
    return `
      <div style="font-size:13px;margin-bottom:4px;display:flex;justify-content:space-between;">
        <span>${s.name} – ${s.price} ريال (${s.points} نقطة)</span>
        <button style="font-size:11px;" onclick="vm_removeService(${idx})">حذف</button>
      </div>
    `;
  }).join("");

  totalSpan.innerText = total;
}

function vm_removeService(index) {
  VM_STATE.selectedServices.splice(index, 1);
  vm_renderSelectedServices();
}

/* ============================
   تسجيل الزيارة
============================ */

async function vm_submitVisit() {
  if (!VM_STATE.selectedMembership) {
    alert("اختر سيارة أولاً");
    return;
  }

  if (VM_STATE.selectedServices.length === 0) {
    alert("أضف خدمة واحدة على الأقل");
    return;
  }

  const payment_status = document.getElementById("payment_status").value;
  const payment_method = document.getElementById("payment_method").value;
  const parking_slot = document.getElementById("parking_slot").value;
  const branch = document.getElementById("branch").value;
  const employee = document.getElementById("employee").value;
  const discount = Number(document.getElementById("discount")?.value || 0);

  if (!payment_status || !parking_slot || !branch || !employee) {
    alert("أكمل البيانات المطلوبة");
    return;
  }

  if (payment_status === "مدفوع" && !payment_method) {
    alert("اختر طريقة الدفع");
    return;
  }

  const totalPrice =
    VM_STATE.selectedServices.reduce((sum, s) => sum + s.price, 0) - discount;

  const totalPoints =
    VM_STATE.selectedServices.reduce((sum, s) => sum + s.points, 0);

  const serviceNames = VM_STATE.selectedServices.map(s => s.name).join(" + ");

  const res = await apiAddVisit({
    membership: VM_STATE.selectedMembership,
    service_detail: serviceNames,
    price: totalPrice,
    points: totalPoints,
    employee_in: employee,
    employee_out: "",
    branch,
    commission: "",
    payment_status,
    payment_method,
    parking_slot,
    rating: ""
  });

  if (!res.success) {
    alert("خطأ في تسجيل الزيارة: " + res.error);
    return;
  }

  alert("تم تسجيل الزيارة بنجاح");

  VM_STATE.selectedServices = [];
  vm_renderSelectedServices();
  vm_loadActiveVisits();
}

/* ============================
   السيارات غير المدفوعة
============================ */

async function vm_loadActiveVisits() {
  const box = document.getElementById("activeVisitsList");
  box.innerHTML = "جاري التحميل...";

  const res = await apiGetActiveVisits();
  if (!res.success || !res.visits || res.visits.length === 0) {
    box.innerHTML = '<div style="font-size:13px;color:#6b7280;">لا توجد سيارات غير مدفوعة حالياً.</div>';
    return;
  }

  const carsRes = await apiGet({ action: "getAll", sheet: "Cars" });
  let carMap = {};
  if (carsRes.success && carsRes.rows) {
    carsRes.rows.forEach(r => {
      const membership = r[0];
      const letters = r[4];
      const numbers = r[5];
      if (membership) {
        carMap[membership] = { letters, numbers };
      }
    });
  }

  box.innerHTML = res.visits.map(v => {
    const row = v.row;
    const d = v.data;
    const membership = d[0];

    let plateText = "غير معروف";
    if (membership && carMap[membership]) {
      plateText = `${carMap[membership].numbers} ${carMap[membership].letters}`;
    }

    return `
      <div class="active-item" style="border:1px solid #374151;border-radius:8px;padding:6px 8px;margin-bottom:6px;font-size:13px;">
        <b>🚗 اللوحة: ${plateText}</b><br>
        العضوية: ${membership || "—"}<br>
        خدمة: ${d[1]}<br>
        السعر: ${d[2]} ريال<br>

        <label>طريقة الدفع</label>
        <select id="pay_${row}">
          <option value="كاش">كاش</option>
          <option value="شبكة">شبكة</option>
        </select>

        <button style="margin-top:4px;font-size:11px;" onclick="vm_markPaid(${row})">
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
    alert("خطأ في تحديث حالة الدفع: " + res.error);
    return;
  }

  alert("تم تحديث حالة الدفع");
  vm_loadActiveVisits();
}
