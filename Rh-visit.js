/* ============================================================
   عناصر مساعدة
============================================================ */

const el = id => document.getElementById(id);

let activeVisits = [];
let completedVisits = [];
let selectedPlate = null;

/* ============================================================
   Tabs
============================================================ */

function switchTab(tab) {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.getElementById("tab_" + tab).classList.add("active");

    document.querySelectorAll(".section-box").forEach(s => s.style.display = "none");
    el(tab + "_section").style.display = "block";

    if (tab === "active") loadActiveVisits();
    if (tab === "today") loadTodayVisits();
    if (tab === "completed") loadCompletedVisits();
}

/* ============================================================
   Toast
============================================================ */

function showToast(msg, type = "info") {
    const box = el("toast-container");
    const div = document.createElement("div");
    div.className = "toast " + type;
    div.textContent = msg;
    box.appendChild(div);
    setTimeout(() => div.classList.add("show"), 10);
    setTimeout(() => div.remove(), 3000);
}

/* ============================================================
   تحميل الزيارات داخل المغسلة
============================================================ */

async function loadActiveVisits() {
    const list = el("activeVisitsList");
    list.innerHTML = "جارِ التحميل...";

    try {
        const res = await apiGetActiveVisits();
        const rows = res.visits || [];
        activeVisits = rows;

        const cars = {};

        rows.forEach(r => {
            const row = r.data;
            const plate = row[1];
            const serviceName = row[6];
            const price = Number(row[7] || 0);
            const checkIn = row[13];
            const parking = row[17];
            const employee = row[9] || "—";

            if (!cars[plate]) {
                cars[plate] = {
                    plate,
                    services: [],
                    totalPrice: 0,
                    checkIn,
                    parking,
                    employee
                };
            }

            cars[plate].services.push({ name: serviceName, price });
            cars[plate].totalPrice += price;
        });

        list.innerHTML = "";

        Object.values(cars).forEach(car => {
            let dt = new Date(car.checkIn);
            let formatted = `${dt.getMonth()+1}-${dt.getDate()}-${dt.getFullYear()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2,'0')}`;

            const servicesHTML = car.services
                .map(s => `<li>${s.name} — ${s.price} ريال</li>`)
                .join("");

            const card = document.createElement("div");
            card.className = "car-card";

            card.innerHTML = `
                <h4>لوحة: ${car.plate}</h4>
                <p><b>الدخول:</b> ${formatted}</p>
                <p><b>رقم الموقف:</b> ${car.parking}</p>
                <p><b>الموظف:</b> ${car.employee}</p>

                <p><b>الخدمات:</b></p>
                <ul>${servicesHTML}</ul>

                <p><b>الإجمالي:</b> ${car.totalPrice} ريال</p>

                <button class="btn-secondary full" onclick="quickPay('كاش','${car.plate}')">دفع كاش</button>
                <button class="btn-secondary full" onclick="quickPay('شبكة','${car.plate}')">دفع شبكة</button>
                <button class="btn-secondary full" onclick="openPaymentModal('جزئي','${car.plate}')">دفع جزئي</button>

                <button class="btn-edit full" onclick="editVisit('${car.plate}')">تعديل الخدمات / الموظف</button>
                <button class="btn-discount full" onclick="addDiscount('${car.plate}')">إضافة خصم</button>
            `;

            list.appendChild(card);
        });

        // ملخص
        el("sumCars").textContent = Object.keys(cars).length;
        let totalServices = 0;
        Object.values(cars).forEach(c => totalServices += c.services.length);
        el("sumServices").textContent = totalServices;

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل الزيارات", "error");
    }
}

/* ============================================================
   زيارات اليوم
============================================================ */

function loadTodayVisits() {
    const box = el("todayVisitsList");
    box.innerHTML = "جارِ التحميل...";

    const today = new Date().toISOString().slice(0, 10);

    const todayRows = activeVisits.filter(v => {
        const date = String(v.data[13] || "").split(" ")[0];
        return date === today;
    });

    if (!todayRows.length) {
        box.innerHTML = `<p style="color:#999;text-align:center;">لا توجد زيارات اليوم</p>`;
        return;
    }

    box.innerHTML = todayRows.map(v => {
        const d = v.data;
        return `
            <div class="row-card">
                <div><b>السيارة:</b> ${d[1]}</div>
                <div><b>الخدمة:</b> ${d[6]}</div>
                <div><b>السعر:</b> ${d[7]} ريال</div>
                <div><b>الموظف:</b> ${d[9]}</div>
                <div><b>الحالة:</b> ${d[15]}</div>

                ${d[15] === "غير مدفوع" ? `
                    <button class="btn" onclick="quickPay('كاش','${d[1]}')">دفع كاش</button>
                    <button class="btn" onclick="quickPay('شبكة','${d[1]}')">دفع شبكة</button>
                    <button class="btn" onclick="openPaymentModal('جزئي','${d[1]}')">دفع جزئي</button>
                ` : ""}
            </div>
        `;
    }).join("");
}

