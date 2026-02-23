// =========================
// تسجيل خروج
// =========================
function logout() {
  localStorage.removeItem("supervisor");
  window.location.href = "index.html";
}

// =========================
// تحويل التاريخ لصيغة yyyy-mm-dd
// =========================
function toDayString(d) {
  const x = new Date(d);
  if (isNaN(x)) return "";
  return x.toISOString().slice(0, 10);
}

// =========================
// التبويبات
// =========================
const tabs = document.querySelectorAll(".tab");
const tabViews = {
  summary: document.getElementById("tab-summary"),
  visits: document.getElementById("tab-visits"),
  customers: document.getElementById("tab-customers"),
  bookings: document.getElementById("tab-bookings"),
  invoices: document.getElementById("tab-invoices")
};

tabs.forEach(t => {
  t.addEventListener("click", () => {
    tabs.forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    const key = t.getAttribute("data-tab");
    Object.keys(tabViews).forEach(k => {
      tabViews[k].style.display = k === key ? "block" : "none";
    });
  });
});

// =========================
// تحميل الملخص
// =========================
async function loadSummary() {
  const sumTotal = document.getElementById("sumTotal");
  const sumCash = document.getElementById("sumCash");
  const sumCard = document.getElementById("sumCard");
  const sumVisits = document.getElementById("sumVisits");
  const sumServices = document.getElementById("sumServices");
  const sumCustomers = document.getElementById("sumCustomers");
  const sumServicesByType = document.getElementById("sumServicesByType");

  sumTotal.innerText = "جاري التحميل...";
  sumCash.innerText = "...";
  sumCard.innerText = "...";
  sumVisits.innerText = "...";
  sumServices.innerText = "...";
  sumCustomers.innerText = "...";
  sumServicesByType.innerText = "جاري التحميل...";

  const visitsRes = await apiGetAll("Visits");
  const custRes = await apiGetAll("Customers");

  if (!visitsRes.success) {
    sumTotal.innerText = "خطأ في قراءة الزيارات";
    return;
  }

  const today = toDayString(new Date());
  let total = 0, cash = 0, card = 0, visitsCount = 0, servicesCount = 0;
  const byService = {};

  (visitsRes.rows || []).forEach(r => {
    const checkIn = r[13];
    const payStatus = String(r[15] || "").trim();
    if (!checkIn || payStatus !== "مدفوع") return;

    const day = String(checkIn).split(" ")[0];
    if (day !== today) return;

    const price = Number(r[7] || 0);
    const cashAmount = Number(r[20] || 0);
    const cardAmount = Number(r[21] || 0);
    const totalPaid = Number(r[22] || price);

    total += totalPaid;
    cash += cashAmount;
    card += cardAmount;
    visitsCount++;
    servicesCount++;

    // أهم تعديل — قراءة service_detail
    const service = r[6] || "غير محدد";
    byService[service] = (byService[service] || 0) + 1;
  });

  sumTotal.innerText = total + " ريال";
  sumCash.innerText = cash + " ريال";
  sumCard.innerText = card + " ريال";
  sumVisits.innerText = visitsCount;
  sumServices.innerText = servicesCount;
  sumCustomers.innerText = custRes.success && custRes.rows ? custRes.rows.length : 0;

  if (!Object.keys(byService).length) {
    sumServicesByType.innerText = "لا توجد خدمات اليوم.";
  } else {
    sumServicesByType.innerHTML = Object.keys(byService)
      .map(s => `<div>${s}: <span class="tag">${byService[s]}</span></div>`)
      .join("");
  }
}
// =========================
// زيارات اليوم
// =========================
async function loadTodayVisits() {
  const box = document.getElementById("todayVisitsBox");
  box.innerHTML = "جاري التحميل...";

  const res = await apiGetAll("Visits");
  if (!res.success) {
    box.innerHTML = "<span style='color:#d32f2f;'>خطأ في قراءة البيانات</span>";
    return;
  }

  const today = toDayString(new Date());
  const rows = (res.rows || []).filter(r => {
    const checkIn = r[13];
    if (!checkIn) return false;
    const day = String(checkIn).split(" ")[0];
    return day === today;
  });

  if (!rows.length) {
    box.innerHTML = "<span style='color:#9ca3af;'>لا توجد زيارات اليوم.</span>";
    return;
  }

  box.innerHTML = rows.map(r => {
    const plate = `${r[1] || ""} ${r[2] || ""}`;
    const service = r[6] || "—"; // service_detail
    const price = Number(r[7] || 0);
    const emp = r[9] || "—";
    const status = r[15] || "غير مدفوع";

    return `
<div style="border-bottom:1px solid #e5e7eb;padding:6px 0;">
  <div><b>🚗 السيارة:</b> ${plate}</div>
  <div><b>الخدمة:</b> ${service}</div>
  <div><b>السعر:</b> ${price} ريال</div>
  <div><b>الموظف:</b> ${emp}</div>
  <div><b>حالة الدفع:</b> <span class="tag">${status}</span></div>
</div>`;
  }).join("");
}

