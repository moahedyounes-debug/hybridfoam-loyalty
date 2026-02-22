/* ===========================
   أدوات مساعدة
=========================== */

const el = id => document.getElementById(id);

let selectedServices = [];
let carTypesData = [];
let servicesData = [];
let activeVisits = [];
let selectedVisitRow = null;
let currentMembership = "";

/* ===========================
   Toast
=========================== */

function showToast(msg, type = "info") {
  const container = el("toast-container");
  const div = document.createElement("div");
  div.className = "toast " + type;
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => div.classList.add("show"), 10);
  setTimeout(() => div.remove(), 3000);
}

/* ===========================
   تحميل الزيارات النشطة
=========================== */

async function loadActiveVisits() {
  const list = el("activeVisitsList");
  list.innerHTML = "جارِ التحميل...";

  try {
    const res = await apiGetActiveVisits();
    const rows = res.visits || [];
    activeVisits = rows;

    list.innerHTML = "";

    if (!rows.length) {
      list.innerHTML = "<p>لا توجد زيارات حالياً.</p>";
      return;
    }

    const cars = {};

    rows.forEach(r => {
      const row = r.data;
      const visitRow = r.row;

      const membership = row[0];
      const plate = row[1];
      const serviceName = row[6];
      const price = Number(row[7] || 0);
      const checkIn = row[13];
      const parking = row[17];

      if (!cars[plate]) {
        cars[plate] = {
          plate,
          membership,
          services: [],
          totalPrice: 0,
          checkIn,
          parking,
          rows: []
        };
      }

      cars[plate].services.push({ name: serviceName, price });
      cars[plate].totalPrice += price;
      cars[plate].rows.push(visitRow);
    });

    Object.values(cars).forEach(car => {
      const card = document.createElement("div");
      card.className = "car-card";

      const servicesHTML = car.services
        .map(s => `<li>${s.name} — ${s.price} ريال</li>`)
        .join("");

      card.innerHTML = `
        <h4>لوحة: ${car.plate || "-"}</h4>
        <p><b>رقم العضوية:</b> ${car.membership || "-"}</p>
        <p><b>الإجمالي:</b> ${car.totalPrice} ريال</p>
        <p><b>الدخول:</b> ${car.checkIn || "-"}</p>
        <p><b>رقم الموقف:</b> ${car.parking || "-"}</p>

        <p><b>الخدمات:</b></p>
        <ul>${servicesHTML}</ul>

        <div class="dropdown">
          <button class="btn-pay">تحديث الدفع ▼</button>
          <div class="dropdown-content">
            <a href="#" data-method="كاش" data-rows="${car.rows}">دفع كاش</a>
            <a href="#" data-method="شبكة" data-rows="${car.rows}">دفع شبكة</a>
            <a href="#" data-method="جزئي" data-rows="${car.rows}">دفع جزئي</a>
          </div>
        </div>
      `;

      list.appendChild(card);
    });

  } catch (err) {
    console.error(err);
    showToast("خطأ في تحميل الزيارات", "error");
  }
}

/* ===========================
   Event Delegation للقائمة
=========================== */

document.addEventListener("click", function (e) {
  if (e.target.matches(".dropdown-content a")) {
    e.preventDefault();

    const method = e.target.getAttribute("data-method");
    const rows = e.target.getAttribute("data-rows").split(",");

    selectedVisitRow = rows[rows.length - 1];

    openPaymentModal(method);
  }
});

/* ===========================
   مودال الدفع
=========================== */

function openPaymentModal(method) {
  el("modal").style.display = "block";
  el("modal_method").textContent = method;

  el("modal_cash").value = "";
  el("modal_card").value = "";

  if (method === "كاش") {
    el("cash_box").style.display = "block";
    el("card_box").style.display = "none";
  } else if (method === "شبكة") {
    el("cash_box").style.display = "none";
    el("card_box").style.display = "block";
  } else {
    el("cash_box").style.display = "block";
    el("card_box").style.display = "block";
  }

  el("modal_confirm").onclick = () => submitPayment(method);
}

function closeModal() {
  el("modal").style.display = "none";
}

/* ===========================
   إرسال الدفع (نهائي)
=========================== */

async function submitPayment(method) {
  const cash = Number(el("modal_cash").value || 0);
  const card = Number(el("modal_card").value || 0);

  // 1) جمع كل الصفوف الخاصة بالزيارة
  const visitRows = activeVisits.filter(v => v.row === selectedVisitRow);

  if (!visitRows.length) {
    showToast("تعذر العثور على بيانات الزيارة", "error");
    return;
  }

  // 2) حساب إجمالي الزيارة الحقيقي (مجموع الأسعار لكل الخدمات)
  const totalRequired = visitRows.reduce((sum, v) => {
    return sum + Number(v.data[7] || 0);
  }, 0);

  // 3) مجموع الدفع
  const totalPaid = cash + card;

  // 4) التحقق
  if (totalPaid !== totalRequired) {
    showToast(`المبلغ المدفوع يجب أن يكون ${totalRequired} ريال`, "error");
    return;
  }

  // 5) إرسال الدفع
  try {
    await apiPost({
      action: "closeVisit",
      row: selectedVisitRow,
      payment_status: "مدفوع",
      payment_method: method,
      cash_amount: cash,
      card_amount: card
    });

    showToast("تم تحديث الدفع", "success");
    closeModal();
    loadActiveVisits();

  } catch (err) {
    console.error(err);
    showToast("خطأ في تحديث الدفع", "error");
  }
}

