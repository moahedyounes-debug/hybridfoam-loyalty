/* ============================================================
   عناصر مساعدة
============================================================ */

const el = id => document.getElementById(id);

let carTypes = [];
let services = [];
let employees = [];
let addedServices = [];
let activeVisits = [];
let selectedPlate = null;

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
   تحميل أنواع السيارات
============================================================ */

async function loadCarTypes() {
    const res = await apiGetCarTypes();
    carTypes = res.data || [];

    el("car_type").innerHTML = carTypes
        .map(c => `<option value="${c.brand}">${c.brand}</option>`)
        .join("");

    loadModels();
}

function loadModels() {
    const brand = el("car_type").value;
    const models = carTypes.find(c => c.brand === brand)?.models || [];

    el("car_model").innerHTML = models
        .map(m => `<option value="${m}">${m}</option>`)
        .join("");

    el("car_size").value = ""; // API لا يرجع حجم
}

/* ============================================================
   تحميل الخدمات
============================================================ */

async function loadServices() {
    const res = await apiGetServices();
    services = res.data || [];

    const types = [...new Set(services.map(s => s.type))];

    el("service_type").innerHTML = types
        .map(t => `<option value="${t}">${t}</option>`)
        .join("");

    loadServiceDetails();
}

function loadServiceDetails() {
    const type = el("service_type").value;
    const filtered = services.filter(s => s.type === type);

    el("service_detail").innerHTML = filtered
        .map(s => `<option value="${s.name}" data-price="${s.price}" data-points="${s.points}">${s.name}</option>`)
        .join("");

    updateServicePrice();
}

function updateServicePrice() {
    const opt = el("service_detail").selectedOptions[0];
    el("price").value = opt?.dataset.price || 0;
    el("points").value = opt?.dataset.points || 0;
}

/* ============================================================
   تحميل الموظفين
============================================================ */

async function loadEmployees() {
    const res = await apiGetEmployees();
    employees = res.data || [];

    el("employee_in").innerHTML = employees
        .map(e => `<option value="${e.name}">${e.name}</option>`)
        .join("");
}
/* ============================================================
   إضافة خدمة
============================================================ */

function addService() {
    const name = el("service_detail").value;
    const price = Number(el("price").value);

    if (!name || !price) {
        showToast("اختر خدمة صحيحة", "error");
        return;
    }

    addedServices.push({ name, price });

    renderServices();
    recalcTotal();
}

function renderServices() {
    el("servicesList").innerHTML = addedServices
        .map((s, i) => `
            <div class="service-item">
                ${s.name} — ${s.price} ريال
                <button onclick="removeService(${i})" class="btn-secondary small">X</button>
            </div>
        `)
        .join("");
}

function removeService(i) {
    addedServices.splice(i, 1);
    renderServices();
    recalcTotal();
}

function recalcTotal() {
    const discount = Number(el("discount").value || 0);
    const total = addedServices.reduce((a, b) => a + b.price, 0) - discount;
    el("totalPrice").textContent = total < 0 ? 0 : total;
}

/* ============================================================
   منطق الدفع داخل نموذج التسجيل
============================================================ */

function handlePaymentStatusChange() {
    const status = el("payment_status").value;
    const wrapper = el("payment_method_wrapper");
    const partialBox = el("partial_payment_box");

    if (status === "مدفوع") {
        wrapper.style.display = "block";
    } else {
        wrapper.style.display = "none";
        partialBox.style.display = "none";
        el("payment_method").value = "";
        el("cash_amount").value = "";
        el("card_amount").value = "";
        el("paid_total").textContent = "0";
    }
}

function handlePaymentMethodChange() {
    const method = el("payment_method").value;
    const partialBox = el("partial_payment_box");

    if (method === "جزئي") {
        partialBox.style.display = "block";
    } else {
        partialBox.style.display = "none";
        el("cash_amount").value = "";
        el("card_amount").value = "";
        el("paid_total").textContent = "0";
    }
}

function recalcPartialPaid() {
    const cash = Number(el("cash_amount").value || 0);
    const card = Number(el("card_amount").value || 0);
    el("paid_total").textContent = cash + card;
}
/* ============================================================
   تسجيل زيارة
============================================================ */