// =========================
// الزيارات غير المدفوعة
// =========================
async function loadActiveVisits() {
  const box = document.getElementById("activeVisitsBox");
  box.innerHTML = "جاري التحميل...";

  const res = await apiGetActiveVisits();
  if (!res.success || !res.visits || !res.visits.length) {
    box.innerHTML = "<span style='color:#9ca3af;'>لا توجد زيارات غير مدفوعة.</span>";
    return;
  }

  box.innerHTML = res.visits.map(v => {
    const row = v.row;
    const r = v.data;

    const plate = `${r[1] || ""} ${r[2] || ""}`;
    const service = r[6] || "—"; // service_detail
    const price = Number(r[7] || 0);
    const parking = r[17] || "—";

    return `
<div style="border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px;margin-bottom:6px;">
  <div><b>🚗 السيارة:</b> ${plate}</div>
  <div><b>الخدمة:</b> ${service}</div>
  <div><b>السعر:</b> ${price} ريال</div>
  <div><b>الموقف:</b> ${parking}</div>

  <label style="font-size:12px;">طريقة الدفع</label>
  <select id="pay_${row}">
    <option value="كاش">كاش</option>
    <option value="شبكة">شبكة</option>
  </select>

  <button class="btn" style="margin-top:4px;font-size:11px;padding:4px 8px;" onclick="markPaid(${row})">
    إتمام الدفع
  </button>
</div>`;
  }).join("");
}

// =========================
// إتمام الدفع
// =========================
async function markPaid(row) {
  const method = document.getElementById("pay_" + row).value;

  const res = await apiCloseVisit(row, {
    payment_status: "مدفوع",
    payment_method: method
  });

  if (!res.success) {
    alert("خطأ في تحديث حالة الدفع");
    return;
  }

  alert("تم تحديث حالة الدفع");
  loadActiveVisits();
  loadSummary();
}

// =========================
// بحث العملاء
// =========================
let CURRENT_CUSTOMER = null;

async function searchCustomer() {
  const phone = document.getElementById("custPhone").value.trim();
  const infoBox = document.getElementById("custInfo");
  const carsBox = document.getElementById("custCars");
  const visitsBox = document.getElementById("custVisits");

  if (!phone) {
    infoBox.innerText = "اكتب رقم الجوال أولاً.";
    return;
  }

  infoBox.innerText = "جاري البحث...";
  carsBox.innerText = "جاري البحث...";
  visitsBox.innerText = "جاري البحث...";

  const custRes = await apiGetCustomerByPhone(phone);
  if (!custRes.success) {
    infoBox.innerText = "لم يتم العثور على عميل بهذا الرقم.";
    carsBox.innerText = "لا توجد بيانات.";
    visitsBox.innerText = "لا توجد بيانات.";
    CURRENT_CUSTOMER = null;
    return;
  }

  const c = custRes.customer;
  CURRENT_CUSTOMER = c;
  const membership = c[8];

  infoBox.innerHTML = `
<div><b>الاسم:</b> ${c[0] || "—"}</div>
<div><b>الجوال:</b> ${c[1] || "—"}</div>
<div><b>العضوية:</b> ${membership || "—"}</div>
<div><b>السيارة:</b> ${c[2] || "—"} (${c[3] || ""})</div>
<div><b>المدينة:</b> ${c[4] || "—"}</div>
<div><b>عدد الزيارات:</b> ${c[10] || 0}</div>
<div><b>النقاط:</b> ${c[11] || 0}</div>
`;

  // سيارات العميل
  const carsRes = await apiGetCarsByPhone(phone);
  if (!carsRes.success || !carsRes.cars || !carsRes.cars.length) {
    carsBox.innerText = "لا توجد سيارات مسجلة.";
  } else {
    carsBox.innerHTML = carsRes.cars.map(x => {
      const r = x.data;
      const plate = `${r[5] || ""} ${r[4] || ""}`;
      return `
<div style="border-bottom:1px solid #e5e7eb;padding:4px 0;">
  <div><b>السيارة:</b> ${r[2] || "—"} (${r[3] || ""})</div>
  <div><b>اللوحة:</b> ${plate}</div>
  <div><b>المدينة:</b> ${r[6] || "—"}</div>
</div>`;
    }).join("");
  }

  // زيارات العميل
  const visitsRes = await apiGetVisitsByMembership(membership);
  if (!visitsRes.success || !visitsRes.visits || !visitsRes.visits.length) {
    visitsBox.innerText = "لا توجد زيارات.";
  } else {
    visitsBox.innerHTML = visitsRes.visits.map(v => {
      const r = v.data;
      const plate = `${r[1] || ""} ${r[2] || ""}`;
      const service = r[6] || "—"; // service_detail
      const price = Number(r[7] || 0);
      const status = r[15] || "غير مدفوع";
      const checkIn = r[13] || "";

      return `
<div style="border-bottom:1px solid #e5e7eb;padding:4px 0;">
  <div><b>🚗 السيارة:</b> ${plate}</div>
  <div><b>الخدمة:</b> ${service}</div>
  <div><b>السعر:</b> ${price} ريال</div>
  <div><b>الحالة:</b> <span class="tag">${status}</span></div>
  <div><b>الدخول:</b> ${checkIn}</div>
</div>`;
    }).join("");
  }
}
// =========================
// الحجوزات
// =========================
async function loadBookings() {
  const box = document.getElementById("bookingsBox");
  box.innerHTML = "جاري التحميل...";

  const res = await apiGetAll("Bookings");
  if (!res.success || !res.rows || !res.rows.length) {
    box.innerHTML = "<span style='color:#9ca3af;'>لا توجد حجوزات.</span>";
    return;
  }

  box.innerHTML = res.rows.map((b, idx) => {
    const phone = b[0];
    const mem = b[1];
    const service = b[2];
    const date = b[3];
    const time = b[4];
    const status = b[5];

    return `
<div style="border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px;margin-bottom:6px;">
  <div><b>الخدمة:</b> ${service}</div>
  <div><b>التاريخ:</b> ${date} ${time}</div>
  <div><b>الجوال:</b> ${phone}</div>
  <div><b>العضوية:</b> ${mem || "—"}</div>
  <div><b>الحالة:</b> <span class="tag">${status}</span></div>
</div>`;
  }).join("");
}