/* ===========================
   تحميل أنواع السيارات
=========================== */

async function loadCarTypes() {
  try {
    const res = await apiGetCarTypes();
    carTypesData = res.rows || [];

    const brandSelect = el("car_type");
    const modelSelect = el("car_model");
    const sizeInput = el("car_size");

    brandSelect.innerHTML = '<option value="">— اختر البراند —</option>';
    modelSelect.innerHTML = '<option value="">— اختر الموديل —</option>';
    sizeInput.value = "";

    const brands = [...new Set(carTypesData.map(r => r[0]))];

    brands.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b;
      opt.textContent = b;
      brandSelect.appendChild(opt);
    });

    brandSelect.addEventListener("change", () => {
      const brand = brandSelect.value;
      modelSelect.innerHTML = '<option value="">— اختر الموديل —</option>';
      sizeInput.value = "";

      if (!brand) return;

      const models = carTypesData.filter(r => r[0] === brand);
      const uniqueModels = [...new Set(models.map(r => r[1]))];

      uniqueModels.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        modelSelect.appendChild(opt);
      });
    });

    modelSelect.addEventListener("change", () => {
      const brand = brandSelect.value;
      const model = modelSelect.value;
      const row = carTypesData.find(r => r[0] === brand && r[1] === model);
      sizeInput.value = row ? row[2] : "";
    });

  } catch (err) {
    console.error(err);
    showToast("خطأ في تحميل أنواع السيارات", "error");
  }
}

/* ===========================
   تحميل الخدمات
=========================== */

async function loadServices() {
  try {
    const res = await apiGetServices();
    servicesData = res.services || [];

    const typeSelect = el("service_type");
    const detailSelect = el("service_detail");

    typeSelect.innerHTML = '<option value="">— اختر نوع الخدمة —</option>';
    detailSelect.innerHTML = '<option value="">— اختر الخدمة —</option>';

    const categories = [...new Set(servicesData.map(s => s.Category || s.category))];

    categories.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      typeSelect.appendChild(opt);
    });

    typeSelect.addEventListener("change", () => {
      const cat = typeSelect.value;
      detailSelect.innerHTML = '<option value="">— اختر الخدمة —</option>';

      const filtered = servicesData.filter(s => (s.Category || s.category) === cat);

      filtered.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.service;
        opt.textContent = s.service;
        detailSelect.appendChild(opt);
      });
    });

    detailSelect.addEventListener("change", () => {
      const name = detailSelect.value;
      const row = servicesData.find(s => s.service === name);

      el("price").value = row ? row.price : 0;
      el("points").value = row ? row.commission : 0; // العمولة من الشيت
    });

  } catch (err) {
    console.error(err);
    showToast("خطأ في تحميل الخدمات", "error");
  }
}

/* ===========================
   تحميل الموظفين
=========================== */

async function loadEmployees() {
  try {
    const res = await apiGetEmployees();
    const employees = res.rows || [];

    const sel = el("employee_in");
    sel.innerHTML = '<option value="">— اختر الموظف —</option>';

    employees.forEach(e => {
      const opt = document.createElement("option");
      opt.value = e[0];
      opt.textContent = e[0];
      sel.appendChild(opt);
    });

  } catch (err) {
    console.error(err);
    showToast("خطأ في تحميل الموظفين", "error");
  }
}

/* ===========================
   إضافة خدمة
=========================== */

function addServiceToList() {
  const detail = el("service_detail").value;
  const price = Number(el("price").value || 0);
  const points = Number(el("points").value || 0);

  if (!detail) {
    showToast("اختر خدمة", "error");
    return;
  }

  selectedServices.push({
    name: detail,
    price,
    points,
    commission: points // نستخدم نفس القيمة كعمولة
  });

  renderServicesList();
  recalcTotal();
}

function renderServicesList() {
  const box = el("servicesList");
  box.innerHTML = "";

  if (!selectedServices.length) {
    box.textContent = "لا توجد خدمات مضافة بعد.";
    return;
  }

  selectedServices.forEach((s, i) => {
    const div = document.createElement("div");
    div.className = "service-item";
    div.innerHTML = `
      <span>${s.name} - ${s.price} ريال</span>
      <button class="btn-remove" data-i="${i}">حذف</button>
    `;
    box.appendChild(div);
  });

  box.querySelectorAll(".btn-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-i"));
      selectedServices.splice(i, 1);
      renderServicesList();
      recalcTotal();
    });
  });
}

/* ===========================
   حساب الإجمالي
=========================== */

