/* ============================
   تسجيل خروج
============================ */

function logout() {
  localStorage.removeItem("supervisor");
  window.location.href = "index.html";
}

/* ============================
   أداة مساعدة للتاريخ (يوم فقط)
============================ */

function toDayString(dateLike) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (isNaN(d)) return "";
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/* ============================
   مفتاح السيارة الجديد
============================ */

function getCarKey(row) {
  const num = row[1] || "";
  const letters = row[2] || "NULL";
  return `${num}-${letters}`;
}

/* ============================
   ملخص اليوم
============================ */

let TODAY_PAID_ROWS = [];

async function loadTodaySummary() {
  const visitsRes = await apiGetAll("Visits");
  if (!visitsRes.success) return;

  const rows = visitsRes.rows || [];
  const todayStr = toDayString(new Date());

  let total = 0, cash = 0, network = 0, totalServices = 0;
  const serviceCount = {};

  TODAY_PAID_ROWS = [];

  rows.forEach(v => {
    const checkInDay = toDayString(v[13]);
    const status = String(v[15] || "").trim();

    if (checkInDay !== todayStr) return;
    if (status !== "مدفوع") return;

    const service = String(v[6] || "غير محدد");
    const paid = Number(v[22] || v[7] || 0);
    const method = String(v[16] || "");

    total += paid;
    totalServices++;

    if (method === "كاش") cash += paid;
    if (method === "شبكة") network += paid;

    serviceCount[service] = (serviceCount[service] || 0) + 1;

    TODAY_PAID_ROWS.push(v);
  });

  document.getElementById("todayTotal").innerText = total + " ريال";
  document.getElementById("todayCash").innerText = cash + " ريال";
  document.getElementById("todayNetwork").innerText = network + " ريال";
  document.getElementById("todayServicesCount").innerText = totalServices + " خدمة";

  const servicesBox = document.getElementById("todayServices");

  if (Object.keys(serviceCount).length === 0) {
    servicesBox.innerText = "لا توجد خدمات اليوم.";
  } else {
    servicesBox.innerHTML = Object.keys(serviceCount)
      .map(s => `<div>${s}: <span class="tag">${serviceCount[s]}</span></div>`)
      .join("");
  }

  renderTodayDetailsTable(TODAY_PAID_ROWS);
}

/* ============================
   جدول تفاصيل زيارات اليوم
============================ */

function renderTodayDetailsTable(rows) {
  const tbody = document.getElementById("todayDetailsBody");
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#9CA3AF;">لا توجد بيانات</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(v => {
    const employee = v[9] || "غير محدد";
    const parking = v[17] || "—";
    const service = v[6] || "—";
    const price = Number(v[7] || 0);
    const cash = Number(v[20] || 0);
    const card = Number(v[21] || 0);
    const totalPaid = Number(v[22] || price);
    const discount = Math.max(0, price - totalPaid);

    return `
<tr>
  <td>${employee}</td>
  <td>${parking}</td>
  <td>${service}</td>
  <td>${price}</td>
  <td>${cash}</td>
  <td>${card}</td>
  <td>${totalPaid}</td>
  <td>${discount}</td>
</tr>
`;
  }).join("");
}

/* ============================
   تصدير تفاصيل اليوم إلى CSV
============================ */

