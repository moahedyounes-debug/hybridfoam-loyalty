/* ===========================
   Helpers & Globals
=========================== */

const el = id => document.getElementById(id);
const getDateOnly = v => String(v || "").split("T")[0].split(" ")[0];

let allVisits = [];
let filteredVisits = [];

/* ===========================
   Safe Date Parser
=========================== */
function parseDateTime(str) {
    if (!str) return null;

    str = str.trim().replace("T", " ");

    if (str.length === 10) {
        str += " 00:00:00";
    }

    const parts = str.split(" ");
    if (parts.length < 2) return null;

    const [datePart, timePartRaw] = parts;
    const [y, m, d] = datePart.split("-").map(Number);

    let timePart = timePartRaw.trim();
    const t = timePart.split(":");
    if (t.length === 2) {
        timePart += ":00";
    }

    let [hh, mm, ss] = timePart.split(":").map(Number);

    if (isNaN(hh)) hh = 0;
    if (isNaN(mm)) mm = 0;
    if (isNaN(ss)) ss = 0;

    return new Date(y, m - 1, d, hh, mm, ss);
}

/* ===========================
   Get Active Table (for export)
=========================== */
function getActiveTable() {
    const active = document.querySelector(".tab-content.active");
    if (!active) return null;
    return active.querySelector("table");
}

/* ===========================
   Export Excel (Global)
=========================== */
function exportExcel(table) {
    if (!table) {
        alert("لا يوجد جدول للتصدير");
        return;
    }

    const html = table.outerHTML.replace(/ /g, '%20');

    const a = document.createElement("a");
    a.href = 'data:application/vnd.ms-excel,' + html;
    a.download = "export.xls";
    a.click();
}

/* ===========================
   Export PDF (Global, Arabic support)
=========================== */
async function exportPDF(table) {
    if (!table) {
        alert("لا يوجد جدول للتصدير");
        return;
    }

    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4"
    });

    // تحميل خط Noto Naskh Arabic
    const fontUrl = "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoNaskhArabic/NotoNaskhArabic-Regular.ttf";
    const fontBuffer = await fetch(fontUrl).then(res => res.arrayBuffer());
    const fontBytes = new Uint8Array(fontBuffer);
    let fontBase64 = "";
    for (let i = 0; i < fontBytes.length; i++) {
        fontBase64 += String.fromCharCode(fontBytes[i]);
    }
    fontBase64 = btoa(fontBase64);

    doc.addFileToVFS("Noto.ttf", fontBase64);
    doc.addFont("Noto.ttf", "Noto", "normal");
    doc.setFont("Noto");

    const headers = [];
    table.querySelectorAll("tr th").forEach(th => headers.push(th.innerText));

    const rows = [];
    table.querySelectorAll("tr:not(:first-child)").forEach(tr => {
        const row = [];
        tr.querySelectorAll("td").forEach(td => row.push(td.innerText));
        rows.push(row);
    });

    doc.autoTable({
        head: [headers],
        body: rows,
        styles: { font: "Noto", fontSize: 12, cellPadding: 5, halign: "right" },
        headStyles: { fillColor: [13, 71, 161], halign: "center", font: "Noto" },
        margin: { top: 40 },
        theme: "grid"
    });

    doc.save("export.pdf");
}


/* ===========================
   TABS
=========================== */
function bindTabs() {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            const tab = el("tab-" + btn.dataset.tab);
            tab.classList.add("active");

            if (btn.dataset.tab === "bookings") {
                renderBookings();
            }
            if (btn.dataset.tab === "notifications") {
                renderNotifications();
            }
        };
    });
}

/* ===========================
   Load All Visits Once (Updated for Global Filter)
=========================== */
async function loadAllVisits() {
    const res = await apiGetAll("Visits");
    if (!res.success) {
        console.error("Failed to load visits", res);
        return;
    }

    allVisits = res.rows || [];
    filteredVisits = [...allVisits];

    // ربط الفلترة العامة بصفحة الزيارات
    currentData = allVisits;          // البيانات التي سيتم فلترتها
    currentRenderer = renderAll;      // دالة إعادة الرسم
    currentDateIndex = 13;            // عمود التاريخ check_in

    renderAll(filteredVisits);        // أول رسم للصفحة
}

