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

  vm_loadServices();
  vm_loadBranches();
  vm_loadEmployees();
  vm_loadActiveVisits();

  document.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("change", vm_updateSubmitState);
  });
});

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
   فحص اكتمال البيانات
============================ */
function vm_validateVisit() {
  return (
    VM_STATE.selectedMembership &&
    VM_STATE.selectedServices.length > 0 &&
    document.getElementById("employee_in").value &&
    document.getElementById("payment_status").value &&
    document.getElementById("payment_method").value &&
    document.getElementById("parking_slot").value &&
    document.getElementById("branch").value
  );
}

function vm_updateSubmitState() {
  document.getElementById("btnSubmitVisit").disabled = !vm_validateVisit();
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

  const filtered = VM_STATE.services.filter(s => s.category === type);

  detailSelect.innerHTML = filtered.map(s =>
    `<option value="${s.service}" data-price="${s.price}" data-commission="${s.commission}">
      ${s.service}
    </option>`
  ).join("");

  vm_updatePrice();
}

function vm_updatePrice() {
  const opt = document.getElementById("service_detail").selectedOptions[0];
  if (!opt) return;

  const price = Number(opt.getAttribute("data-price") || 0);
  document.getElementById("price").value = price;

  vm_updatePoints();
}

function vm_updatePoints() {
  const price = Number(document.getElementById("price").value || 0);
  document.getElementById("points").value = Math.round(price / 10);
}

/* ============================
   البحث عن العميل
============================ */
async function vm_searchCustomer() {
  const input = document.getElementById("phone").value.trim();
  if (!input) return alert("ادخل رقم الجوال أو العضوية أو رقم اللوحة");

  let customerRes = null;

  if (input.startsWith("05") && input.length === 10) {
    customerRes = await apiGetCustomerByPhone(input);
  } else if (/^\d+$/.test(input)) {
    customerRes = await apiGetCustomerByMembership(input);
  } else {
    const cars = await apiGetAll("Cars");
    const found = cars.rows.find(r => r[5] === input || r[4] === input);
    if (found) customerRes = await apiGetCustomerByMembership(found[0]);
  }

  if (!customerRes || !customerRes.success) return alert("لم يتم العثور على العميل");

  const c = customerRes.customer;

  VM_STATE.customer = {
    name: c[0],
    phone: c[1],
    membership: c[8],
    city: c[4]
  };

  document.getElementById("customerInfo").style.display = "block";
  document.getElementById("customerInfo").innerHTML =
    `الاسم: ${c[0]}<br> العضوية: ${c[8]}<br> المدينة: ${c[4]}`;

  const carsRes = await apiGetCarsByPhone(c[1]);
  if (!carsRes.success || carsRes.cars.length === 0)
    return alert("لا توجد سيارات مسجلة لهذا العميل");

  VM_STATE.cars = carsRes.cars.map(c => c.data);

  vm_renderCars();
}

