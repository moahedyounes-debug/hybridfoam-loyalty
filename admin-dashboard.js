/* ===========================
   Helpers
=========================== */
const el = id => document.getElementById(id);

function getDateOnly(value) {
  if (!value) return "";
  // يدعم "YYYY-MM-DD" أو "YYYY-MM-DD HH:MM"
  return String(value).split("T")[0].split(" ")[0];
}

/* ===========================
   Tabs switching
=========================== */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    el("tab-" + btn.dataset.tab).classList.add("active");
  });
});

/* ===========================
   Top Summary
=========================== */
async function loadTopSummary() {
  try {
    const res = await apiGetAll("Visits");
    if (!res || !res.rows) return;

    let cash = 0, card = 0, total = 0, services = 0;

    res.rows.forEach(v => {
      const price = Number(v[22] || v[7] || 0);
      const method = String(v[16] || "").trim();

      total += price;
      services++;

      if (method === "كاش") cash += price;
      if (method === "شبكة") card += price;
    });

    el("sumCash").innerText = cash + " ريال";
    el("sumCard").innerText = card + " ريال";
    el("sumTotal").innerText = total + " ريال";
    el("sumServices").innerText = services;

  } catch (err) {
    console.error("Error loading top summary:", err);
  }
}

/* ===========================
   Employees Summary + Total
=========================== */
async function loadEmployeesSummary() {
  const box = el("tab-employees");
  box.innerHTML = "جارِ التحميل...";

  try {
    const res = await apiGetAll("Visits");
    if (!res || !res.rows || !res.rows.length) {
      box.innerHTML = "<p>لا توجد بيانات.</p>";
      return;
    }

    const perEmp = {};
    let grandTotal = 0;

    res.rows.forEach(v => {
      const emp = v[9] || "غير محدد";
      const price = Number(v[22] || v[7] || 0);

      if (!perEmp[emp]) perEmp[emp] = { cars: 0, total: 0 };
      perEmp[emp].cars++;
      perEmp[emp].total += price;
      grandTotal += price;
    });

    let html = `
      <table>
        <tr>
          <th>الموظف</th>
          <th>عدد السيارات</th>
          <th>إجمالي المبلغ</th>
        </tr>
    `;

    Object.keys(perEmp).forEach(emp => {
      html += `
        <tr>
          <td>${emp}</td>
          <td>${perEmp[emp].cars}</td>
          <td>${perEmp[emp].total} ريال</td>
        </tr>
      `;
    });

    html += `</table>`;
    html += `<div class="table-total"><b>الإجمالي الكلي: ${grandTotal} ريال</b></div>`;
    box.innerHTML = html;

  } catch (err) {
    console.error("Error loading employees summary:", err);
    box.innerHTML = "<p>خطأ في تحميل البيانات.</p>";
  }
}

/* ===========================
   Services Summary + Total
=========================== */
async function loadServicesSummary() {
  const box = el("tab-services");
  box.innerHTML = "جارِ التحميل...";

  try {
    const res = await apiGetAll("Visits");
    if (!res || !res.rows || !res.rows.length) {
      box.innerHTML = "<p>لا توجد بيانات.</p>";
      return;
    }

    const perService = {};
    let grandTotal = 0;

    res.rows.forEach(v => {
      const service = v[6] || "غير محدد";
      const price = Number(v[22] || v[7] || 0);
      const method = v[16] || "";

      if (!perService[service]) perService[service] = { count: 0, cash: 0, card: 0, total: 0 };

      perService[service].count++;
      perService[service].total += price;
      grandTotal += price;

      if (method === "كاش") perService[service].cash += price;
      if (method === "شبكة") perService[service].card += price;
    });

    let html = `
      <table>
        <tr>
          <th>الخدمة</th>
          <th>العدد</th>
          <th>الكاش</th>
          <th>الشبكة</th>
          <th>الإجمالي</th>
        </tr>
    `;

    Object.keys(perService).forEach(s => {
      const row = perService[s];
      html += `
        <tr>
          <td>${s}</td>
          <td>${row.count}</td>
          <td>${row.cash}</td>
          <td>${row.card}</td>
          <td>${row.total}</td>
        </tr>
      `;
    });

    html += `</table>`;
    html += `<div class="table-total"><b>الإجمالي الكلي: ${grandTotal} ريال</b></div>`;
    box.innerHTML = html;

  } catch (err) {
    console.error("Error loading services summary:", err);
    box.innerHTML = "<p>خطأ في تحميل البيانات.</p>";
  }
}

/* ===========================
   Completed Visits + Filters + Total + Excel
=========================== */
let completedVisitsCache = [];

