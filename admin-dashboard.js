const el = id => document.getElementById(id);
const getDateOnly = v => String(v || "").split("T")[0].split(" ")[0];

let allVisits = [];
let filteredVisits = [];
let commissions = {};

document.addEventListener("DOMContentLoaded", () => {
  loadAllVisits();
  bindTabs();
  bindGlobalFilter();
  bindCompletedFilter();
  bindExport();
  loadCommissions();
});

/* ===========================
   Load All Visits Once
=========================== */
async function loadAllVisits() {
  const res = await apiGetAll("Visits");
  if (!res.success) return;
  allVisits = res.rows;
  filteredVisits = [...allVisits];
  renderAll();
}

/* ===========================
   Render Everything
=========================== */
function renderAll() {
  renderTopSummary(filteredVisits);
  renderEmployeesSummary(filteredVisits);
  renderServicesSummary(filteredVisits);
  renderCompletedVisits(filteredVisits);
  renderInvoicesSummary(filteredVisits);
}

/* ===========================
   Tabs
=========================== */
function bindTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      el("tab-" + btn.dataset.tab).classList.add("active");
    };
  });
}

/* ===========================
   Global Filter
=========================== */
function bindGlobalFilter() {
  el("gToday").onclick = () => applyGlobalFilter("today");
  el("gWeek").onclick = () => applyGlobalFilter("week");
  el("gMonth").onclick = () => applyGlobalFilter("month");
  el("gYear").onclick = () => applyGlobalFilter("year");
  el("gCustom").onclick = () => applyGlobalFilter("custom");
}

function applyGlobalFilter(type) {
  const now = new Date();

  if (type === "today") {
    const t = now.toISOString().split("T")[0];
    filteredVisits = allVisits.filter(v => (v[13] || "").startsWith(t));
  }

  else if (type === "week") {
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    const start = new Date(now);
    start.setDate(now.getDate() + diff);
    filteredVisits = allVisits.filter(v => {
      const d = new Date(v[13]);
      return d >= start && d <= now;
    });
  }

  else if (type === "month") {
    const m = now.getMonth();
    const y = now.getFullYear();
    filteredVisits = allVisits.filter(v => {
      const d = new Date(v[13]);
      return d.getMonth() === m && d.getFullYear() === y;
    });
  }

  else if (type === "year") {
    const y = now.getFullYear();
    filteredVisits = allVisits.filter(v => new Date(v[13]).getFullYear() === y);
  }

  else if (type === "custom") {
    const f = el("gFrom").value;
    const t = el("gTo").value;
    if (!f || !t) return alert("اختر التاريخين");
    filteredVisits = allVisits.filter(v => {
      const d = getDateOnly(v[13]);
      return d >= f && d <= t;
    });
  }

  renderAll();
}

/* ===========================
   Top Summary
=========================== */
function renderTopSummary(list) {
  let cash = 0, card = 0, total = 0;

  list.forEach(v => {
    const price = Number(v[22] || v[7] || 0);
    const method = v[16];
    total += price;
    if (method === "كاش") cash += price;
    if (method === "شبكة") card += price;
  });

  el("sumCash").innerText = cash + " ريال";
  el("sumCard").innerText = card + " ريال";
  el("sumTotal").innerText = total + " ريال";
  el("sumServices").innerText = list.length;
}

/* ===========================
   Commisiion Summary
=========================== */
async function loadCommissions() {
    const res = await apiGetServices(); // هذا يرجع نفس شيت الكوميشن
    if (!res.success) return;

    res.rows.forEach(r => {
        const service = r[0];
        const commission = Number(r[1] || 0);
        commissions[service] = commission;
    });
}