/* ============================
   عرض السيارات
============================ */
function vm_renderCars() {
  const list = document.getElementById("carsList");
  list.innerHTML = "";

  document.getElementById("carsBox").style.display = "block";

  VM_STATE.cars.forEach((c, idx) => {
    const div = document.createElement("div");
    div.className = "car-item";
    div.style.padding = "6px 8px";
    div.style.border = "1px solid #374151";
    div.style.borderRadius = "8px";
    div.style.marginBottom = "6px";
    div.style.cursor = "pointer";

    div.innerHTML = `
      <strong>${c[2]}</strong> (${c[3]})<br>
      لوحة: ${c[5]} ${c[4]}<br>
      عضوية: ${c[0]}
    `;

    div.addEventListener("click", () => {
      VM_STATE.selectedMembership = c[0];

      document.querySelectorAll(".car-item").forEach(el => {
        el.style.background = "transparent";
        el.style.color = "inherit";
      });

      div.style.background = "#0D47A1";
      div.style.color = "white";

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
  const opt = document.getElementById("service_detail").selectedOptions[0];
  if (!opt) return;

  const name = opt.value;
  const price = Number(document.getElementById("price").value);
  const points = Number(document.getElementById("points").value);

  VM_STATE.selectedServices.push({ name, price, points });

  vm_renderSelectedServices();
  vm_updateSubmitState();
}

function vm_renderSelectedServices() {
  const box = document.getElementById("servicesList");
  const totalSpan = document.getElementById("totalPrice");

  if (VM_STATE.selectedServices.length === 0) {
    box.innerHTML = '<div style="color:#777;">لم يتم إضافة خدمات بعد.</div>';
    totalSpan.innerText = "0";
    return;
  }

  let total = 0;

  box.innerHTML = VM_STATE.selectedServices.map((s, idx) => {
    total += s.price;
    return `
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span>${s.name} - ${s.price} ريال (${s.points} نقطة)</span>
        <button onclick="vm_removeService(${idx})">حذف</button>
      </div>
    `;
  }).join("");

  totalSpan.innerText = total;
}

function vm_removeService(i) {
  VM_STATE.selectedServices.splice(i, 1);
  vm_renderSelectedServices();
  vm_updateSubmitState();
}

/* ============================
   تحميل الفروع
============================ */
async function vm_loadBranches() {
  const res = await apiGetBranches();
  if (!res.success) return;

  const select = document.getElementById("branch");
  select.innerHTML =
    '<option value="">— اختر الفرع —</option>' +
    res.rows.map(b => `<option value="${b[0]}">${b[0]} - ${b[1]}</option>`).join("");
}

/* ============================
   تسجيل الزيارة
============================ */
async function vm_submitVisit() {
  if (!vm_validateVisit()) return alert("أكمل جميع البيانات");

  const employee_in = document.getElementById("employee_in").value;
  const payment_status = document.getElementById("payment_status").value;
  const payment_method = document.getElementById("payment_method").value;
  const parking_slot = document.getElementById("parking_slot").value;
  const branch = document.getElementById("branch").value;
  const discount = Number(document.getElementById("discount").value || 0);

  const totalPrice =
    VM_STATE.selectedServices.reduce((s, x) => s + x.price, 0) - discount;

  const totalPoints =
    VM_STATE.selectedServices.reduce((s, x) => s + x.points, 0);

  const serviceNames = VM_STATE.selectedServices.map(s => s.name).join(" + ");

  const res = await apiAddVisit({
    membership: VM_STATE.selectedMembership,
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

  if (!res.success) return alert("خطأ في تسجيل الزيارة");

  alert("تم تسجيل الزيارة بنجاح");

  VM_STATE.selectedServices = [];
  vm_renderSelectedServices();
  vm_loadActiveVisits();
}

/* ============================
   الزيارات غير المدفوعة
============================ */
async function vm_loadActiveVisits() {
  const box = document.getElementById("activeVisitsList");
  box.innerHTML = "جاري التحميل...";

  const res = await apiGetActiveVisits();
  if (!res.success || !res.visits.length) {
    box.innerHTML = "لا توجد سيارات غير مدفوعة حالياً.";
    return;
  }

  // تحميل بيانات السيارات للحصول على اللوحة + نوع السيارة
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
      <div class="active-item" style="border:1px solid #374151;padding:8px;border-radius:8px;margin-bottom:8px;font-size:14px;">
        
        <b>🚗 اللوحة:</b> ${plate} — ${carName}<br>
        <b>العضوية:</b> ${mem}<br>
        <b>الخدمة:</b> ${d[1]}<br>
        <b>السعر:</b> ${d[2]} ريال<br>

        <label style="font-size:12px;margin-top:6px;">طريقة الدفع</label>
        <select id="pay_${row}" style="width:100%;margin-top:4px;">
          <option value="">— اختر طريقة الدفع —</option>
          <option value="كاش">كاش</option>
          <option value="شبكة">شبكة</option>
        </select>

        <button 
          onclick="vm_markPaid(${row})" 
          style="margin-top:8px;width:100%;padding:6px;font-size:13px;"
          class="btn-primary">
          تحديث حالة الدفع
        </button>

      </div>
    `;
  }).join("");
}

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
    alert("خطأ في تحديث حالة الدفع");
    return;
  }

  alert("تم تحديث حالة الدفع بنجاح");
  vm_loadActiveVisits();
}