async function loadCompletedVisits() {
  const box = document.getElementById("completedContent");
  box.innerHTML = "جارِ التحميل...";

  try {
    const res = await apiGetAll("Visits");
    if (!res || !res.rows || !res.rows.length) {
      box.innerHTML = "<p>لا توجد زيارات.</p>";
      el("completedTotal").innerHTML = "";
      return;
    }

    completedVisitsCache = res.rows.filter(v => String(v[15] || "").trim() === "مدفوع");
    renderCompletedVisits(completedVisitsCache);

  } catch (err) {
    console.error("Error loading completed visits:", err);
    box.innerHTML = "<p>خطأ في تحميل البيانات.</p>";
    el("completedTotal").innerHTML = "";
  }
}

function renderCompletedVisits(list) {
  const box = document.getElementById("completedContent");
  const totalBox = document.getElementById("completedTotal");

  if (!list.length) {
    box.innerHTML = "<p>لا توجد نتائج.</p>";
    totalBox.innerHTML = "";
    return;
  }

  let total = 0;

  let html = `
    <table>
      <tr>
        <th>اللوحة</th>
        <th>الخدمة</th>
        <th>السعر</th>
        <th>الموظف</th>
        <th>طريقة الدفع</th>
        <th>الدخول</th>
        <th>الخروج</th>
      </tr>
  `;

  list.forEach(v => {
    const price = Number(v[22] || v[7] || 0);
    total += price;

    html += `
      <tr>
        <td>${v[1]} ${v[2]}</td>
        <td>${v[6]}</td>
        <td>${price}</td>
        <td>${v[9] || "غير محدد"}</td>
        <td>${v[16] || "—"}</td>
        <td>${v[13] || "—"}</td>
        <td>${v[14] || "—"}</td>
      </tr>
    `;
  });

  html += `</table>`;
  box.innerHTML = html;
  totalBox.innerHTML = `<b>الإجمالي: ${total} ريال</b>`;
}