// =========================
// الفواتير — البحث باللوحة
// =========================
let INVOICE_STATE = {
  visits: []
};

async function searchInvoices() {
  const q = document.getElementById("invPlate").value.trim().toLowerCase();
  const box = document.getElementById("invVisits");

  box.innerHTML = "جاري البحث...";

  if (!q) {
    box.innerText = "اكتب جزء من رقم اللوحة أو الأحرف.";
    return;
  }

  const res = await apiGetAll("Visits");
  if (!res.success) {
    box.innerText = "خطأ في قراءة البيانات.";
    return;
  }

  const rows = res.rows || [];
  const matched = rows.filter(r => {
    const plate = `${r[1] || ""} ${r[2] || ""}`.toLowerCase();
    return plate.includes(q);
  });

  if (!matched.length) {
    box.innerText = "لا توجد زيارات لهذه اللوحة.";
    INVOICE_STATE.visits = [];
    return;
  }

  INVOICE_STATE.visits = matched;

  box.innerHTML = matched.map((r, idx) => {
    const plate = `${r[1] || ""} ${r[2] || ""}`;
    const service = r[6] || "—"; // service_detail
    const price = Number(r[7] || 0);
    const points = Number(r[8] || 0);
    const checkIn = r[13] || "";
    const day = String(checkIn).split(" ")[0] || "";

    return `
<div style="border-bottom:1px solid #e5e7eb;padding:4px 0;">
  #${idx + 1} - ${plate} - ${service} - ${price} ريال - نقاط: ${points} - ${day}
</div>`;
  }).join("");
}

// =========================
// إرسال فاتورة واتساب
// =========================
function sendInvoice(mode) {
  if (!INVOICE_STATE.visits.length) {
    alert("ابحث عن زيارات السيارة أولاً.");
    return;
  }

  let selected = [];

  if (mode === "last") {
    selected = [INVOICE_STATE.visits[INVOICE_STATE.visits.length - 1]];
  } else {
    selected = INVOICE_STATE.visits;
  }

  let total = 0;

  const lines = selected.map((r, idx) => {
    const plate = `${r[1] || ""} ${r[2] || ""}`;
    const service = r[6] || "—"; // service_detail
    const price = Number(r[7] || 0);
    const points = Number(r[8] || 0);
    const checkIn = r[13] || "";
    const day = String(checkIn).split(" ")[0] || "";
    const paid = Number(r[22] || price);

    total += paid;

    return `${idx + 1}- ${plate} - ${service} - ${price} ريال (مدفوع: ${paid}) - نقاط: ${points} - ${day}`;
  }).join("\n");

  const msg =
    "فاتورة زيارات مغسلة رغوة الهجين\n\n" +
    lines +
    "\n\nالإجمالي: " + total + " ريال";

  const url = "https://wa.me/?text=" + encodeURIComponent(msg);
  window.open(url, "_blank");
}

// =========================
// تحميل الصفحة عند الفتح
// =========================
loadSummary();
loadTodayVisits();
loadActiveVisits();
loadBookings();
