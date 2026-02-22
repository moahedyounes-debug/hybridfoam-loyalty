/* ===========================
   أدوات مساعدة
=========================== */

const el = id => document.getElementById(id);

let activeVisits = [];
let selectedPlate = null;
let selectedServices = [];
let carTypesData = [];
let servicesData = [];
let currentMembership = "";

function showToast(msg, type = "info") {
    const container = el("toast-container");
    const div = document.createElement("div");
    div.className = "toast " + type;
    div.textContent = msg;
    container.appendChild(div);
    setTimeout(() => div.classList.add("show"), 10);
    setTimeout(() => div.remove(), 3000);
}
===========================
2) تحميل الزيارات النشطة (داخل المغسلة)
===========================
async function loadActiveVisits() {
    const list = el("activeVisitsList");
    list.innerHTML = "جارِ التحميل...";

    try {
        const res = await apiGetActiveVisits();
        const rows = res.visits || [];
        activeVisits = rows;

        list.innerHTML = "";
        if (!rows.length) {
            list.innerHTML = "<p>لا توجد زيارات حالياً.</p>";
            return;
        }

        const cars = {};

        rows.forEach(r => {
            const row = r.data;
            const plate = row[1];
            const serviceName = row[6];
            const price = Number(row[7] || 0);
            const checkIn = row[13];
            const parking = row[17];

            if (!cars[plate]) {
                cars[plate] = {
                    plate,
                    services: [],
                    totalPrice: 0,
                    checkIn,
                    parking
                };
            }

            cars[plate].services.push({ name: serviceName, price });
            cars[plate].totalPrice += price;
        });

        Object.values(cars).forEach(car => {
            const card = document.createElement("div");
            card.className = "car-card";

            const servicesHTML = car.services
                .map(s => `<li>${s.name} — ${s.price} ريال</li>`)
                .join("");

            card.innerHTML = `
                <h4>لوحة: ${car.plate}</h4>
                <p><b>الدخول:</b> ${car.checkIn}</p>
                <p><b>رقم الموقف:</b> ${car.parking}</p>
                <p><b>الخدمات:</b></p>
                <ul>${servicesHTML}</ul>
                <p><b>الإجمالي:</b> ${car.totalPrice} ريال</p>

                <button class="btn-secondary full" onclick="openPaymentModal('كاش', '${car.plate}')">دفع كاش</button>
                <button class="btn-secondary full" onclick="openPaymentModal('شبكة', '${car.plate}')">دفع شبكة</button>
                <button class="btn-secondary full" onclick="openPaymentModal('جزئي', '${car.plate}')">دفع جزئي</button>
            `;

            list.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل الزيارات", "error");
    }
}

===========================
3) زيارات اليوم (تصميم صفوف فقط)
===========================

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
            <div style="padding:10px;border-bottom:1px solid #eee;">
                <div><b>السيارة:</b> ${d[1]}</div>
                <div><b>الخدمة:</b> ${d[6]}</div>
                <div><b>السعر:</b> ${d[7]} ريال</div>
                <div><b>الموظف:</b> ${d[9]}</div>
                <div><b>الحالة:</b> ${d[15]}</div>

                ${d[15] === "غير مدفوع" ? `
                    <button class="btn" style="margin-top:6px;"
                        onclick="openPaymentModal('كاش', '${d[1]}')">دفع كاش</button>
                    <button class="btn" style="margin-top:6px;"
                        onclick="openPaymentModal('شبكة', '${d[1]}')">دفع شبكة</button>
                    <button class="btn" style="margin-top:6px;"
                        onclick="openPaymentModal('جزئي', '${d[1]}')">دفع جزئي</button>
                ` : ""}
            </div>
        `;
    }).join("");
}

===========================
4) مودال الدفع + الدفع السريع
===========================

   function openPaymentModal(method, plate) {
    selectedPlate = plate;

    el("modal").style.display = "block";
    el("modal_method").textContent = method;
    el("modal_cash").value = "";
    el("modal_card").value = "";

    const visitRows = activeVisits.filter(v => v.data[1] === plate);
    const totalRequired = visitRows.reduce((sum, v) => sum + Number(v.data[7] || 0), 0);

    el("modal_total").textContent = totalRequired + " ريال";

    el("cash_box").style.display = "none";
    el("card_box").style.display = "none";

    if (method === "كاش") el("cash_box").style.display = "block";
    if (method === "شبكة") el("card_box").style.display = "block";
    if (method === "جزئي") {
        el("cash_box").style.display = "block";
        el("card_box").style.display = "block";
    }

    el("modal_confirm").onclick = () => submitPayment(method);
}

function closeModal() {
    el("modal").style.display = "none";
}
===========================
5) تنفيذ الدفع
===========================

async function submitPayment(method) {
    const cash = Number(el("modal_cash").value || 0);
    const card = Number(el("modal_card").value || 0);

    const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);
    const totalRequired = visitRows.reduce((sum, v) => sum + Number(v.data[7] || 0), 0);

    const totalPaid = cash + card;

    if (method !== "جزئي" && totalPaid !== totalRequired) {
        showToast(`المبلغ يجب أن يكون ${totalRequired} ريال`, "error");
        return;
    }

    const paymentMethodLabel = method === "جزئي" ? "كاش + شبكة" : method;

    for (const v of visitRows) {
        const price = Number(v.data[7] || 0);
        const ratio = price / totalRequired;

        await apiCloseVisit(v.row, {
            payment_status: "مدفوع",
            payment_method: paymentMethodLabel,
            CASH_AMOUNT: cash * ratio,
            CARD_AMOUNT: card * ratio,
            TOTAL_PAID: price
        });
    }

    showToast("تم تحديث الدفع", "success");
    closeModal();
    loadActiveVisits();
    loadTodayVisits();
}
===========================
6) تحميل أنواع السيارات + الخدمات + الموظفين
===========================

   async function loadCarTypes() { ... }
async function loadServices() { ... }
async function loadEmployees() { ... }
===========================
7) إضافة/حذف الخدمات + الخصم
===========================
function addServiceToList() {
    const detail = el("service_detail").value;
    const price = Number(el("price").value || 0);
    const points = Number(el("points").value || 0);

    if (!detail) return showToast("اختر خدمة", "error");

    selectedServices.push({ name: detail, price, points });
    renderServicesList();
    recalcTotal();
}


function renderServicesList() {
    const box = el("servicesList");
    box.innerHTML = "";

    if (!selectedServices.length) {
        box.textContent = "لا توجد خدمات مضافة بعد.";
        return;
    }

    selectedServices.forEach((s, i) => {
        const div = document.createElement("div");
        div.className = "service-item";
        div.innerHTML = `
            <span>${s.name} - ${s.price} ريال</span>
            <button class="btn-remove" data-i="${i}">حذف</button>
        `;
        box.appendChild(div);
    });

    box.querySelectorAll(".btn-remove").forEach(btn => {
        btn.onclick = () => {
            selectedServices.splice(Number(btn.dataset.i), 1);
            renderServicesList();
            recalcTotal();
        };
    });
}

function recalcTotal() {
    const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const discount = Number(el("discount").value || 0);
    el("totalPrice").textContent = Math.max(0, total - discount);
}
===========================
7) إضافة/حذف الخدمات + الخصم
===========================
function addServiceToList() {
    const detail = el("service_detail").value;
    const price = Number(el("price").value || 0);
    const points = Number(el("points").value || 0);

    if (!detail) return showToast("اختر خدمة", "error");

    selectedServices.push({ name: detail, price, points });
    renderServicesList();
    recalcTotal();
}

function renderServicesList() {
    const box = el("servicesList");
    box.innerHTML = "";

    if (!selectedServices.length) {
        box.textContent = "لا توجد خدمات مضافة بعد.";
        return;
    }

    selectedServices.forEach((s, i) => {
        const div = document.createElement("div");
        div.className = "service-item";
        div.innerHTML = `
            <span>${s.name} - ${s.price} ريال</span>
            <button class="btn-remove" data-i="${i}">حذف</button>
        `;
        box.appendChild(div);
    });

    box.querySelectorAll(".btn-remove").forEach(btn => {
        btn.onclick = () => {
            selectedServices.splice(Number(btn.dataset.i), 1);
            renderServicesList();
            recalcTotal();
        };
    });
}

function recalcTotal() {
    const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const discount = Number(el("discount").value || 0);
    el("totalPrice").textContent = Math.max(0, total - discount);
}

===========================
8) تسجيل الزيارة
===========================
async function submitVisit() {
    ...
}
===========================
9) INIT
===========================

document.addEventListener("DOMContentLoaded", () => {
    loadActiveVisits();
    loadCarTypes();
    loadServices();
    loadEmployees();

    el("btnRefreshActive").onclick = loadActiveVisits;
    el("btnAddService").onclick = addServiceToList;
    el("discount").oninput = recalcTotal;
    el("btnSubmitVisit").onclick = submitVisit;
    el("modal_close").onclick = closeModal;

    el("payment_status").onchange = () => {
        const val = el("payment_status").value;
        el("payment_method_wrapper").style.display = val === "مدفوع" ? "block" : "none";
        el("partial_payment_box").style.display = "none";
    };

    el("payment_method").onchange = () => {
        const val = el("payment_method").value;
        el("partial_payment_box").style.display = val === "جزئي" ? "block" : "none";
    };
});