/* ===========================
   Employees Summary
=========================== */
function renderEmployeesSummary(list) {
    const box = el("tab-employees");

    const emp = {};

    let totalAfterDiscount = 0;
    let totalDiscount = 0;
    let totalTips = 0;
    let totalCommission = 0;

    list.forEach(v => {
        const employee = v[9] || "غير محدد";

        const price = Number(v[22] || v[7] || 0);   // total_paid
        const tip = Number(v[25] || 0);        // discount
        cconst discount = Number(v[26] || 0);             // tip
        const service = v[6] || "";

        // جلب العمولة من شيت الكوميشن
        const commission = commissions[service] || 0;

        if (!emp[employee]) emp[employee] = { cars: 0, total: 0, commission: 0 };

        emp[employee].cars++;
        emp[employee].total += price;
        emp[employee].commission += commission;

        totalAfterDiscount += price;
        totalDiscount += discount;
        totalTips += tip;
        totalCommission += commission;
    });

    // ترتيب الموظفين حسب الإجمالي
    const sorted = Object.entries(emp).sort((a, b) => b[1].total - a[1].total);

    let html = `
        <div class="top-summary">
            <div class="summary-box">
                <span class="material-icons">money_off</span>
                <p>إجمالي الخصومات</p>
                <h3>${totalDiscount} ريال</h3>
            </div>

            <div class="summary-box">
                <span class="material-icons">card_giftcard</span>
                <p>إجمالي الإكراميات</p>
                <h3>${totalTips} ريال</h3>
            </div>

            <div class="summary-box">
                <span class="material-icons">account_balance_wallet</span>
                <p>إجمالي المبلغ (بعد الخصم)</p>
                <h3>${totalAfterDiscount} ريال</h3>
            </div>
        </div>

        <table>
            <tr>
                <th>الموظف</th>
                <th>الخدمات</th>
                <th>الإجمالي</th>
                <th>العمولات</th>
            </tr>
    `;

    sorted.forEach(([name, data]) => {
        html += `
            <tr>
                <td>${name}</td>
                <td>${data.cars}</td>
                <td>${data.total}</td>
                <td>${data.commission}</td>
            </tr>
        `;
    });

    html += `
        </table>

        <div class="table-total">
            <b>الإجمالي: ${totalAfterDiscount} ريال</b><br>
            <b>العمولات: ${totalCommission} ريال</b>
        </div>
    `;

    box.innerHTML = html;
}
/* ===========================
   Services Summary + PDF Export
=========================== */
function renderServicesSummary(list) {
  const box = el("tab-services");
  const svc = {};
  let total = 0;

  list.forEach(v => {
    const s = v[6] || "غير محدد";
    const price = Number(v[22] || v[7] || 0);
    const method = v[16];

    if (!svc[s]) svc[s] = { count: 0, cash: 0, card: 0, total: 0 };

    svc[s].count++;
    svc[s].total += price;
    total += price;

    if (method === "كاش") svc[s].cash += price;
    if (method === "شبكة") svc[s].card += price;
  });

  let html = `
    <button class="btn-export" id="exportServicesPDF" style="margin-bottom: 15px;">
      تصدير PDF
    </button>

    <table id="servicesTable">
      <tr>
        <th>الخدمة</th>
        <th>العدد</th>
        <th>الكاش</th>
        <th>الشبكة</th>
        <th>الإجمالي</th>
      </tr>
  `;

  Object.keys(svc).forEach(s => {
    const r = svc[s];
    html += `
      <tr>
        <td>${s}</td>
        <td>${r.count}</td>
        <td>${r.cash}</td>
        <td>${r.card}</td>
        <td>${r.total}</td>
      </tr>
    `;
  });

  html += `
    </table>
    <div class="table-total"><b>الإجمالي: ${total} ريال</b></div>
  `;

  box.innerHTML = html;

  // زر التصدير
  el("exportServicesPDF").onclick = exportServicesPDF;
}

