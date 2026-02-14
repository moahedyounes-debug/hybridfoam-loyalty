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

// تحميل الخدمات من Commissions
async function vm_loadServices(){
  const res = await apiGetServices();
  if(!res.success) return;

  VM_STATE.services = res.services;

  const typeSelect = document.getElementById("service_type");
  const detailSelect = document.getElementById("service_detail");

  const categories = [...new Set(res.services.map(s => s[4]))]; // Category

  typeSelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join("");
  typeSelect.addEventListener("change", vm_filterServiceDetails);

  vm_filterServiceDetails();
  detailSelect.addEventListener("change", vm_updatePrice);
}

// فلترة تفاصيل الخدمة حسب النوع
function vm_filterServiceDetails(){
  const type = document.getElementById("service_type").value;
  const detailSelect = document.getElementById("service_detail");

  const filtered = VM_STATE.services.filter(s => String(s[4]) === String(type));

  detailSelect.innerHTML = filtered.map(s =>
    `<option value="${s[0]}" data-price="${s[2]}" data-commission="${s[1]}">
      ${s[0]}
    </option>`
  ).join("");

  vm_updatePrice();
}

// تحديث السعر والنقاط بناءً على الخدمة
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
  const points = Math.round(price / 10); // مثال: كل 10 ريال = نقطة
  document.getElementById("points").value = points;
}

// بحث عن العميل + سياراته
async function vm_searchCustomer(){
  const phone = document.getElementById("phone").value.trim();
  if(!phone){
    alert("ادخل رقم الجوال");
    return;
  }

  const infoBox = document.getElementById("customerInfo");
  infoBox.style.display = "none";

  const custRes = await apiGetCustomerByPhone(phone);
  if(!custRes.success){
    alert("العميل غير موجود");
    return;
  }

  const c = custRes.customer;
  VM_STATE.customer = {
    name: c[0],
    phone: c[1],
    membership: c[8],
    city: c[4]
  };

  infoBox.style.display = "block";
  infoBox.innerHTML = `
    الاسم: ${VM_STATE.customer.name}<br>
    العضوية: ${VM_STATE.customer.membership || "—"}<br>
    المدينة: ${VM_STATE.customer.city || "—"}
  `;

  const carsRes = await apiGetCarsByPhone(phone);
  if(!carsRes.success || !carsRes.cars || carsRes.cars.length === 0){
    document.getElementById("carsBox").style.display = "none";
    document.getElementById("visitBox").style.display = "none";
    alert("لا توجد سيارات مسجلة لهذا العميل");
    return;
  }

  VM_STATE.cars = carsRes.cars.map(c => c.data);
  vm_renderCars();
}

// عرض السيارات للاختيار
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
      });
      div.style.background = "#111827";
      document.getElementById("visitBox").style.display = "block";
    });

    list.appendChild(div);
  });
}

// إضافة خدمة إلى قائمة الزيارة
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

// عرض الخدمات المضافة
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

// تحميل الفروع
async function vm_loadBranches(){
  const res = await apiGetBranches();
  if(!res.success) return;

  const branches = res.rows || [];
  VM_STATE.branches = branches;

  const select = document.getElementById("branch");
  select.innerHTML = '<option value="">— اختر الفرع —</option>' +
    branches.map(b => `<option value="${b[0]}">${b[0]} - ${b[1]}</option>`).join("");
}

// تسجيل الزيارة
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

  if(!payment_status || !payment_method || !parking_slot || !branch){
    alert("أكمل بيانات الدفع والفرع والموقف");
    return;
  }

  // هنا بنسجل زيارة واحدة بإجمالي الخدمات (ممكن تطورها لاحقاً لتفاصيل متعددة)
  const totalPrice = VM_STATE.selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalPoints = VM_STATE.selectedServices.reduce((sum, s) => sum + s.points, 0);
  const serviceNames = VM_STATE.selectedServices.map(s => s.name).join(" + ");

  const res = await apiAddVisit({
    membership: VM_STATE.selectedMembership,
    service_detail: serviceNames,
    price: totalPrice,
    points: totalPoints,
    employee_in: "", // ممكن تربطها بتسجيل دخول الموظف
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

  alert("تم تسجيل الزيارة بنجاح");
  VM_STATE.selectedServices = [];
  vm_renderSelectedServices();
  vm_loadActiveVisits();
}

// تحميل السيارات داخل المغسلة (غير مدفوعة)
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

// إغلاق زيارة (مدفوعة)
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
