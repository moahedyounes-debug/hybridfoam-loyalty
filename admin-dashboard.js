function applyLanguage(lang) {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        el.innerText = translations[lang][key] || key;
    });

    // تغيير اتجاه الصفحة
    if (lang === "en") {
        document.body.dir = "ltr";
    } else {
        document.body.dir = "rtl";
    }
}


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

    // ربط زر اللغة
    el("langSwitcher").onchange = (e) => {
        applyLanguage(e.target.value);
    };
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

    str = str.trim();
    str = str.replace("T", " ");

    if (str.length === 10) {
        str += " 00:00:00";
    }

    const parts = str.split(" ");
    if (parts.length < 2) return null;

    const [datePart, timePart] = parts;
    const [y, m, d] = datePart.split("-").map(Number);

    let [hh, mm, ss] = timePart.split(":").map(Number);
    if (isNaN(ss)) ss = 0;

    return new Date(y, m - 1, d, hh, mm, ss);
}
/* ===========================
   Top Summary
=========================== */
function renderTopSummary(list) {
    let total = 0; // TOTAL_PAID
    let priceTotal = 0; // price
    let cash = 0;
    let card = 0;
    let tips = 0;
    let totalCommission = 0;

    list.forEach(v => {
        const price = Number(v[7] || 0);
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

    const discount = priceTotal - total;
    const net = total;

    el("sumCash").innerText = cash + " ريال";
    el("sumCard").innerText = card + " ريال";
    el("sumDiscount").innerText = discount + " ريال";
    el("sumNet").innerText = net + " ريال";
    el("sumTotal").innerText = priceTotal + " ريال";
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
        const price = Number(v[22] || v[7] || 0);
        const tip = Number(v[25] || 0);
        const discount = Number(v[26] || 0);
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

    el("exportServicesPDF").onclick = exportServicesPDF;
}

/* ===========================
   Export Services PDF
=========================== */
async function exportServicesPDF() {
    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4"
    });

    // إضافة الخط العربي
    doc.addFileToVFS("Amiri-Regular.ttf", amiriFont);
    doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
    doc.setFont("Amiri");

    const table = document.querySelector("#servicesTable");
    if (!table) {
        alert("لا توجد بيانات للتصدير");
        return;
    }

    const headers = [];
    table.querySelectorAll("tr th").forEach(th => {
        headers.push(th.innerText);
    });

    const rows = [];
    table.querySelectorAll("tr:not(:first-child)").forEach(tr => {
        const row = [];
        tr.querySelectorAll("td").forEach(td => {
            row.push(td.innerText);
        });
        rows.push(row);
    });

    doc.autoTable({
        head: [headers],
        body: rows,
        styles: {
            font: "Amiri",
            fontSize: 12,
            cellPadding: 5,
            halign: "right"
        },
        headStyles: {
            fillColor: [13, 71, 161],
            font: "Amiri",
            halign: "center"
        },
        margin: { top: 40 },
        theme: "grid"
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
        const price = Number(v[7] || 0);
        const discount = Number(v[26] || 0);
        const net = price - discount;
        const method = v[16];
        const employee = v[9];

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
        <tr>
            <th>العضوية</th>
            <th>الزيارات</th>
            <th>الإجمالي</th>
        </tr>
    `;

    Object.keys(mem).forEach(m => {
        html += `
        <tr>
            <td>${m}</td>
            <td>${mem[m].visits}</td>
            <td>${mem[m].total}</td>
        </tr>
        `;
    });

    html += `
    </table>
    <div class="table-total"><b>الإجمالي: ${total} ريال</b></div>
    `;

    box.innerHTML = html;
}
/* ===========================
   Global Filter (Updated)
=========================== */

function bindGlobalFilter() {
    el("gToday").onclick = () => applyGlobalFilter("today");
    el("gYesterday").onclick = () => applyGlobalFilter("yesterday");
    el("gWeek").onclick = () => applyGlobalFilter("week");
    el("gMonth").onclick = () => applyGlobalFilter("month");
    el("gYear").onclick = () => applyGlobalFilter("year");
    el("gCustom").onclick = () => applyGlobalFilter("custom");
}

function applyGlobalFilter(type) {
    const now = new Date();

    /* ===========================
       TODAY (1 PM → 2 AM)
    ============================ */
    if (type === "today") {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 13, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 2, 0, 0);

        filteredVisits = allVisits.filter(v => {
            const d = parseDateTime(v[13]);
            return d && d >= start && d <= end;
        });
    }

    /* ===========================
       YESTERDAY (1 PM → 2 AM)
    ============================ */
    else if (type === "yesterday") {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 13, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 2, 0, 0);

        filteredVisits = allVisits.filter(v => {
            const d = parseDateTime(v[13]);
            return d && d >= start && d <= end;
        });
    }

    /* ===========================
       WEEK (Wed 1 PM → Tue 2 AM)
    ============================ */
    else if (type === "week") {
        const day = now.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed...
        const diff = day >= 3 ? day - 3 : (7 - (3 - day));

        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 13, 0, 0);
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 2, 0, 0);

        filteredVisits = allVisits.filter(v => {
            const d = parseDateTime(v[13]);
            return d && d >= start && d <= end;
        });
    }

    /* ===========================
       MONTH (1st 1 PM → next month 2 AM)
    ============================ */
    else if (type === "month") {
        const y = now.getFullYear();
        const m = now.getMonth();

        const start = new Date(y, m, 1, 13, 0, 0);
        const end = new Date(y, m + 1, 1, 2, 0, 0);

        filteredVisits = allVisits.filter(v => {
            const d = parseDateTime(v[13]);
            return d && d >= start && d <= end;
        });
    }

    /* ===========================
       YEAR (Jan 1 1 PM → next year 2 AM)
    ============================ */
    else if (type === "year") {
        const y = now.getFullYear();

        const start = new Date(y, 0, 1, 13, 0, 0);
        const end = new Date(y + 1, 0, 1, 2, 0, 0);

        filteredVisits = allVisits.filter(v => {
            const d = parseDateTime(v[13]);
            return d && d >= start && d <= end;
        });
    }

    /* ===========================
       CUSTOM (1 PM → 2 AM)
    ============================ */
    else if (type === "custom") {
        const f = el("gFrom").value;
        const t = el("gTo").value;

        if (!f || !t) return alert("اختر التاريخين");

        const start = new Date(f + " 13:00:00");
        const end = new Date(t + " 02:00:00");
        end.setDate(end.getDate() + 1);

        filteredVisits = allVisits.filter(v => {
            const d = parseDateTime(v[13]);
            return d && d >= start && d <= end;
        });
    }

    renderAll();
}

/* ===========================
   Completed Tab Filter (Local)
=========================== */

function bindCompletedFilter() {

    // ====== اليوم (1 PM → 2 AM) ======
    el("filterToday").onclick = () => {
        const now = new Date();

        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 13, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 2, 0, 0);

        renderCompletedVisits(
            filteredVisits.filter(v => {
                const d = parseDateTime(v[13]);
                return d && d >= start && d <= end;
            })
        );
    };

    // ====== الأسبوع (Wed → Tue) ======
    el("filterWeek").onclick = () => {
        const now = new Date();
        const day = now.getDay();
        const diff = day >= 3 ? day - 3 : (7 - (3 - day));

        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 13, 0, 0);
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 2, 0, 0);

        renderCompletedVisits(
            filteredVisits.filter(v => {
                const d = parseDateTime(v[13]);
                return d && d >= start && d <= end;
            })
        );
    };

    // ====== الشهر ======
    el("filterMonth").onclick = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();

        const start = new Date(y, m, 1, 13, 0, 0);
        const end = new Date(y, m + 1, 1, 2, 0, 0);

        renderCompletedVisits(
            filteredVisits.filter(v => {
                const d = parseDateTime(v[13]);
                return d && d >= start && d <= end;
            })
        );
    };

    // ====== السنة ======
    el("filterYear").onclick = () => {
        const now = new Date();
        const y = now.getFullYear();

        const start = new Date(y, 0, 1, 13, 0, 0);
        const end = new Date(y + 1, 0, 1, 2, 0, 0);

        renderCompletedVisits(
            filteredVisits.filter(v => {
                const d = parseDateTime(v[13]);
                return d && d >= start && d <= end;
            })
        );
    };

    // ====== مخصص ======
    el("filterCustom").onclick = () => {
        const f = el("filterFrom").value;
        const t = el("filterTo").value;

        if (!f || !t) return alert("اختر التاريخين");

        const start = new Date(f + " 13:00:00");
        const end = new Date(t + " 02:00:00");
        end.setDate(end.getDate() + 1);

        renderCompletedVisits(
            filteredVisits.filter(v => {
                const d = parseDateTime(v[13]);
                return d && d >= start && d <= end;
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

function applyLanguage(lang) {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        el.innerText = translations[lang][key] || key;
    });

    if (lang === "en") {
        document.body.dir = "ltr";
    } else {
        document.body.dir = "rtl";
    }
}
