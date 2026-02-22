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
   تسجيل زيارة
============================================================ */

async function submitVisit() {
    if (!addedServices.length) {
        showToast("أضف خدمة واحدة على الأقل", "error");
        return;
    }

    const payload = {
        plate: el("plate_numbers").value,
        letters: el("plate_letters").value,
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

    loadActiveVisits();
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

    activeVisits.forEach(v => {
        const d = v.data;
        const plate = d[1];
        const service = d[6];
        const price = Number(d[7] || 0);
        const checkin = d[13];
        const parking = d[17];
        const employee = d[9] || "—";

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
    });

    list.innerHTML = "";

    Object.values(cars).forEach(car => {
        const dt = new Date(car.checkin);
        const formatted = `${dt.getMonth()+1}-${dt.getDate()}-${dt.getFullYear()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2,'0')}`;

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
}

/* ============================================================
   INIT
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
    await loadCarTypes();
    await loadServices();
    await loadEmployees();
    await loadActiveVisits();
});