function exportTodayDetailsToExcel() {
  if (!TODAY_PAID_ROWS.length) {
    alert("لا توجد بيانات لتصديرها.");
    return;
  }

  const header = [
    "الموظف",
    "الموقف",
    "الخدمة",
    "السعر",
    "كاش",
    "شبكة",
    "الإجمالي",
    "الخصم"
  ];

  const lines = TODAY_PAID_ROWS.map(v => {
    const employee = v[9] || "غير محدد";
    const parking = v[17] || "—";
    const service = v[6] || "—";
    const price = Number(v[7] || 0);
    const cash = Number(v[20] || 0);
    const card = Number(v[21] || 0);
    const totalPaid = Number(v[22] || price);
    const discount = Math.max(0, price - totalPaid);

    return [
      employee,
      parking,
      service,
      price,
      cash,
      card,
      totalPaid,
      discount
    ].join(",");
  });

  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "today-details.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
/* ============================
   بيانات العملاء (تعتمد على carKey)
============================ */

function getCarKeyFromRow(row) {
  const num = row[1] || "";
  const letters = row[2] || "NULL";
  return `${num}-${letters}`;
}

async function loadCustomers() {
  const q = document.getElementById("customerSearch").value.trim().toLowerCase();
  const tbody = document.getElementById("customersTable");

  tbody.innerHTML =
    '<tr><td colspan="6" style="text-align:center;color:#9CA3AF;">جاري التحميل...</td></tr>';

  // قراءة البيانات
  const customersRes = await apiGetAll("Customers");
  const carsRes = await apiGetAll("Cars");
  const visitsRes = await apiGetAll("Visits");

  if (!customersRes.success) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:#9CA3AF;">خطأ في قراءة البيانات</td></tr>';
    return;
  }

  const customers = customersRes.rows || [];

  /* ============================
     ربط السيارات بالعميل عبر carKey
  ============================ */

  const carsByKey = {};

  if (carsRes.success) {
    (carsRes.rows || []).forEach(c => {
      const num = c[5] || "";        // plate_numbers
      const letters = c[4] || "NULL"; // plate_letters
      const carKey = `${num}-${letters}`;

      if (!carsByKey[carKey]) carsByKey[carKey] = [];
      carsByKey[carKey].push(c);
    });
  }

  /* ============================
     ربط الزيارات بالعميل عبر carKey
  ============================ */

  const visitsByKey = {};

  if (visitsRes.success) {
    (visitsRes.rows || []).forEach(v => {
      const carKey = getCarKeyFromRow(v);
      if (!visitsByKey[carKey]) visitsByKey[carKey] = [];
      visitsByKey[carKey].push(v);
    });
  }

  /* ============================
     فلترة العملاء
  ============================ */

  const filtered = customers.filter(c => {
    const name = String(c[0] || "").toLowerCase();  // NAME
    const phone = String(c[1] || "").toLowerCase(); // PHONE
    const car = String(c[2] || "").toLowerCase();   // CAR (اختياري)

    if (!q) return true;

    return (
      name.includes(q) ||
      phone.includes(q) ||
      car.includes(q)
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:#9CA3AF;">لا توجد نتائج</td></tr>';
    return;
  }

  /* ============================
     بناء جدول العملاء
  ============================ */

  tbody.innerHTML = filtered
    .map(c => {
      const phone = c[1];
      const car = c[2] || "—";

      // إيجاد carKey من جدول Cars
      let carKey = null;

      if (carsRes.success) {
        const match = (carsRes.rows || []).find(r => r[1] === phone);
        if (match) {
          const num = match[5] || "";
          const letters = match[4] || "NULL";
          carKey = `${num}-${letters}`;
        }
      }

      const cars = carKey && carsByKey[carKey] ? carsByKey[carKey] : [];
      const visits = carKey && visitsByKey[carKey] ? visitsByKey[carKey] : [];

      const servicesCount = visits.length;
      const paidAmount = visits.reduce((sum, v) => sum + Number(v[22] || 0), 0);

      return `
<tr>
  <td>${c[0]}</td>
  <td>${car}</td>
  <td>${cars.length}</td>
  <td>${visits.length}</td>
  <td>${servicesCount}</td>
  <td>${paidAmount} ريال</td>
</tr>
`;
    })
    .join("");
}
/* ============================
   السيارات غير المدفوعة (تعتمد على carKey)
============================ */

function buildCarKey(num, letters) {
  return `${num || ""}-${letters || "NULL"}`;
}

async function loadActiveVisits() {
  const box = document.getElementById("activeVisitsList");
  box.innerHTML = "جاري التحميل...";

  const res = await apiGetActiveVisits();

  if (!res.success || !res.visits || res.visits.length === 0) {
    box.innerHTML = "لا توجد سيارات غير مدفوعة حالياً.";
    return;
  }

  /* ============================
     قراءة بيانات السيارات
  ============================= */

  const carsRes = await apiGetAll("Cars");
  const carMap = {};

  if (carsRes.success) {
    (carsRes.rows || []).forEach(r => {
      const num = r[5] || "";        // plate_numbers
      const letters = r[4] || "NULL"; // plate_letters
      const carKey = buildCarKey(num, letters);

      carMap[carKey] = {
        car: r[2] || "",
        size: r[3] || "",
        letters,
        numbers: num
      };
    });
  }

  /* ============================
     بناء قائمة السيارات داخل المغسلة
  ============================= */

  box.innerHTML = res.visits
    .map(v => {
      const row = v.row;
      const d = v.data;

      const num = d[1] || "";
      const letters = d[2] || "NULL";
      const carKey = buildCarKey(num, letters);

      let plate = `${num} ${letters}`;
      let carName = carMap[carKey]?.car || "غير معروف";

      const service = d[6] || "—";
      const price = Number(d[7] || 0);
      const parking = d[17] || "—";
      const checkIn = d[13] || "";

      return `
<div style="border:1px solid #E5E7EB;border-radius:10px;padding:6px 8px;margin-bottom:6px;font-size:13px;">
  <b>🚗 اللوحة:</b> ${plate} — ${carName}<br>
  <b>الخدمة:</b> ${service}<br>
  <b>السعر:</b> ${price} ريال<br>
  <b>الموقف:</b> ${parking}<br>
  <b>الدخول:</b> ${checkIn}<br>

  <label style="font-size:12px;">طريقة الدفع</label>
  <select id="pay_${row}" style="margin-top:2px;">
    <option value="كاش">كاش</option>
    <option value="شبكة">شبكة</option>
  </select>

  <button class="btn" style="margin-top:4px;font-size:11px;padding:4px 8px;"
    onclick="markPaid(${row})">
    تحديث حالة الدفع
  </button>
</div>
`;
    })
    .join("");
}

/* ============================
   تحديث حالة الدفع
============================ */

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
   زيارات اليوم (تعتمد على carKey)
============================ */

async function loadTodayVisits() {
  const res = await apiGetAll("Visits");

  if (!res.success) {
    document.getElementById("todayVisitsList").innerHTML =
      "<div style='color:#D32F2F;'>خطأ في تحميل البيانات</div>";
    return;
  }

  const rows = res.rows || [];
  const todayStr = toDayString(new Date());

  const todayVisits = rows.filter(v => {
    const checkInDay = toDayString(v[13]);
    return checkInDay === todayStr;
  });

  const box = document.getElementById("todayVisitsList");

  if (!todayVisits.length) {
    box.innerHTML = `<div style="color:#9CA3AF;text-align:center;">لا توجد زيارات اليوم</div>`;
    return;
  }

  box.innerHTML = todayVisits
    .map(v => {
      const plate = `${v[1] || ""} ${v[2] || ""}`;
      const service = v[6] || "—";
      const price = v[7] || 0;
      const employee = v[9] || "—";
      const payStatus = v[15] || "غير مدفوع";

      return `
<div style="
  padding:10px;
  border-bottom:1px solid #E5E7EB;
  margin-bottom:8px;
">
  <div><strong>🚗 السيارة:</strong> ${plate}</div>
  <div><strong>الخدمة:</strong> ${service}</div>
  <div><strong>السعر:</strong> ${price} ريال</div>
  <div><strong>الموظف:</strong> ${employee}</div>
  <div><strong>حالة الدفع:</strong>
    <span class="tag">${payStatus}</span>
  </div>
</div>
`;
    })
    .join("");
}

/* ============================
   الفواتير (تعتمد على carKey)
============================ */

let INVOICE_STATE = {
  carKey: null,
  visits: []
};

async function searchInvoices() {
  const q = document.getElementById("invoiceSearch").value.trim();
  const box = document.getElementById("invoiceVisits");

  box.innerHTML = "جاري البحث...";

  if (!q) {
    box.innerHTML = "اكتب رقم اللوحة أو جزء منها.";
    return;
  }

  const visitsRes = await apiGetAll("Visits");

  if (!visitsRes.success) {
    box.innerHTML = "خطأ في قراءة البيانات.";
    return;
  }

  const rows = visitsRes.rows || [];

  // البحث باللوحة
  const matched = rows.filter(v => {
    const plate = `${v[1] || ""} ${v[2] || ""}`.toLowerCase();
    return plate.includes(q.toLowerCase());
  });

  if (!matched.length) {
    box.innerHTML = "لا توجد زيارات لهذه اللوحة.";
    return;
  }

  INVOICE_STATE.carKey = `${matched[0][1]}-${matched[0][2]}`;
  INVOICE_STATE.visits = matched;

  box.innerHTML = matched
    .map((v, idx) => {
      const service = v[6];
      const price = Number(v[7] || 0);
      const points = Number(v[8] || 0);
      const date = String(v[13] || "").split(" ")[0];

      return `
<div style="border-bottom:1px solid #E5E7EB;padding:4px 0;font-size:13px;">
  #${idx + 1} — ${service} — ${price} ريال — نقاط: ${points} — ${date}
</div>
`;
    })
    .join("");
}

function sendInvoice(mode) {
  if (!INVOICE_STATE.visits.length) {
    alert("ابحث عن السيارة أولاً.");
    return;
  }

  let selectedVisits = [];

  if (mode === "last") {
    selectedVisits = [INVOICE_STATE.visits[INVOICE_STATE.visits.length - 1]];
  } else {
    selectedVisits = INVOICE_STATE.visits;
  }

  let total = 0;

  const lines = selectedVisits
    .map((v, idx) => {
      const service = v[6];
      const price = Number(v[7] || 0);
      const points = Number(v[8] || 0);
      const date = String(v[13] || "").split(" ")[0];

      total += Number(v[22] || price || 0);

      return `${idx + 1}- ${service} — ${price} ريال (نقاط: ${points}) — ${date}`;
    })
    .join("\n");

  const msg =
    `فاتورة زيارات مغسلة رغوة الهجين\n` +
    `السيارة: ${INVOICE_STATE.carKey}\n\n` +
    `الزيارات:\n${lines}\n\n` +
    `الإجمالي: ${total} ريال`;

  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

/* ============================
   التشغيل الأولي
============================ */

document.addEventListener("DOMContentLoaded", () => {
  loadTodaySummary();
  loadCustomers();
  loadActiveVisits();
  loadBookings();
  loadTodayVisits();
});