/* ===========================
   Render All Sections (Fixed)
=========================== */
function renderAll(list = filteredVisits) {

    // تحديث القائمة الحالية بالبيانات القادمة من الفلتر
    filteredVisits = list;

    // إعادة رسم كل الأقسام بالبيانات الجديدة
    renderTopSummary(list);
    renderEmployeesSummary(list);
    renderServicesSummary(list);
    renderCompletedVisits(list);
    renderInvoicesSummary(list);
}


/* ===========================
   Global Export Buttons Binding
=========================== */
function bindGlobalExportButtons() {
    const pdfBtn = el("exportPDF");
    const excelBtn = el("exportExcel");

    if (pdfBtn) {
        pdfBtn.onclick = () => {
            const table = getActiveTable();
            exportPDF(table);
        };
    }

    if (excelBtn) {
        excelBtn.onclick = () => {
            const table = getActiveTable();
            exportExcel(table);
        };
    }
}
/* ===========================
   TOP SUMMARY
=========================== */
function renderTopSummary(list) {
    let cash = 0, card = 0, discount = 0, net = 0, services = 0, tips = 0, commission = 0, total = 0;

    list.forEach(v => {
        const price = Number(v[7] || 0);
        const disc = Number(v[26] || 0);
        const netPrice = price - disc;

        const method = v[16];
        const tip = Number(v[23] || 0);
        const comm = Number(v[12] || 0);

        services++;
        discount += disc;
        tips += tip;
        commission += comm;
        net += netPrice;

        if (method === "كاش") cash += netPrice;
        if (method === "شبكة") card += netPrice;

        total += netPrice;
    });

    el("sumCash").innerText = cash + " ريال";
    el("sumCard").innerText = card + " ريال";
    el("sumDiscount").innerText = discount + " ريال";
    el("sumNet").innerText = net + " ريال";
    el("sumServices").innerText = services;
    el("sumTips").innerText = tips + " ريال";
    el("sumCommission").innerText = commission + " ريال";
    el("sumTotal").innerText = total + " ريال";
}

/* ===========================
   EMPLOYEES SUMMARY
=========================== */
function renderEmployeesSummary(list) {
    const box = el("tab-employees");
    const emp = {};

    list.forEach(v => {
        const employee = v[9] || "غير محدد";
        const price = Number(v[7] || 0);
        const discount = Number(v[26] || 0);
        const net = price - discount;
        const tip = Number(v[23] || 0);
        const comm = Number(v[12] || 0);

        if (!emp[employee]) emp[employee] = { visits: 0, net: 0, tips: 0, commission: 0 };

        emp[employee].visits++;
        emp[employee].net += net;
        emp[employee].tips += tip;
        emp[employee].commission += comm;
    });

    let html = `
    <table>
        <tr>
            <th>الموظف</th>
            <th>الزيارات</th>
            <th>الصافي</th>
            <th>الإكراميات</th>
            <th>العمولة</th>
        </tr>
    `;

    Object.keys(emp).forEach(e => {
        const r = emp[e];
        html += `
        <tr>
            <td>${e}</td>
            <td>${r.visits}</td>
            <td>${r.net}</td>
            <td>${r.tips}</td>
            <td>${r.commission}</td>
        </tr>
        `;
    });

    html += `</table>`;
    box.innerHTML = html;
}