async function submitVisit() {
    if (!addedServices.length) {
        showToast("أضف خدمة واحدة على الأقل", "error");
        return;
    }

    const plate = el("plate_numbers").value.trim();
    if (!plate) {
        showToast("أدخل أرقام اللوحة", "error");
        return;
    }

    const payload = {
        plate: plate,
        letters: el("plate_letters").value.trim(),
        brand: el("car_type").value,
        model: el("car_model").value,
        size: el("car_size").value,
        services: JSON.stringify(addedServices),
        discount: Number(el("discount").value || 0),
        total: Number(el("totalPrice").textContent),
        parking: el("parking_slot").value,
        employee: el("employee_in").value,
        branch: el("branch").value,
        paymentStatus: el("payment_status").value,
        paymentMethod: el("payment_method").value,
        cash: Number(el("cash_amount").value || 0),
        card: Number(el("card_amount").value || 0)
    };

    await apiAddVisit(payload);

    showToast("تم تسجيل الزيارة", "success");

    addedServices = [];
    renderServices();
    recalcTotal();

    el("plate_numbers").value = "";
    el("plate_letters").value = "";
    el("discount").value = "";
    el("parking_slot").value = "";
    el("payment_status").value = "";
    el("payment_method").value = "";
    el("cash_amount").value = "";
    el("card_amount").value = "";
    el("paid_total").textContent = "0";
    el("payment_method_wrapper").style.display = "none";
    el("partial_payment_box").style.display = "none";

    await loadActiveVisits();
    loadTodayVisits();
}

/* ============================================================
   تحميل السيارات داخل المغسلة
============================================================ */

