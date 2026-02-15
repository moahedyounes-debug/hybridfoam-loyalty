// visit-manager.js

let VM_STATE = {
  customer: null,
  cars: [],
  selectedMembership: null,
  services: [],
  selectedServices: [],
  branches: []
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnSearch").addEventListener("click", vm_searchCustomer);
  document.getElementById("btnAddService").addEventListener("click", vm_addService);
  document.getElementById("btnSubmitVisit").addEventListener("click", vm_submitVisit);
  document.getElementById("btnRefreshActive").addEventListener("click", vm_loadActiveVisits);

  vm_loadServices();
  vm_loadBranches();
  vm_loadActiveVisits();
});

/* ============================
   تحميل الخدمات
============================ */
async function vm_loadServices(){
  const res = await apiGetServices();
  if(!res.success) return;

  VM_STATE.services = res.services;

  const typeSelect = document.getElementById("service_type");
  const detailSelect = document.getElementById("service_detail");

  const categories = [...new Set(res.services.map(s => s.category))];

  typeSelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join("");
  typeSelect.addEventListener("change", vm_filterServiceDetails);

  vm_filterServiceDetails();
  detailSelect.addEventListener("change", vm_updatePrice);
}

function vm_filterServiceDetails(){
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

function vm_updatePrice(){
  const detailSelect = document.getElementById("service_detail");
  const opt = detailSelect.selectedOptions[0];
  if(!opt) return;

  const price = Number(opt.getAttribute("data-price") || 0);
  document.getElementById("price").value = price;
  vm_updatePoints();
}

function vm_updatePoints(){
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

  // 3) رقم اللوحة
  else {
    const cars = await apiGet({ action: "getAll", sheet: "Cars" });

    if (!cars.success) {
      alert("خطأ في قراءة بيانات السيارات");
      return;
    }

    const foundCar = cars.rows.find(r =>
      String(r[5]) === input ||
      String(r[4]) === input ||
      (r[4] + r[5]) === input
    );

    if (foundCar) {
      customerRes = await apiGetCustomerByMembership(foundCar[0]);
    }
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
    document.getElementById("carsBox").style.display = "none";
    document.getElementById("visitBox").style.display = "none";
    alert("لا توجد سيارات مسجلة لهذا العميل");
    return;
  }

  VM_STATE.cars = carsRes.cars.map(c => c.data);
  vm_renderCars();
}

/* ============================
   عرض السيارات
============================ */
function vm_renderCars(){
  const box = document.getElementById("carsBox");
  const list = document.getElementById("carsList");

  box.style.display = "block";
  list.innerHTML = "";

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
      عضوية: ${membership || "—"}
    `;

    div.addEventListener("click", () => {
      VM_STATE.selectedMembership = membership;
      document.querySelectorAll(".car-item").forEach(el => {
        el.style.background = "transparent";
        el.style.color = "inherit";
        el.style.border = "1px solid #374151";
      });
      div.style.background = "#0D47A1";
      div.style.color = "white";
      div.style.border = "1px solid #0D47A1";
      document.getElementById("visitBox").style.display = "block";
    });

    list.appendChild(div);
  });
}

/* ============================
   إضافة خدمة
============================ */
function vm_addService(){
  const detailSelect = document.getElementById("service_detail");
  const opt = detailSelect.selectedOptions[0];
  if(!opt) return;

  const name = opt.value;
  const price = Number(document.getElementById("price").value || 0);
  const points = Number(document.getElementById("points").value || 0);

  VM_STATE.selectedServices.push({ name, price, points });

  vm_renderSelectedServices();
}

function vm_renderSelectedServices(){
  const box = document.getElementById("servicesList");
  const totalSpan = document.getElementById("totalPrice");

  if(VM_STATE.selectedServices.length === 0){
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

function vm_removeService(index){
  VM_STATE.selectedServices.splice(index, 1);
  vm_renderSelectedServices();
}

/* ============================
   تحميل الفروع
============================ */
async function vm_loadBranches(){
  const res = await apiGetBranches();
  if(!res.success) return;

  const branches = res.rows || [];
  VM_STATE.branches = branches;

  const select = document.getElementById("branch");
  select.innerHTML = '<option value="">— اختر الفرع —</option>' +
    branches.map(b => `<option value="${b[0]}">${b[0]} - ${b[1]}</option>`).join("");
}

/* ============================
   تسجيل الزيارة (مع الخصم + الإشعار + الواتساب + الإغلاق التلقائي)
============================ */
async function vm_submitVisit(){
  if(!VM_STATE.selectedMembership){
    alert("اختر سيارة أولاً");
    return;
  }

  if(VM_STATE.selectedServices.length === 0){
    alert("أضف خدمة واحدة على الأقل");
    return;
  }

  const payment_status = document.getElementById("payment_status").value;
  const payment_method = document.getElementById("payment_method").value;
  const parking_slot = document.getElementById("parking_slot").value;
  const branch = document.getElementById("branch").value;
  const discount = Number(document.getElementById("discount")?.value || 0);

  if(!payment_status || !payment_method || !parking_slot || !branch){
    alert("أكمل بيانات الدفع والفرع والموقف");
    return;
  }

  const totalPrice = VM_STATE.selectedServices.reduce((sum, s) => sum + s.price, 0) - discount;
  const totalPoints = VM_STATE.selectedServices.reduce((sum, s) => sum + s.points, 0);
  const serviceNames = VM_STATE.selectedServices.map(s => s.name).join(" + ");

  const res = await apiAddVisit({
    membership: VM_STATE.selectedMembership,
    service_detail: serviceNames,
    price: totalPrice,
    points: totalPoints,
    employee_in: "",
    employee_out: "",
    branch,
    commission: "",
    payment_status,
    payment_method,
    parking_slot,
    rating: ""
  });

  if(!res.success){
    alert("خطأ في تسجيل الزيارة: " + res.error);
    return;
  }

  // إشعار العميل
  await apiPost({
    action: "addNotification",
    phone: VM_STATE.customer.phone,
    message: `تم تسجيل زيارة جديدة\nالخدمة: ${serviceNames}\nالسعر: ${totalPrice} ريال\nالنقاط: ${totalPoints}`,
    type: "info"
  });

  // إغلاق تلقائي إذا مدفوع
  if (payment_status === "مدفوع") {
    await apiPost({
      action: "closeVisit",
      row: res.row,
      payment_status: "مدفوع",
      payment_method
    });
  }

  // مشاركة الفاتورة عبر الواتساب
  const msg =
    `فاتورة زيارة جديدة\n` +
    `العميل: ${VM_STATE.customer.name}\n` +
    `الجوال: ${VM_STATE.customer.phone}\n` +
    `الخدمات: ${serviceNames}\n` +
    `الإجمالي: ${totalPrice} ريال\n` +
    `النقاط: ${totalPoints}`;

  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);

  alert("تم تسجيل الزيارة بنجاح");
  VM_STATE.selectedServices = [];
  vm_renderSelectedServices();
  vm_loadActiveVisits();
}

/* ============================
   الزيارات غير المدفوعة
============================ */
async function vm_loadActiveVisits(){
  const box = document.getElementById("activeVisitsList");
  box.innerHTML = "جاري التحميل...";

  const res = await apiGetActiveVisits();
  if(!res.success || !res.visits || res.visits.length === 0){
    box.innerHTML = '<div style="font-size:13px;color:#6b7280;">لا توجد سيارات غير مدفوعة حالياً.</div>';
    return;
  }

  box.innerHTML = res.visits.map(v => {
    const row = v.row;
    const d = v.data;
    return `
      <div class="active-item" style="border:1px solid #374151;border-radius:8px;padding:6px 8px;margin-bottom:6px;font-size:13px;">
        عضوية: ${d[0]}<br>
        خدمة: ${d[1]}<br>
        السعر: ${d[2]} ريال<br>
        حالة الدفع: ${d[10]}<br>
        <button style="margin-top:4px;font-size:11px;" onclick="vm_markPaid(${row})">تحديد كمدفوع</button>
      </div>
    `;
  }).join("");
}

/* ============================
   إغلاق الزيارة يدوياً
============================ */
async function vm_markPaid(row){
  const res = await apiPost({
    action: "closeVisit",
    row,
    payment_status: "مدفوع",
    payment_method: "شبكة"
  });

  if(!res.success){
    alert("خطأ في إغلاق الزيارة: " + res.error);
    return;
  }

  alert("تم تحديث حالة الدفع");
  vm_loadActiveVisits();
}