/* ===========================
   SERVICES SUMMARY
=========================== */
function renderServicesSummary(list) {
    const box = el("tab-services");
    const svc = {};
    let total = 0;

    list.forEach(v => {
        const s = v[6] || "غير محدد";
        const price = Number(v[22] || 0);
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
}

/* ===========================
   COMPLETED VISITS
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
   INVOICES SUMMARY
=========================== */
function renderInvoicesSummary(list) {
    const box = el("tab-invoices");
    const mem = {};
    let total = 0;

    list.forEach(v => {
        const m = v[0] || "بدون عضوية";
        const price = Number(v[22] || 0);

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
   BOOKINGS WITH SEARCH & FILTER + ACTION BUTTONS
=========================== */
let allBookings = [];
let filteredBookings = [];

async function renderBookings() {
    const box = el("tab-bookings");
    box.innerHTML = "جاري التحميل...";

    const res = await apiGetAll("Bookings");

    if (!res.success || !res.rows) {
        box.innerHTML = "لا توجد حجوزات";
        return;
    }

    allBookings = res.rows;
    filteredBookings = [...allBookings];

    // ربط الفلترة العامة بصفحة الحجوزات
    currentData = allBookings;       // البيانات التي ستُفلتر
    currentRenderer = drawBookingsUI; // دالة إعادة الرسم
    currentDateIndex = 3;             // عمود التاريخ في Bookings = b[3]

    drawBookingsUI(filteredBookings);
}

function drawBookingsUI(list = filteredBookings) {

    // مهم جداً: حدّث القائمة الحالية بالبيانات القادمة من الفلتر
    filteredBookings = list;

    const box = el("tab-bookings");

    let html = `
    <div class="booking-tools">

        <input id="bookingSearch" type="text" placeholder="بحث برقم اللوحة / العضوية / الاسم" 
               style="padding:8px;width:60%;font-size:16px">

        <button class="btn-primary" id="showAllBookings">الكل</button>
        <button class="btn-primary" id="showPendingBookings">المعلقة</button>
        <button class="btn-primary" id="showDoneBookings">المكتملة</button>

    </div>

    <table>
        <tr>
            <th>العميل</th>
            <th>الجوال</th>
            <th>الخدمة</th>
            <th>التاريخ</th>
            <th>الوقت</th>
            <th>الحالة</th>
            <th>الإجراءات</th>
        </tr>
    `;

    list.forEach((b, i) => {
        html += `
        <tr>
            <td>${b[1] || "-"}</td>
            <td>${b[0]}</td>
            <td>${b[2]}</td>
            <td>${b[3]}</td>
            <td>${b[4]}</td>
            <td>${b[5]}</td>

            <td>
                <button class="btn-primary" onclick="confirmBooking(${i})">تأكيد</button>
                <button class="btn-secondary" onclick="cancelBooking(${i})">إلغاء</button>
                <button class="btn-edit" onclick="editBooking(${i})">تعديل</button>
            </td>
        </tr>
        `;
    });

    html += `</table>`;

    box.innerHTML = html;

    bindBookingFilters();
}


function bindBookingFilters() {
    // البحث
    el("bookingSearch").oninput = (e) => {
        const q = e.target.value.trim();
        filteredBookings = allBookings.filter(b =>
            (b[0] + "").includes(q) ||   // رقم الجوال
            (b[1] + "").includes(q) ||   // اسم العميل
            (b[2] + "").includes(q) ||   // الخدمة
            (b[6] + "").includes(q)      // العضوية (لو موجودة)
        );
        drawBookingsUI();
    };

    // الكل
    el("showAllBookings").onclick = () => {
        filteredBookings = [...allBookings];
        drawBookingsUI();
    };

    // المعلقة
    el("showPendingBookings").onclick = () => {
        filteredBookings = allBookings.filter(b => b[5] === "قيد الانتظار");
        drawBookingsUI();
    };

    // المكتملة
    el("showDoneBookings").onclick = () => {
        filteredBookings = allBookings.filter(b => 
            b[5] === "تم التنفيذ" || b[5] === "مكتمل"
        );
        drawBookingsUI();
    };
}

/* ===========================
   ACTION BUTTONS
=========================== */

// تأكيد الحجز
function confirmBooking(index) {
    const b = filteredBookings[index];
    apiUpdateBookingStatus(b[0], "تم التنفيذ");
    alert("تم تأكيد الحجز");
    renderBookings();
}

// إلغاء الحجز
function cancelBooking(index) {
    const b = filteredBookings[index];
    apiUpdateBookingStatus(b[0], "ملغي");
    alert("تم إلغاء الحجز");
    renderBookings();
}

// تعديل الموعد
function editBooking(index) {
    const b = filteredBookings[index];

    const newDate = prompt("أدخل التاريخ الجديد:", b[3]);
    const newTime = prompt("أدخل الوقت الجديد:", b[4]);

    if (!newDate || !newTime) return;

    apiUpdateBookingDate(b[0], newDate, newTime);
    alert("تم تعديل الموعد");
    renderBookings();
}

/* ===========================
   NOTIFICATIONS
=========================== */
async function renderNotifications() {
    const box = el("tab-notifications");
    box.innerHTML = "جاري التحميل...";

    const res = await apiGetNotifications("ALL");

    if (!res.success || !res.rows || !res.rows.length) {
        box.innerHTML = "لا توجد إشعارات";
        return;
    }

    let html = `
    <table>
        <tr>
            <th>الرسالة</th>
            <th>التاريخ</th>
        </tr>
    `;

    res.rows.forEach(n => {
        html += `
        <tr>
            <td>${n[1]}</td>
            <td>${n[2]}</td>
        </tr>
        `;
    });

    html += `</table>`;
    box.innerHTML = html;
}

/* ===========================
   DETAILS MODAL
=========================== */
function openDetailsModal(visit) {
    const modal = el("detailsModal");
    const body = el("detailsBody");

    body.innerHTML = `
        <p><b>اللوحة:</b> ${visit[1]} ${visit[2]}</p>
        <p><b>الخدمة:</b> ${visit[6]}</p>
        <p><b>السعر:</b> ${visit[7]}</p>
        <p><b>الخصم:</b> ${visit[26]}</p>
        <p><b>الصافي:</b> ${visit[7] - visit[26]}</p>
        <p><b>الدفع:</b> ${visit[16]}</p>
        <p><b>الموظف:</b> ${visit[9]}</p>
        <p><b>الدخول:</b> ${visit[13]}</p>
        <p><b>الخروج:</b> ${visit[14]}</p>
        <p><b>الإكرامية:</b> ${visit[23]}</p>
        <p><b>العمولة:</b> ${visit[12]}</p>
    `;

    modal.setAttribute("aria-hidden", "false");
}

function closeDetailsModal() {
    el("detailsModal").setAttribute("aria-hidden", "true");
}

el("closeModal").onclick = closeDetailsModal;

/* ===========================
   GLOBAL VISIT DETAILS HANDLER
=========================== */
window._openVisitDetails = function(v) {
    openDetailsModal(v);
};


/* ===========================
   GLOBAL DATE FILTER (UNIFIED)
=========================== */

let currentData = [];
let currentRenderer = null;
let currentDateIndex = null;

function bindGlobalFilter() {
    el("gToday").onclick = () => applyRange("today");
    el("gYesterday").onclick = () => applyRange("yesterday");
    el("gWeek").onclick = () => applyRange("week");
    el("gMonth").onclick = () => applyRange("month");
    el("gYear").onclick = () => applyRange("year");

    el("gCustom").onclick = () => {
        const f = el("gFrom").value;
        const t = el("gTo").value;
        if (!f || !t) return alert("اختر التاريخين");
        applyCustom(f, t);
    };
}

/* ===========================
   RANGE FILTERS
=========================== */

function applyRange(type) {
    const now = new Date();
    let from, to;

    switch (type) {
        case "today":
            from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
            to   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 59, 59);
            break;

        case "yesterday":
            from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0);
            to   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 59, 59);
            break;

        case "week":
            const day = now.getDay();
            const diff = day >= 3 ? day - 3 : (7 - (3 - day));
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 12, 0, 0);
            from = start;
            to   = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 11, 59, 59);
            break;

        case "month":
            const y = now.getFullYear();
            const m = now.getMonth();
            from = new Date(y, m, 1, 12, 0, 0);
            to   = new Date(y, m + 1, 1, 11, 59, 59);
            break;

        case "year":
            const yy = now.getFullYear();
            from = new Date(yy, 0, 1, 12, 0, 0);
            to   = new Date(yy + 1, 0, 1, 11, 59, 59);
            break;
    }

    applyFilter(from, to);
}

