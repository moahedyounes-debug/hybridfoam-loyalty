let VM_STATE = {
  customer: null,
  cars: [],
  selectedMembership: null,
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

  document.getElementById("payment_status").addEventListener("change", vm_togglePaymentMethod);

  vm_loadServices();
  vm_loadBranches();
  vm_loadEmployees();
  vm_loadActiveVisits();

  document.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("input", vm_updateSubmitState);
    el.addEventListener("change", vm_updateSubmitState);
  });
});

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
  const branch = document.getElementById("branch").value;

  if (!hasServices || !employee || !parking_slot || !branch) return false;

  if (!payment_status) return false;

  if (payment_status === "مدفوع" && !payment_method) return false;

  // نسمح بالضيف، لذلك لا نشترط selectedMembership
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
   البحث الذكي (جوال – عضوية – لوحة)
============================ */
async function vm_searchCustomer() {
  const input = document.getElementById("phone").value.trim();
  if (!input) {
    alert("ادخل رقم الجوال أو العضوية أو رقم اللوحة");
    return;
  }

  let customerRes = null;

  // 1) رقم الجوال
  if (input.startsWith("05") && input.length === 10) {
    customerRes = await apiGetCustomerByPhone(input);
  }
  // 2) رقم العضوية
  else if (/^\d+$/.test(input) && input.length >= 6 && input.length <= 10) {
    customerRes = await apiGetCustomerByMembership(input);
  }
  // 3) رقم اللوحة (يدعم أكثر من سيارة)
  else {
    const cars = await apiGetAll("Cars");
    if (!cars.success) {
      alert("خطأ في قراءة بيانات السيارات");
      return;
    }

    const matches = cars.rows.filter(r =>
      String(r[5]).includes(input) ||
      String(r[4]).includes(input) ||
      (String(r[4]) + String(r[5])).includes(input)
    );

    if (matches.length === 0) {
      alert("لا توجد سيارات بهذا الرقم");
      return;
    }

    // إذا سيارة واحدة فقط
    if (matches.length === 1) {
      customerRes = await apiGetCustomerByMembership(matches[0][0]);
      VM_STATE.cars = [matches[0]];
    } else {
      // أكثر من سيارة → نخلي الاختيار في واجهة السيارات
      VM_STATE.cars = matches;
    }
  }

  // إذا وجدنا عميل
  if (customerRes && customerRes.success) {
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

    // جلب سياراته إذا لم تكن من بحث اللوحة
    if (!VM_STATE.cars.length || (VM_STATE.cars.length === 1 && VM_STATE.cars[0][0] !== c[8])) {
      const carsRes = await apiGetCarsByPhone(VM_STATE.customer.phone);
      if (!carsRes.success || carsRes.cars.length === 0) {
        alert("لا توجد سيارات مسجلة لهذا العميل");
        document.getElementById("carsBox").style.display = "none";
        document.getElementById("visitBox").style.display = "none";
        return;
      }
      VM_STATE.cars = carsRes.cars.map(c => c.data);
    } else {
      // VM_STATE.cars من بحث اللوحة (rows)
      VM_STATE.cars = VM_STATE.cars.map(r => r);
    }
  } else {
    // عميل غير مسجل → نعرض فقط أن العميل ضيف
    VM_STATE.customer = null;
    const infoBox = document.getElementById("customerInfo");
    infoBox.style.display = "block";
    infoBox.innerHTML = `عميل غير مسجل — سيتم إنشاء عضوية ضيف تلقائياً عند تسجيل الزيارة.`;
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

  // إذا سيارة واحدة فقط → نختارها تلقائياً
  if (VM_STATE.cars.length === 1) {
    const c = VM_STATE.cars[0];
    const membership = c[0];
    VM_STATE.selectedMembership = membership || null;
    document.getElementById("visitBox").style.display = "block";
    vm_updateSubmitState();
    return;
  }

  VM_STATE.cars.forEach((c, idx) => {
    const membership = c[0];
    const car = c[2];
    const size = c[3];
    const plateLetters = c[4];
    const plateNumbers = c[5];

    const div = document.createElement("div");
    div.className = "car-item";
    div.style.cursor = "pointer";
    div.style.padding = "6px 8px";
    div.style.borderRadius = "8px";
    div.style.border = "1px solid #374151";
    div.style.marginBottom = "6px";

    div.innerHTML = `
      <strong>${car}</strong> (${size})<br>
      لوحة: ${plateNumbers} ${plateLetters}<br>
      عضوية: ${membership || "ضيف"}
    `;

    div.addEventListener("click", () => {
      VM_STATE.selectedMembership = membership || null;

      document.querySelectorAll(".car-item").forEach(el => {
        el.style.background = "transparent";
        el.style.color = "inherit";
        el.style.border = "1px solid #374151";
      });

      div.style.background = "#0D47A1";
      div.style.color = "white";
      div.style.border = "1px solid #0D47A1";

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
  vm_updateSubmitState();
}

/* ============================
   تحميل الفروع (ثابت حالياً)
============================ */
async function vm_loadBranches() {
  // حالياً الفرع ثابت من الـ HTML (Makkah - مكة)
  VM_STATE.branches = [["Makkah - مكة", "Makkah"]];
}

/* ============================
   تسجيل الزيارة
============================ */
async function vm_submitVisit() {
  if (!vm_validateVisit()) {
    alert("أكمل جميع البيانات قبل تسجيل الزيارة");
    return;
  }

  let membership = VM_STATE.selectedMembership;

  // إذا العميل غير مسجل أو ما عنده عضوية → عضوية ضيف تلقائية
  if (!membership) {
    membership = "GUEST-" + Date.now();
  }

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
    alert("خطأ في تسجيل الزيارة: " + (res.error || ""));
    return;
  }

  alert("تم تسجيل الزيارة بنجاح");

  VM_STATE.selectedServices = [];
  vm_renderSelectedServices();
  vm_loadActiveVisits();
  vm_updateSubmitState();
}

/* ============================
   الزيارات غير المدفوعة
============================ */
async function vm_loadActiveVisits() {
  const box = document.getElementById("activeVisitsList");
  box.innerHTML = "جاري التحميل...";

  const res = await apiGetActiveVisits();
  if (!res.success || !res.visits || res.visits.length === 0) {
    box.innerHTML = '<div style="font-size:13px;color:#6b7280;">لا توجد سيارات غير مدفوعة حالياً.</div>';
    return;
  }

  const carsRes = await apiGetAll("Cars");
  let carMap = {};

  if (carsRes.success) {
    carsRes.rows.forEach(r => {
      const mem = r[0];
      carMap[mem] = {
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
      <div style="border:1px solid #374151;border-radius:8px;padding:6px 8px;margin-bottom:6px;font-size:13px;">
        <b>🚗 اللوحة:</b> ${plate} — ${carName}<br>
        <b>العضوية:</b> ${mem || "ضيف"}<br>
        <b>الخدمة:</b> ${d[1]}<br>
        <b>السعر:</b> ${d[2]} ريال<br>

        <label style="font-size:12px;">طريقة الدفع</label>
        <select id="pay_${row}" style="margin-top:2px;width:100%;">
          <option value="">— اختر طريقة الدفع —</option>
          <option value="كاش">كاش</option>
          <option value="شبكة">شبكة</option>
        </select>

        <button class="btn-primary" style="margin-top:4px;font-size:11px;padding:4px 8px;width:100%;" onclick="vm_markPaid(${row})">
          تحديث حالة الدفع
        </button>
      </div>
    `;
  }).join("");
}

/* ============================
   إغلاق الزيارة يدوياً
============================ */
async function vm_markPaid(row) {
  const method = document.getElementById(`pay_${row}`).value;

  if (!method) {
    alert("اختر طريقة الدفع أولاً");
    return;
  }

  const res = await apiPost({
    action: "closeVisit",
    row,
    payment_status: "مدفوع",
    payment_method: method
  });

  if (!res.success) {
    alert("خطأ في إغلاق الزيارة: " + (res.error || ""));
    return;
  }

  alert("تم تحديث حالة الدفع");
  vm_loadActiveVisits();
}
