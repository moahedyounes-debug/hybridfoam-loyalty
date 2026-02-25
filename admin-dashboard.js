const el = id => document.getElementById(id);
const getDateOnly = v => String(v || "").split("T")[0].split(" ")[0];

let allVisits = [];
let filteredVisits = [];
let commissions = {};

document.addEventListener("DOMContentLoaded", () => {
  loadAllVisits();
  bindTabs();
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
   Safe Date Parser
=========================== */
function parseDateTime(str) {
    if (!str) return null;
    str = str.replace("T", " ");
    const [datePart, timePart] = str.split(" ");
    if (!datePart || !timePart) return null;

    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm, ss] = timePart.split(":").map(Number);

    return new Date(y, m - 1, d, hh, mm, ss || 0);
}

/* ===========================
   Week Range (Wed → Wed)
=========================== */
function getWeekRange() {
    const now = new Date();
    const day = now.getDay();

    const lastWed = new Date(now);
    const diff = day >= 3 ? day - 3 : (7 - (3 - day));
    lastWed.setDate(now.getDate() - diff);

    const nextWed = new Date(lastWed);
    nextWed.setDate(lastWed.getDate() + 7);

    return { start: lastWed, end: nextWed };
}

/* ===========================
   Global Filter
=========================== */
function applyGlobalFilter(type) {
    const now = new Date();

    if (type === "today") {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
        const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 6, 0, 0);

        filteredVisits = allVisits.filter(v => {
            const d = parseDateTime(v[13]);
            return d && d >= start && d <= end;
        });
    }

    else if (type === "week") {
        const { start, end } = getWeekRange();
        filteredVisits = allVisits.filter(v => {
            const d = parseDateTime(v[13]);
            return d && d >= start && d < end;
        });
    }

    else if (type === "month") {
        const m = now.getMonth();
        const y = now.getFullYear();
        filteredVisits = allVisits.filter(v => {
            const d = parseDateTime(v[13]);
            return d && d.getMonth() === m && d.getFullYear() === y;
        });
    }

    else if (type === "year") {
        const y = now.getFullYear();
        filteredVisits = allVisits.filter(v => {
            const d = parseDateTime(v[13]);
            return d && d.getFullYear() === y;
        });
    }

    else if (type === "custom") {
        const f = el("gFrom").value;
        const t = el("gTo").value;
        if (!f || !t) return alert("اختر التاريخين");

        filteredVisits = allVisits.filter(v => {
            const d = parseDateTime(v[13]);
            if (!d) return false;
            const dateOnly = d.toISOString().split("T")[0];
            return dateOnly >= f && dateOnly <= t;
        });
    }

    renderAll();
}

/* ===========================
   Top Summary
=========================== */
function renderTopSummary(list) {

    let total = 0;            // TOTAL_PAID
    let priceTotal = 0;       // price
    let cash = 0;
    let card = 0;
    let tips = 0;
    let totalCommission = 0;

    list.forEach(v => {
        const price = Number(v[7]  || 0);
        const cashAmount = Number(v[20] || 0);
        const cardAmount = Number(v[21] || 0);
        const totalPaid = Number(v[22] || 0);
        const tip = Number(v[23] || 0);
        const commission = Number(v[12] || 0);

        priceTotal += price;
        total += totalPaid;
        cash += cashAmount;
        card += cardAmount;
        tips += tip;
        totalCommission += commission;
    });

    const discount = priceTotal - total; // السعر - المدفوع
    const net = total;                   // الإجمالي بعد الخصم

    el("sumCash").innerText = cash + " ريال";
    el("sumCard").innerText = card + " ريال";
    el("sumDiscount").innerText = discount + " ريال";
    el("sumNet").innerText = net + " ريال";        // الإجمالي بعد الخصم
    el("sumTotal").innerText = priceTotal + " ريال"; // الإجمالي
    el("sumTips").innerText = tips + " ريال";
    el("sumServices").innerText = list.length;
    el("sumCommission").innerText = totalCommission + " ريال";
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
        const tip = Number(v[25] || 0);            // tip
        const discount = Number(v[26] || 0);       // discount

        // 🔥 العمولة من شيت الزيارات (العمود 12)
        const commission = Number(v[12] || 0);

        if (!emp[employee]) {
            emp[employee] = { cars: 0, total: 0, commission: 0 };
        }

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

    const table = document.querySelector("#servicesTable");

    if (!table) {
        alert("لا توجد بيانات للتصدير");
        return;
    }

    // استخراج رؤوس الأعمدة
    const headers = [];
    table.querySelectorAll("thead tr th").forEach(th => {
        headers.push(th.innerText);
    });

    // استخراج الصفوف
    const rows = [];
    table.querySelectorAll("tbody tr").forEach(tr => {
        const row = [];
        tr.querySelectorAll("td").forEach(td => {
            row.push(td.innerText);
        });
        rows.push(row);
    });

    // إنشاء الجدول داخل PDF
    doc.autoTable({
        head: [headers],
        body: rows,
        styles: { fontSize: 10, cellPadding: 5 },
        headStyles: { fillColor: [13, 71, 161] }, // نفس لون الهيدر
        margin: { top: 40 }
    });

    doc.save("services-summary.pdf");
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
        const start = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            12, 0, 0
        );

        // نهاية اليوم: 6:00 AM (اليوم التالي)
        const end = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 1,
            6, 0, 0
        );

        renderCompletedVisits(
            filteredVisits.filter(v => {
                const d = parseDateTime(v[13]); // check_in
                if (!d) return false;
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
                const d = parseDateTime(v[13]);
                return d && d >= start && d <= now;
            })
        );
    };

    // ====== الشهر ======
    el("filterMonth").onclick = () => {
        const now = new Date();
        renderCompletedVisits(
            filteredVisits.filter(v => {
                const d = parseDateTime(v[13]);
                return d &&
                    d.getMonth() === now.getMonth() &&
                    d.getFullYear() === now.getFullYear();
            })
        );
    };

    // ====== السنة ======
    el("filterYear").onclick = () => {
        const y = new Date().getFullYear();
        renderCompletedVisits(
            filteredVisits.filter(v => {
                const d = parseDateTime(v[13]);
                return d && d.getFullYear() === y;
            })
        );
    };

    // ====== مخصص ======
    el("filterCustom").onclick = () => {
        const f = el("filterFrom").value;
        const t = el("filterTo").value;

        if (!f || !t) return alert("اختر التاريخين");

        renderCompletedVisits(
            filteredVisits.filter(v => {
                const d = parseDateTime(v[13]);
                if (!d) return false;

                const dateOnly = d.toISOString().split("T")[0];
                return dateOnly >= f && dateOnly <= t;
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