/* ===========================
   Export Services PDF
=========================== */
function exportServicesPDF() {
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4"
  });

  const table = document.getElementById("servicesTable");

  if (!table) {
    alert("لا توجد بيانات للتصدير");
    return;
  }

  doc.html(table, {
    callback: function (doc) {
      doc.save("services-summary.pdf");
    },
    x: 20,
    y: 20
  });
}
/* ===========================
   Completed Visits
=========================== */
function renderCompletedVisits(list) {
    const box = el("completedContent");
    const totalBox = el("completedTotal");

    const paid = list.filter(v => v[15] === "مدفوع");

    if (!paid.length) {
        box.innerHTML = "لا توجد نتائج";
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
                <th>الخصم</th>
                <th>الصافي</th>
                <th>الدفع</th>
                <th>الموظف</th>
                <th>الدخول</th>
                <th>الخروج</th>
            </tr>
    `;

    paid.forEach(v => {
        const price = Number(v[7] || 0);      // السعر الأصلي
        const discount = Number(v[26] || 0);  // الخصم
        const net = price - discount;         // الصافي
        const method = v[16];                 // الدفع
        const employee = v[9];                // الموظف

        total += net;

        html += `
            <tr>
                <td>${v[1]} ${v[2]}</td>
                <td>${v[6]}</td>
                <td>${price}</td>
                <td>${discount}</td>
                <td>${net}</td>
                <td>${method}</td>
                <td>${employee}</td>
                <td>${v[13]}</td>
                <td>${v[14]}</td>
            </tr>
        `;
    });

    html += `</table>`;

    box.innerHTML = html;

    totalBox.innerHTML = `<b>الإجمالي الصافي: ${total} ريال</b>`;
}
/* ===========================
   Invoices Summary
=========================== */
function renderInvoicesSummary(list) {
  const box = el("tab-invoices");
  const mem = {};
  let total = 0;

  list.forEach(v => {
    const m = v[0] || "بدون عضوية";
    const price = Number(v[22] || v[7] || 0);
    if (!mem[m]) mem[m] = { visits: 0, total: 0 };
    mem[m].visits++;
    mem[m].total += price;
    total += price;
  });

  let html = `
    <table>
      <tr><th>العضوية</th><th>الزيارات</th><th>الإجمالي</th></tr>
  `;

  Object.keys(mem).forEach(m => {
    html += `<tr><td>${m}</td><td>${mem[m].visits}</td><td>${mem[m].total}</td></tr>`;
  });

  html += `</table><div class="table-total"><b>الإجمالي: ${total} ريال</b></div>`;
  box.innerHTML = html;
}

/* ===========================
   Completed Tab Filter (Local)
=========================== */
function bindCompletedFilter() {

  // ====== اليوم (12 ظهر → 6 فجر) ======
  el("filterToday").onclick = () => {
    const now = new Date();

    // بداية اليوم: 12:00 PM
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

    // نهاية اليوم: 6:00 AM (اليوم التالي)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 6, 0, 0);

    renderCompletedVisits(
      filteredVisits.filter(v => {
        const d = new Date(v[13]); // وقت الدخول
        return d >= start && d <= end;
      })
    );
  };

  // ====== الأسبوع ======
  el("filterWeek").onclick = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    const start = new Date(now);
    start.setDate(now.getDate() + diff);

    renderCompletedVisits(
      filteredVisits.filter(v => {
        const d = new Date(v[13]);
        return d >= start && d <= now;
      })
    );
  };

  // ====== الشهر ======
  el("filterMonth").onclick = () => {
    const now = new Date();
    renderCompletedVisits(
      filteredVisits.filter(v => {
        const d = new Date(v[13]);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
    );
  };

  // ====== السنة ======
  el("filterYear").onclick = () => {
    const y = new Date().getFullYear();
    renderCompletedVisits(
      filteredVisits.filter(v => new Date(v[13]).getFullYear() === y)
    );
  };

  // ====== مخصص ======
  el("filterCustom").onclick = () => {
    const f = el("filterFrom").value;
    const t = el("filterTo").value;

    if (!f || !t) return alert("اختر التاريخين");

    renderCompletedVisits(
      filteredVisits.filter(v => {
        const d = getDateOnly(v[13]);
        return d >= f && d <= t;
      })
    );
  };
}

/* ===========================
   Export Filtered Table
=========================== */
function bindExport() {
  el("exportExcel").onclick = () => {
    const rows = document.querySelectorAll("#completedContent table tr");
    if (rows.length <= 1) {
      alert("لا توجد بيانات للتصدير");
      return;
    }

    let csv = "\ufeff";
    rows.forEach(row => {
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
}