async function loadActiveVisits() {
    const list = el("activeVisitsList");
    list.innerHTML = "جارِ التحميل...";

    const res = await apiGetActiveVisits();
    activeVisits = res.visits || [];

    const cars = {};
    const perEmployee = {};

    activeVisits.forEach(v => {
        const d = v.data;
        const plate = d[1];
        const service = d[6];
        const price = Number(d[7] || 0);
        const checkin = d[13];
        const parking = d[17];
        const employee = d[9] || "غير محدد";

        if (!cars[plate]) {
            cars[plate] = {
                plate,
                services: [],
                total: 0,
                checkin,
                parking,
                employee
            };
        }

        cars[plate].services.push({ service, price });
        cars[plate].total += price;

        if (!perEmployee[employee]) {
            perEmployee[employee] = { services: 0, amount: 0 };
        }
        perEmployee[employee].services += 1;
        perEmployee[employee].amount += price;
    });

    list.innerHTML = "";

    Object.values(cars).forEach(car => {
        const dt = new Date(car.checkin);
        const formatted = isNaN(dt.getTime())
            ? car.checkin
            : `${dt.getMonth() + 1}-${dt.getDate()}-${dt.getFullYear()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2, "0")}`;

        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
            <h4>🚗 ${car.plate}</h4>
            <p><b>الدخول:</b> ${formatted}</p>
            <p><b>الموظف:</b> ${car.employee}</p>
            <p><b>الموقف:</b> ${car.parking}</p>

            <p><b>الخدمات:</b></p>
            <ul>
                ${car.services.map(s => `<li>${s.service} — ${s.price} ريال</li>`).join("")}
            </ul>

            <p><b>الإجمالي:</b> ${car.total} ريال</p>

            <select onchange="handleQuickPay('${car.plate}', this.value)">
                <option value="">— اختر —</option>
                <option value="كاش">دفع كاش</option>
                <option value="شبكة">دفع شبكة</option>
                <option value="جزئي">دفع جزئي</option>
            </select>
        `;

        list.appendChild(card);
    });

    el("sumCars").textContent = Object.keys(cars).length;
    el("sumServices").textContent = activeVisits.length;

    loadEmployeeSummary(perEmployee);
    loadTodayVisits();
}

/* ============================================================
   ملخص الموظفين
============================================================ */

function loadEmployeeSummary(perEmployee) {
    const box = document.getElementById("employeeSummary");

    if (!box) return;

    box.innerHTML = `
        <h3 class="section-title">📌 ملخص الموظفين</h3>
        ${Object.keys(perEmployee).map(emp => `
            <div class="summary-box">
                <p><b>الموظف:</b> ${emp}</p>
                <p><b>عدد الخدمات:</b> ${perEmployee[emp].services}</p>
                <p><b>إجمالي المبلغ:</b> ${perEmployee[emp].amount} ريال</p>
            </div>
        `).join("")}
    `;
}
/* ============================================================
   زيارات اليوم
============================================================ */

function loadTodayVisits() {
    const box = el("todayVisitsList");
    box.innerHTML = "";

    if (!activeVisits.length) {
        box.innerHTML = "<p>لا توجد زيارات اليوم</p>";
        return;
    }

    const today = new Date().toISOString().slice(0, 10);

    const rows = activeVisits.filter(v => {
        const raw = String(v.data[13] || "");
        const date = raw.split(" ")[0];
        return date === today;
    });

    if (!rows.length) {
        box.innerHTML = "<p>لا توجد زيارات اليوم</p>";
        return;
    }

    box.innerHTML = rows.map(v => `
        <div class="card">
            <p><b>السيارة:</b> ${v.data[1]}</p>
            <p><b>الخدمة:</b> ${v.data[6]}</p>
            <p><b>السعر:</b> ${v.data[7]} ريال</p>
            <p><b>الموظف:</b> ${v.data[9] || "غير محدد"}</p>
        </div>
    `).join("");
}

/* ============================================================
   الدفع السريع من الكرت
============================================================ */

function handleQuickPay(plate, method) {
    if (!method) return;

    selectedPlate = plate;

    const rows = activeVisits.filter(v => v.data[1] === plate);
    const total = rows.reduce((a, b) => a + Number(b.data[7] || 0), 0);

    el("modal_method").textContent = method;
    el("modal_total").textContent = total + " ريال";

    if (method === "جزئي") {
        el("cash_box").style.display = "block";
        el("card_box").style.display = "block";
    } else {
        el("cash_box").style.display = "none";
        el("card_box").style.display = "none";
        el("modal_cash").value = "";
        el("modal_card").value = "";
    }

    el("modal").style.display = "flex";

    el("modal_confirm").onclick = () => submitQuickPayment(method, total);
}

async function submitQuickPayment(method, total) {
    const rows = activeVisits.filter(v => v.data[1] === selectedPlate);

    let cash = 0, card = 0;

    if (method === "جزئي") {
        cash = Number(el("modal_cash").value || 0);
        card = Number(el("modal_card").value || 0);

        if (cash + card !== total) {
            showToast("المبلغ غير مطابق للإجمالي", "error");
            return;
        }
    } else {
        cash = method === "كاش" ? total : 0;
        card = method === "شبكة" ? total : 0;
    }

    for (const v of rows) {
        await apiCloseVisit(v.row, {
            payment_status: "مدفوع",
            payment_method: method,
            CASH_AMOUNT: cash,
            CARD_AMOUNT: card,
            TOTAL_PAID: total
        });
    }

    showToast("تم الدفع", "success");
    closeModal();
    await loadActiveVisits();
}

/* ============================================================
   إغلاق المودال
============================================================ */

function closeModal() {
    el("modal").style.display = "none";
    el("modal_cash").value = "";
    el("modal_card").value = "";
}

/* ============================================================
   INIT
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
    await loadCarTypes();
    await loadServices();
    await loadEmployees();
    await loadActiveVisits();
    await loadCompletedVisits();

    el("btnAddService").onclick = addService;
    el("btnSubmitVisit").onclick = submitVisit;
    el("btnRefreshActive").onclick = loadActiveVisits;

    el("car_type").onchange = loadModels;
    el("service_type").onchange = loadServiceDetails;
    el("service_detail").onchange = updateServicePrice;
    el("discount").oninput = recalcTotal;

    el("payment_status").onchange = handlePaymentStatusChange;
    el("payment_method").onchange = handlePaymentMethodChange;
    el("cash_amount").oninput = recalcPartialPaid;
    el("card_amount").oninput = recalcPartialPaid;

    el("modal_close").onclick = closeModal;
});
/* ============================================================
   الزيارات المكتملة (مدفوع)
============================================================ */

async function loadCompletedVisits() {
    const box = el("completedList");
    box.innerHTML = "جارِ التحميل...";

    // نجلب كل الزيارات (نفس API الزيارات داخل المغسلة)
    const res = await apiGetActiveVisits();
    const visits = res.visits || [];

    // فلترة الزيارات المدفوعة فقط
    const paid = visits.filter(v => {
        const status = v.data[14] || v.data[15] || ""; 
        return status === "مدفوع";
    });

    if (!paid.length) {
        box.innerHTML = "<p>لا توجد زيارات مكتملة</p>";
        return;
    }

    // عرض الزيارات المدفوعة
    box.innerHTML = paid.map(v => `
        <div class="card">
            <p><b>السيارة:</b> ${v.data[1]}</p>
            <p><b>الخدمة:</b> ${v.data[6]}</p>
            <p><b>السعر:</b> ${v.data[7]} ريال</p>
            <p><b>الموظف:</b> ${v.data[9] || "غير محدد"}</p>
            <p><b>طريقة الدفع:</b> ${v.data[14] || "—"}</p>
        </div>
    `).join("");
}
/* ============================================================
   دوال مساعدة إضافية (في حال الحاجة)
============================================================ */

function formatDateTime(raw) {
    if (!raw) return "—";

    const dt = new Date(raw);
    if (isNaN(dt.getTime())) return raw;

    return `${dt.getMonth() + 1}-${dt.getDate()}-${dt.getFullYear()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function clearVisitForm() {
    el("plate_numbers").value = "";
    el("plate_letters").value = "";
    el("discount").value = "";
    el("parking_slot").value = "";
    el("payment_status").value = "";
    el("payment_method").value = "";
    el("cash_amount").value = "";
    el("card_amount").value = "";
    el("paid_total").textContent = "0";
    el("payment_method_wrapper").style.display = "none";
    el("partial_payment_box").style.display = "none";

    addedServices = [];
    renderServices();
    recalcTotal();
}


/* ============================================================
   نهاية الملف
============================================================ */