function recalcTotal() {
  const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const discount = Number(el("discount").value || 0);
  el("totalPrice").textContent = Math.max(0, total - discount);
}

/* ===========================
   إرسال الزيارة
=========================== */

async function submitVisit() {
  const btn = el("btnSubmitVisit");

  btn.classList.add("btn-loading");
  btn.textContent = "جاري تسجيل الزيارة...";
  btn.disabled = true;

  const plate_numbers = el("plate_numbers").value.trim();
  const plate_letters = el("plate_letters").value.trim();
  const car_type = el("car_type").value;
  const car_model = el("car_model").value;
  const car_size = el("car_size").value;
  const employee_in = el("employee_in").value;
  const branch = el("branch").value;
  const parking_slot = el("parking_slot").value;
  const payment_status = el("payment_status").value.trim();
  const payment_method = el("payment_method").value.trim();

  if (!plate_numbers) {
    showToast("أدخل أرقام اللوحة", "error");
    btn.classList.remove("btn-loading");
    btn.textContent = "تسجيل الزيارة";
    btn.disabled = false;
    return;
  }
  if (!employee_in) {
    showToast("اختر الموظف", "error");
    btn.classList.remove("btn-loading");
    btn.textContent = "تسجيل الزيارة";
    btn.disabled = false;
    return;
  }
  if (!selectedServices.length) {
    showToast("أضف خدمة واحدة على الأقل", "error");
    btn.classList.remove("btn-loading");
    btn.textContent = "تسجيل الزيارة";
    btn.disabled = false;
    return;
  }

  const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const discount = Number(el("discount").value || 0);
  const finalTotal = Math.max(0, total - discount);

  let remaining = finalTotal;

  const servicesWithNet = selectedServices.map((s, idx) => {
    if (idx === selectedServices.length - 1) {
      return { ...s, price: remaining };
    }
    const ratio = total ? s.price / total : 0;
    const net = Math.round(finalTotal * ratio);
    remaining -= net;
    return { ...s, price: net };
  });

  let cash_amount = 0;
  let card_amount = 0;

  if (payment_method === "جزئي") {
    cash_amount = Number(el("cash_amount").value || 0);
    card_amount = Number(el("card_amount").value || 0);
  } else if (payment_method === "كاش") {
    cash_amount = finalTotal;
  } else if (payment_method === "شبكة") {
    card_amount = finalTotal;
  }

  const payload = {
    membership: currentMembership,
    plate_numbers,
    plate_letters,
    car_type,
    car_model,
    car_size,
    employee_in,
    employee_out: "",
    branch,
    parking_slot,
    payment_status,
    payment_method,
    cash_amount,
    card_amount,
    rating: "",
    services: servicesWithNet
  };

  try {
    await apiAddVisit({
      ...payload,
      services: JSON.stringify(payload.services)
    });

    showToast("تم تسجيل الزيارة", "success");
    resetForm();
    loadActiveVisits();

  } catch (err) {
    console.error(err);
    showToast("خطأ في تسجيل الزيارة", "error");
  } finally {
    btn.classList.remove("btn-loading");
    btn.textContent = "تسجيل الزيارة";
    btn.disabled = false;
  }
}

/* ===========================
   إعادة تعيين النموذج
=========================== */

function resetForm() {
  el("plate_numbers").value = "";
  el("plate_letters").value = "";
  el("car_type").value = "";
  el("car_model").innerHTML = '<option value="">— اختر الموديل —</option>';
  el("car_size").value = "";
  el("service_type").value = "";
  el("service_detail").innerHTML = '<option value="">— اختر الخدمة —</option>';
  el("price").value = "";
  el("points").value = "";
  el("discount").value = "";
  el("parking_slot").value = "";
  el("payment_status").value = "";
  el("payment_method").value = "";
  el("payment_method_wrapper").style.display = "none";
  el("partial_payment_box").style.display = "none";

  selectedServices = [];
  renderServicesList();
  recalcTotal();
  currentMembership = "";
}

/* ===========================
   INIT
=========================== */

document.addEventListener("DOMContentLoaded", () => {
  loadActiveVisits();
  loadCarTypes();
  loadServices();
  loadEmployees();

  el("btnRefreshActive").addEventListener("click", loadActiveVisits);
  el("btnAddService").addEventListener("click", addServiceToList);
  el("discount").addEventListener("input", recalcTotal);
  el("btnSubmitVisit").addEventListener("click", submitVisit);

  el("modal_close").addEventListener("click", closeModal);

  // إظهار/إخفاء طريقة الدفع + الجزئي
  el("payment_status").addEventListener("change", () => {
    const val = el("payment_status").value;
    if (val === "مدفوع") {
      el("payment_method_wrapper").style.display = "block";
    } else {
      el("payment_method_wrapper").style.display = "none";
      el("partial_payment_box").style.display = "none";
    }
  });

  el("payment_method").addEventListener("change", () => {
    const val = el("payment_method").value;
    if (val === "جزئي") {
      el("partial_payment_box").style.display = "block";
    } else {
      el("partial_payment_box").style.display = "none";
    }
  });
});
