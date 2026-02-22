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

  const rows = visitsRes.rows || [];
  const today = new Date().toISOString().slice(0, 10);

  let total = 0, cash = 0, network = 0;
  const serviceCount = {};

  rows.forEach(v => {
    const checkIn = String(v[13] || "");      // CHECK_IN
    const status  = String(v[15] || "").trim(); // PAY_STATUS
    if (!checkIn.startsWith(today)) return;
    if (status !== "مدفوع") return;

    const service = String(v[6] || "غير محدد"); // SERVICE
    const paid    = Number(v[22] || v[7] || 0);  // TOTAL_PAID أو PRICE
    const method  = String(v[16] || "");         // PAY_METHOD

    total += paid;
    if (method === "كاش")   cash    += paid;
    if (method === "شبكة") network += paid;

    serviceCount[service] = (serviceCount[service] || 0) + 1;
  });

  document.getElementById("todayTotal").innerText   = total   + " ريال";
  document.getElementById("todayCash").innerText    = cash    + " ريال";
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
  const carsRes      = await apiGetAll("Cars");
  const visitsRes    = await apiGetAll("Visits");

  if (!customersRes.success) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9CA3AF;">خطأ في قراءة البيانات</td></tr>';
    return;
  }

  const customers = customersRes.rows || [];

  const carsByMembership = {};
  if (carsRes.success) {
    (carsRes.rows || []).forEach(c => {
      const mem = c[0]; // membership
      if (!carsByMembership[mem]) carsByMembership[mem] = [];
      carsByMembership[mem].push(c);
    });
  }

  const visitsByMembership = {};
  if (visitsRes.success) {
    (visitsRes.rows || []).forEach(v => {
      const mem = v[0]; // membership
      if (!visitsByMembership[mem]) visitsByMembership[mem] = [];
      visitsByMembership[mem].push(v);
    });
  }

  const filtered = customers.filter(c => {
    const name = String(c[0] || "").toLowerCase(); // NAME
    const phone = String(c[1] || "").toLowerCase(); // PHONE
    const mem = String(c[8] || "").toLowerCase();   // MEMBERSHIP
    if (!q) return true;
    return name.includes(q) || phone.includes(q) || mem.includes(q);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9CA3AF;">لا توجد نتائج</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const mem = c[8];
    const cars   = carsByMembership[mem]   || [];
    const visits = visitsByMembership[mem] || [];

    const servicesCount = visits.length; // صف لكل خدمة
    const paidAmount = visits.reduce((sum, v) => {
      return sum + Number(v[22] || 0); // TOTAL_PAID (آخر صف لكل زيارة)
    }, 0);

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
  const carMap = {};

  if (carsRes.success) {
    (carsRes.rows || []).forEach(r => {
      const mem = r[0]; // membership
      carMap[mem] = {
        car:     r[2], // CAR
        letters: r[4], // PLATE_LETTERS
        numbers: r[5]  // PLATE_NUMBERS
      };
    });
  }

  box.innerHTML = res.visits.map(v => {
    const row = v.row;
    const d   = v.data;
    const mem = d[0]; // membership

    let plate   = "غير معروف";
    let carName = "";

    if (carMap[mem]) {
      plate   = `${carMap[mem].numbers} ${carMap[mem].letters}`;
      carName = carMap[mem].car;
    }

    const service = d[6];           // SERVICE
    const price   = Number(d[7] || 0); // PRICE
    const parking = d[17] || "—";   // PARKING
    const checkIn = d[13] || "";    // CHECK_IN

    return `
      <div style="border:1px solid #E5E7EB;border-radius:10px;padding:6px 8px;margin-bottom:6px;font-size:13px;">
        <b>🚗 اللوحة:</b> ${plate} — ${carName}<br>
        <b>العضوية:</b> ${mem || "—"}<br>
        <b>الخدمة:</b> ${service}<br>
        <b>السعر:</b> ${price} ريال<br>
        <b>الموقف:</b> ${parking}<br>
        <b>الدخول:</b> ${checkIn}<br>

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
  if (!res.success || !res.rows || !res.rows.length) {
    box.innerHTML = "لا توجد حجوزات حالياً.";
    return;
  }

  box.innerHTML = res.rows.map((b, idx) => {
    const phone   = b[0]; // PHONE
    const mem     = b[1]; // MEMBERSHIP
    const service = b[2]; // SERVICE
    const date    = b[3]; // DATE
    const time    = b[4]; // TIME
    const status  = b[5]; // STATUS

    return `
      <div style="border:1px solid #E5E7EB;border-radius:10px;padding:6px 8px;margin-bottom:6px;font-size:13px;">
        <b>الخدمة:</b> ${service}<br>
        <b>التاريخ:</b> ${date} ${time}<br>
        <b>الجوال:</b> ${phone}<br>
        <b>العضوية:</b> ${mem || "—"}<br>
        <b>الحالة:</b> <span class="tag">${status}</span><br>

        <button class="btn" style="margin-top:4px;font-size:11px;padding:4px 8px;"
          onclick="updateBooking(${idx + 2}, 'مؤكد')">تأكيد</button>

        <button class="btn-outline" style="margin-top:4px;font-size:11px;padding:4px 8px;"
          onclick="updateBooking(${idx + 2}, 'ملغي')">إلغاء</button>
      </div>
    `;
  }).join("");
}

async function updateBooking(row, status) {
  const resOld = await apiGetAll("Bookings");
  if (!resOld.success || !resOld.rows || !resOld.rows[row - 2]) {
    alert("خطأ في قراءة بيانات الحجز");
    return;
  }

  const old = resOld.rows[row - 2];

  const newValues = [
    old[0], // phone
    old[1], // membership
    old[2], // service
    old[3], // date
    old[4], // time
    status, // new status
    old[6]  // created_at
  ];

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
  const q   = document.getElementById("invoiceSearch").value.trim();
  const box = document.getElementById("invoiceVisits");

  box.innerHTML = "جاري البحث...";

  if (!q) {
    box.innerHTML = "اكتب رقم الجوال أو العضوية.";
    return;
  }

  let custRes;
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
    name:       c[0], // NAME
    phone:      c[1], // PHONE
    membership: c[8]  // MEMBERSHIP
  };

  const visitsRes = await apiGetVisitsByMembership(c[8]);

  if (!visitsRes.success || !visitsRes.visits || !visitsRes.visits.length) {
    box.innerHTML = "لا توجد زيارات لهذا العميل.";
    INVOICE_STATE.visits = [];
    return;
  }

  INVOICE_STATE.visits = visitsRes.visits.map(v => v.data);

  box.innerHTML = INVOICE_STATE.visits.map((v, idx) => {
    const service = v[6];           // SERVICE
    const price   = Number(v[7] || 0); // PRICE
    const points  = Number(v[8] || 0); // POINTS
    const date    = String(v[13] || "").split(" ")[0]; // CHECK_IN (تاريخ فقط)

    return `
      <div style="border-bottom:1px solid #E5E7EB;padding:4px 0;font-size:13px;">
        #${idx + 1} — ${service} — ${price} ريال — نقاط: ${points} — ${date}
      </div>
    `;
  }).join("");
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
  const lines = selectedVisits.map((v, idx) => {
    const service = v[6]; // SERVICE
    const price   = Number(v[7] || 0); // PRICE
    const points  = Number(v[8] || 0); // POINTS
    const date    = String(v[13] || "").split(" ")[0]; // CHECK_IN

    total += Number(v[22] || price || 0); // TOTAL_PAID أو PRICE

    return `${idx + 1}- ${service} — ${price} ريال (نقاط: ${points}) — ${date}`;
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
