/* ============================
   تسجيل خروج
============================ */
function logout() {
  localStorage.removeItem("supervisor");
  window.location.href = "index.html";
}

/* ============================
   ملخص اليوم
============================ */
async function loadTodaySummary() {
  const visitsRes = await apiGetAll("Visits");
  if (!visitsRes.success) return;

  const today = new Date().toISOString().slice(0, 10);
  const todayVisits = visitsRes.rows.filter(v => String(v[8] || "").startsWith(today));

  let total = 0, cash = 0, network = 0;
  const serviceCount = {};

  todayVisits.forEach(v => {
    const price = Number(v[2] || 0);
    const method = String(v[11] || "");
    const service = String(v[1] || "غير محدد");

    total += price;
    if (method === "كاش") cash += price;
    if (method === "شبكة") network += price;

    serviceCount[service] = (serviceCount[service] || 0) + 1;
  });

  document.getElementById("todayTotal").innerText = total + " ريال";
  document.getElementById("todayCash").innerText = cash + " ريال";
  document.getElementById("todayNetwork").innerText = network + " ريال";

  const servicesBox = document.getElementById("todayServices");
  if (Object.keys(serviceCount).length === 0) {
    servicesBox.innerText = "لا توجد خدمات اليوم.";
  } else {
    servicesBox.innerHTML = Object.keys(serviceCount)
      .map(s => `<div>${s}: <span class="tag">${serviceCount[s]}</span></div>`)
      .join("");
  }

  const customersRes = await apiGetAll("Customers");
  if (customersRes.success) {
    document.getElementById("totalMembers").innerText = customersRes.rows.length;
  }
}

/* ============================
   بيانات العملاء
============================ */
async function loadCustomers() {
  const q = document.getElementById("customerSearch").value.trim().toLowerCase();
  const tbody = document.getElementById("customersTable");

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9CA3AF;">جاري التحميل...</td></tr>';

  const customersRes = await apiGetAll("Customers");
  const carsRes = await apiGetAll("Cars");
  const visitsRes = await apiGetAll("Visits");

  if (!customersRes.success) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9CA3AF;">خطأ في قراءة البيانات</td></tr>';
    return;
  }

  const customers = customersRes.rows;

  const carsByMembership = {};
  if (carsRes.success) {
    carsRes.rows.forEach(c => {
      const mem = c[0];
      if (!carsByMembership[mem]) carsByMembership[mem] = [];
      carsByMembership[mem].push(c);
    });
  }

  const visitsByMembership = {};
  if (visitsRes.success) {
    visitsRes.rows.forEach(v => {
      const mem = v[0];
      if (!visitsByMembership[mem]) visitsByMembership[mem] = [];
      visitsByMembership[mem].push(v);
    });
  }

  const filtered = customers.filter(c => {
    const name = String(c[0] || "").toLowerCase();
    const phone = String(c[1] || "").toLowerCase();
    const mem = String(c[8] || "").toLowerCase();
    if (!q) return true;
    return name.includes(q) || phone.includes(q) || mem.includes(q);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9CA3AF;">لا توجد نتائج</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const mem = c[8];
    const cars = carsByMembership[mem] || [];
    const visits = visitsByMembership[mem] || [];
    const servicesCount = visits.length;
    const paidAmount = visits.reduce((sum, v) => sum + Number(v[2] || 0), 0);

    return `
      <tr>
        <td>${c[0]}</td>
        <td>${mem || "—"}</td>
        <td>${cars.length}</td>
        <td>${visits.length}</td>
        <td>${servicesCount}</td>
        <td>${paidAmount} ريال</td>
      </tr>
    `;
  }).join("");
}