/* ===== فلاتر التاريخ للزيارات المكتملة ===== */
function bindCompletedFilters() {
  const btnToday = el("filterToday");
  const btnWeek = el("filterWeek");
  const btnMonth = el("filterMonth");
  const btnYear = el("filterYear");
  const btnCustom = el("filterCustom");
  const inputFrom = el("filterFrom");
  const inputTo = el("filterTo");
  const btnExport = el("exportExcel");

  if (!btnToday) return; // لو التاب مو موجود لسبب ما

  // اليوم
  btnToday.onclick = () => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const filtered = completedVisitsCache.filter(v => getDateOnly(v[13]) === todayStr);
    renderCompletedVisits(filtered);
  };

  // هذا الأسبوع (من الاثنين إلى اليوم)
  btnWeek.onclick = () => {
    const now = new Date();
    const day = now.getDay(); // 0 أحد - 6 سبت
    const diffToMonday = (day === 0 ? -6 : 1 - day); // نخلي الاثنين بداية
    const start = new Date(now);
    start.setDate(now.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const filtered = completedVisitsCache.filter(v => {
      const d = new Date(v[13]);
      return d >= start && d <= end;
    });

    renderCompletedVisits(filtered);
  };

  // هذا الشهر
  btnMonth.onclick = () => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const filtered = completedVisitsCache.filter(v => {
      const d = new Date(v[13]);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    renderCompletedVisits(filtered);
  };

  // هذه السنة
  btnYear.onclick = () => {
    const year = new Date().getFullYear();

    const filtered = completedVisitsCache.filter(v => {
      const d = new Date(v[13]);
      return d.getFullYear() === year;
    });

    renderCompletedVisits(filtered);
  };

  // مخصص
  btnCustom.onclick = () => {
    const from = inputFrom.value;
    const to = inputTo.value;

    if (!from || !to) {
      alert("اختر التاريخين أولاً");
      return;
    }

    const filtered = completedVisitsCache.filter(v => {
      const d = getDateOnly(v[13]);
      return d >= from && d <= to;
    });

    renderCompletedVisits(filtered);
  };

  // تصدير Excel (كل البيانات المدفوعة، مو المفلترة فقط)
btnExport.onclick = () => {
  const rows = document.querySelectorAll("#completedContent table tr");
  if (rows.length <= 1) {
    alert("لا توجد بيانات للتصدير");
    return;
  }

  // UTF-8 with BOM
  let csv = "\ufeff";

  rows.forEach((row, i) => {
    const cols = row.querySelectorAll("td, th");
    const line = [...cols].map(c => `"${c.innerText}"`).join(",");
    csv += line + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "filtered_visits.csv";
  a.click();
};

    let csv = "\ufeffاللوحة,الخدمة,السعر,الموظف,الدفع,الدخول,الخروج\n";

    completedVisitsCache.forEach(v => {
      const plate = `${v[1]} ${v[2]}`;
      const service = v[6] || "";
      const price = Number(v[22] || v[7] || 0);
      const emp = v[9] || "";
      const pay = v[16] || "";
      const inTime = v[13] || "";
      const outTime = v[14] || "";

      csv += `${plate},${service},${price},${emp},${pay},${inTime},${outTime}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "completed_visits.csv";
    a.click();
  };
}

/* ===========================
   Bookings
=========================== */
async function loadBookings() {
  const box = el("tab-bookings");
  box.innerHTML = "جارِ التحميل...";

  try {
    const res = await apiGetAll("Bookings");
    if (!res || !res.rows || !res.rows.length) {
      box.innerHTML = "<p>لا توجد حجوزات.</p>";
      return;
    }

    let html = `
      <table>
        <tr>
          <th>الخدمة</th>
          <th>التاريخ</th>
          <th>الجوال</th>
          <th>العضوية</th>
          <th>الحالة</th>
        </tr>
    `;

    res.rows.forEach(b => {
      html += `
        <tr>
          <td>${b[2]}</td>
          <td>${b[3]} ${b[4]}</td>
          <td>${b[0]}</td>
          <td>${b[1] || "—"}</td>
          <td>${b[5]}</td>
        </tr>
      `;
    });

    html += `</table>`;
    box.innerHTML = html;

  } catch (err) {
    console.error("Error loading bookings:", err);
    box.innerHTML = "<p>خطأ في تحميل البيانات.</p>";
  }
}

/* ===========================
   Notifications
=========================== */
async function loadNotifications() {
  el("tab-notifications").innerHTML = `
    <p>عرض الإشعارات من لوحة المشرف غير مفعّل حالياً.</p>
  `;
}

/* ===========================
   Invoices Summary
=========================== */
async function loadInvoices() {
  const box = el("tab-invoices");
  box.innerHTML = "جارِ التحميل...";

  try {
    const res = await apiGetAll("Visits");
    if (!res || !res.rows || !res.rows.length) {
      box.innerHTML = "<p>لا توجد بيانات.</p>";
      return;
    }

    const perMember = {};
    let grandTotal = 0;

    res.rows.forEach(v => {
      const mem = v[0] || "بدون عضوية";
      const price = Number(v[22] || v[7] || 0);

      if (!perMember[mem]) perMember[mem] = { visits: 0, total: 0 };
      perMember[mem].visits++;
      perMember[mem].total += price;
      grandTotal += price;
    });

    let html = `
      <table>
        <tr>
          <th>العضوية</th>
          <th>عدد الزيارات</th>
          <th>إجمالي المبلغ</th>
        </tr>
    `;

    Object.keys(perMember).forEach(mem => {
      html += `
        <tr>
          <td>${mem}</td>
          <td>${perMember[mem].visits}</td>
          <td>${perMember[mem].total} ريال</td>
        </tr>
      `;
    });

    html += `</table>`;
    html += `<div class="table-total"><b>الإجمالي الكلي: ${grandTotal} ريال</b></div>`;
    box.innerHTML = html;

  } catch (err) {
    console.error("Error loading invoices summary:", err);
    box.innerHTML = "<p>خطأ في تحميل البيانات.</p>";
  }
}

/* ===========================
   Details Modal
=========================== */
function openDetails(v) {
  el("detailsBody").innerHTML = `
    <p><b>اللوحة:</b> ${v.plate}</p>
    <p><b>الخدمة:</b> ${v.service}</p>
    <p><b>السعر:</b> ${v.price} ريال</p>
    <p><b>الموظف:</b> ${v.employee}</p>
    <p><b>طريقة الدفع:</b> ${v.payment}</p>
    <p><b>وقت الدخول:</b> ${v.check_in || "—"}</p>
    <p><b>وقت الخروج:</b> ${v.check_out || "—"}</p>
  `;
  el("detailsModal").style.display = "flex";
}

el("closeModal").onclick = () => {
  el("detailsModal").style.display = "none";
};

el("downloadCSV").onclick = () => alert("تحميل CSV غير مفعّل حالياً.");
el("downloadPDF").onclick = () => alert("تحميل PDF غير مفعّل حالياً.");

/* ===========================
   Init
=========================== */
document.addEventListener("DOMContentLoaded", () => {
  loadTopSummary();
  loadEmployeesSummary();
  loadCompletedVisits();
  loadServicesSummary();
  loadBookings();
  loadNotifications();
  loadInvoices();
  bindCompletedFilters();
});