/* ============================================================
   الزيارات المكتملة
============================================================ */

async function loadCompletedVisits() {
    const box = el("completedList");
    box.innerHTML = "جارِ التحميل...";

    try {
        const res = await apiGetCompletedVisits();
        completedVisits = res.visits || [];

        if (!completedVisits.length) {
            box.innerHTML = `<p style="color:#999;text-align:center;">لا توجد زيارات مكتملة</p>`;
            return;
        }

        box.innerHTML = completedVisits.map(v => {
            const d = v.data;
            return `
                <div class="row-card">
                    <div><b>السيارة:</b> ${d[1]}</div>
                    <div><b>الخدمة:</b> ${d[6]}</div>
                    <div><b>السعر:</b> ${d[7]} ريال</div>
                    <div><b>الموظف:</b> ${d[9]}</div>
                    <div><b>طريقة الدفع:</b> ${d[14]}</div>
                </div>
            `;
        }).join("");

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل الزيارات المكتملة", "error");
    }
}

/* ============================================================
   الدفع السريع (كاش / شبكة)
============================================================ */

function quickPay(method, plate) {
    selectedPlate = plate;

    const visitRows = activeVisits.filter(v => v.data[1] === plate);
    const totalRequired = visitRows.reduce((sum, v) => sum + Number(v.data[7] || 0), 0);

    el("modal").style.display = "block";
    el("modal_method").textContent = method;
    el("modal_total").textContent = totalRequired + " ريال";

    el("cash_box").style.display = "none";
    el("card_box").style.display = "none";

    el("modal_confirm").onclick = () => submitQuickPayment(method, totalRequired);
}

async function submitQuickPayment(method, totalRequired) {
    const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);

    for (const v of visitRows) {
        const price = Number(v.data[7] || 0);

        await apiCloseVisit(v.row, {
            payment_status: "مدفوع",
            payment_method: method,
            CASH_AMOUNT: method === "كاش" ? price : 0,
            CARD_AMOUNT: method === "شبكة" ? price : 0,
            TOTAL_PAID: price
        });
    }

    showToast("تم الدفع بنجاح", "success");
    closeModal();
    loadActiveVisits();
    loadTodayVisits();
}

/* ============================================================
   الدفع الجزئي
============================================================ */

function openPaymentModal(method, plate) {
    selectedPlate = plate;

    el("modal").style.display = "block";
    el("modal_method").textContent = method;

    el("cash_box").style.display = "block";
    el("card_box").style.display = "block";

    el("modal_confirm").onclick = () => submitPartialPayment();
}

async function submitPartialPayment() {
    const cash = Number(el("modal_cash").value || 0);
    const card = Number(el("modal_card").value || 0);

    const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);
    const totalRequired = visitRows.reduce((sum, v) => sum + Number(v.data[7] || 0), 0);

    if (cash + card !== totalRequired) {
        showToast(`المبلغ يجب أن يكون ${totalRequired} ريال`, "error");
        return;
    }

    for (const v of visitRows) {
        const price = Number(v.data[7] || 0);

        await apiCloseVisit(v.row, {
            payment_status: "مدفوع",
            payment_method: "جزئي",
            CASH_AMOUNT: cash,
            CARD_AMOUNT: card,
            TOTAL_PAID: price
        });
    }

    showToast("تم الدفع الجزئي", "success");
    closeModal();
    loadActiveVisits();
    loadTodayVisits();
}

/* ============================================================
   تعديل الخدمات / الموظف
============================================================ */

function editVisit(plate) {
    showToast("سيتم إضافة شاشة تعديل لاحقاً", "info");
}

/* ============================================================
   إضافة خصم
============================================================ */

function addDiscount(plate) {
    showToast("سيتم إضافة شاشة الخصم لاحقاً", "info");
}

/* ============================================================
   إغلاق المودال
============================================================ */

function closeModal() {
    el("modal").style.display = "none";
}

/* ============================================================
   INIT
============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    switchTab("active");
});