/* ===========================
   CUSTOM RANGE
=========================== */

function applyCustom(from, to) {
    const start = new Date(from + " 12:00:00");
    const end   = new Date(to   + " 11:59:59");
    applyFilter(start, end);
}

/* ===========================
   MAIN FILTER ENGINE
=========================== */

function applyFilter(from, to) {
    if (!currentData.length || !currentRenderer || currentDateIndex === null) {
        alert("لا توجد بيانات للفلترة");
        return;
    }

    const filtered = currentData.filter(row => {
        const d = parseDateTime(row[currentDateIndex]);
        return d && d >= from && d <= to;
    });

    currentRenderer(filtered);
}


/* ===========================
   LANGUAGE SWITCHER
=========================== */
function applyLanguage(lang) {
    if (!window.translations) return;

    document.querySelectorAll("[data-i18n]").forEach(elm => {
        const key = elm.getAttribute("data-i18n");
        if (translations[lang] && translations[lang][key]) {
            elm.innerText = translations[lang][key];
        }
    });
}

/* ===========================
   DOMContentLoaded
=========================== */
document.addEventListener("DOMContentLoaded", () => {

    loadAllVisits();

    bindTabs();

    bindGlobalFilter();

    bindGlobalExportButtons();

    el("langSwitcher").onchange = (e) => applyLanguage(e.target.value);

});
