const el = id => document.getElementById(id);
const getDateOnly = v => String(v || "").split("T")[0].split(" ")[0];

let allVisits = [];
let filteredVisits = [];

document.addEventListener("DOMContentLoaded", () => {
  loadAllVisits();
  bindTabs();
  bindGlobalFilter();
  bindCompletedFilter();
  bindExport();
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
   Employees Summary
=========================== */
function renderEmployeesSummary(list) {
  const box = el("tab-employees");
  const emp = {};
  let total = 0;

  list.forEach(v => {
    const e = v[9] || "غير محدد";
    const price = Number(v[22] || v[7] || 0);
    if (!emp[e]) emp[e] = { cars: 0, total: 0 };
    emp[e].cars++;
    emp[e].total += price;
    total += price;
  });

  let html = `
    <table>
      <tr><th>الموظف</th><th>السيارات</th><th>الإجمالي</th></tr>
  `;

  Object.keys(emp).forEach(e => {
    html += `<tr><td>${e}</td><td>${emp[e].cars}</td><td>${emp[e].total}</td></tr>`;
  });

  html += `</table><div class="table-total"><b>الإجمالي: ${total} ريال</b></div>`;
  box.innerHTML = html;
}

/* ===========================
   Services Summary
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
    <table>
      <tr><th>الخدمة</th><th>العدد</th><th>الكاش</th><th>الشبكة</th><th>الإجمالي</th></tr>
  `;

  Object.keys(svc).forEach(s => {
    const r = svc[s];
    html += `<tr><td>${s}</td><td>${r.count}</td><td>${r.cash}</td><td>${r.card}</td><td>${r.total}</td></tr>`;
  });

  html += `</table><div class="table-total"><b>الإجمالي: ${total} ريال</b></div>`;
  box.innerHTML = html;
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
        <th>اللوحة</th><th>الخدمة</th><th>السعر</th>
        <th>الموظف</th><th>الدفع</th><th>الدخول</th><th>الخروج</th>
      </tr>
  `;

  paid.forEach(v => {
    const price = Number(v[22] || v[7] || 0);
    total += price;

    html += `
      <tr>
        <td>${v[1]} ${v[2]}</td>
        <td>${v[6]}</td>
        <td>${price}</td>
        <td>${v[9]}</td>
        <td>${v[16]}</td>
        <td>${v[13]}</td>
        <td>${v[14]}</td>
      </tr>
    `;
  });

  html += `</table>`;
  box.innerHTML = html;
  totalBox.innerHTML = `<b>الإجمالي: ${total} ريال</b>`;
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
  el("filterToday").onclick = () => {
    const t = new Date().toISOString().split("T")[0];
    renderCompletedVisits(filteredVisits.filter(v => (v[13] || "").startsWith(t)));
  };

  el("filterWeek").onclick = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    const start = new Date(now);
    start.setDate(now.getDate() + diff);
    renderCompletedVisits(filteredVisits.filter(v => {
      const d = new Date(v[13]);
      return d >= start && d <= now;
    }));
  };

  el("filterMonth").onclick = () => {
    const now = new Date();
    renderCompletedVisits(filteredVisits.filter(v => {
      const d = new Date(v[13]);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }));
  };

  el("filterYear").onclick = () => {
    const y = new Date().getFullYear();
    renderCompletedVisits(filteredVisits.filter(v => new Date(v[13]).getFullYear() === y));
  };

  el("filterCustom").onclick = () => {
    const f = el("filterFrom").value;
    const t = el("filterTo").value;
    if (!f || !t) return alert("اختر التاريخين");
    renderCompletedVisits(filteredVisits.filter(v => {
      const d = getDateOnly(v[13]);
      return d >= f && d <= t;
    }));
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