/* ============================
   السيارات غير المدفوعة
============================ */
async function loadActiveVisits() {
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
      <div style="border:1px solid #E5E7EB;border-radius:10px;padding:6px 8px;margin-bottom:6px;font-size:13px;">
        <b>🚗 اللوحة:</b> ${plate} — ${carName}<br>
        <b>العضوية:</b> ${mem || "—"}<br>
        <b>الخدمة:</b> ${d[1]}<br>
        <b>السعر:</b> ${d[2]} ريال<br>
        <b>الموقف:</b> ${d[12] || "—"}<br>

        <label style="font-size:12px;">طريقة الدفع</label>
        <select id="pay_${row}" style="margin-top:2px;">
          <option value="كاش">كاش</option>
          <option value="شبكة">شبكة</option>
        </select>

        <button class="btn" style="margin-top:4px;font-size:11px;padding:4px 8px;" onclick="markPaid(${row})">
          تحديث حالة الدفع
        </button>
      </div>
    `;
  }).join("");
}

async function markPaid(row) {
  const method = document.getElementById(`pay_${row}`).value;

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

  alert("تم تحديث حالة الدفع");
  loadActiveVisits();
}

/* ============================
   الحجوزات
============================ */
async function loadBookings() {
  const box = document.getElementById("bookingsList");
  box.innerHTML = "جاري التحميل...";

  const res = await apiGetAll("Bookings");
  if (!res.success || !res.rows.length) {
    box.innerHTML = "لا توجد حجوزات حالياً.";
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
      <div style="border:1px solid #E5E7EB;border-radius:10px;padding:6px 8px;margin-bottom:6px;font-size:13px;">
        <b>الخدمة:</b> ${service}<br>
        <b>التاريخ:</b> ${date} ${time}<br>
        <b>الجوال:</b> ${phone}<br>
        <b>العضوية:</b> ${mem || "—"}<br>
        <b>الحالة:</b> <span class="tag">${status}</span><br>

        <button class="btn" style="margin-top:4px;font-size:11px;padding:4px 8px;"
          onclick="updateBooking(${idx + 2}, '${phone}', 'مؤكد')">تأكيد</button>

        <button class="btn-outline" style="margin-top:4px;font-size:11px;padding:4px 8px;"
          onclick="updateBooking(${idx + 2}, '${phone}', 'ملغي')">إلغاء</button>
      </div>
    `;
  }).join("");
}

async function updateBooking(row, phone, status) {

  // 1) قراءة بيانات الحجز الأصلية
  const resOld = await apiGetAll("Bookings");
  const old = resOld.rows[row - 2]; // الصفوف تبدأ من 2

  // 2) بناء الصف الجديد بدون حذف أي بيانات
  const newValues = [
    old[0], // phone
    old[1], // membership
    old[2], // service
    old[3], // date
    old[4], // time
    status, // new status
    old[6]  // created_at
  ];

  // 3) تحديث الصف
  const res = await apiPost({
    action: "updateRow",
    sheet: "Bookings",
    row,
    values: JSON.stringify(newValues)
  });

  if (!res.success) {
    alert("خطأ في تحديث الحجز");
    return;
  }

  alert("تم تحديث حالة الحجز");
  loadBookings();
}

/* ============================
   الفواتير
============================ */
let INVOICE_STATE = {
  customer: null,
  visits: []
};

async function searchInvoices() {
  const q = document.getElementById("invoiceSearch").value.trim();
  const box = document.getElementById("invoiceVisits");

  box.innerHTML = "جاري البحث...";

  if (!q) {
    box.innerHTML = "اكتب رقم الجوال أو العضوية.";
    return;
  }

  let custRes = null;

  if (/^05\d{8}$/.test(q)) {
    custRes = await apiGetCustomerByPhone(q);
  } else {
    custRes = await apiGetCustomerByMembership(q);
  }

  if (!custRes.success) {
    box.innerHTML = "لم يتم العثور على العميل.";
    return;
  }

  const c = custRes.customer;

  INVOICE_STATE.customer = {
    name: c[0],
    phone: c[1],
    membership: c[8]
  };

  const visitsRes = await apiGetVisitsByMembership(c[8]);

  if (!visitsRes.success || !visitsRes.visits.length) {
    box.innerHTML = "لا توجد زيارات لهذا العميل.";
    INVOICE_STATE.visits = [];
    return;
  }

  INVOICE_STATE.visits = visitsRes.visits.map(v => v.data);

  box.innerHTML = INVOICE_STATE.visits.map((v, idx) => `
    <div style="border-bottom:1px solid #E5E7EB;padding:4px 0;font-size:13px;">
      #${idx + 1} — ${v[1]} — ${v[2]} ريال — ${v[8]}
    </div>
  `).join("");
}

function sendInvoice(mode) {
  if (!INVOICE_STATE.customer || !INVOICE_STATE.visits.length) {
    alert("ابحث عن العميل أولاً.");
    return;
  }

  let selectedVisits = [];

  if (mode === "last") {
    selectedVisits = [INVOICE_STATE.visits[INVOICE_STATE.visits.length - 1]];
  } else {
    selectedVisits = INVOICE_STATE.visits;
  }

  const c = INVOICE_STATE.customer;

  let total = 0;
  let lines = selectedVisits.map((v, idx) => {
    total += Number(v[2] || 0);
    return `${idx + 1}- ${v[1]} — ${v[2]} ريال (${v[8]})`;
  }).join("\n");

  const msg =
    `فاتورة زيارات مغسلة رغوة الهجين\n` +
    `العميل: ${c.name}\n` +
    `الجوال: ${c.phone}\n` +
    `العضوية: ${c.membership}\n\n` +
    `الزيارات:\n${lines}\n\n` +
    `الإجمالي: ${total} ريال`;

  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

/* ============================
   تشغيل أولي
============================ */
loadTodaySummary();
loadCustomers();
loadActiveVisits();
loadBookings();
