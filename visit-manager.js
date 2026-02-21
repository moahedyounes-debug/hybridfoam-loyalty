// visit-manager.js

let currentMembership = "";
let selectedServices = [];
let carTypesData = [];
let servicesData = [];

const el = id => document.getElementById(id);

function showToast(msg, type = "info") {
    const container = el("toast-container");
    const div = document.createElement("div");
    div.className = "toast " + type;
    div.textContent = msg;
    container.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

/* ===========================
   تحميل الزيارات النشطة
=========================== */
async function loadActiveVisits() {
    const list = el("activeVisitsList");
    list.innerHTML = "جارِ التحميل...";

    try {
        const res = await apiGetActiveVisits();
        const rows = res.rows || [];

        list.innerHTML = "";

        if (!rows.length) {
            list.innerHTML = "<p>لا توجد زيارات حالياً.</p>";
            return;
        }

        rows.forEach(r => {
            const card = document.createElement("div");
            card.className = "card";

            card.innerHTML = `
                <h4>لوحة: ${r[1]}</h4>
                <p>الخدمة: ${r[6]}</p>
                <p>السعر: ${r[7]} ريال</p>
                <p>الدخول: ${r[13]}</p>
            `;

            list.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل الزيارات", "error");
    }
}

/* ===========================
   تحميل أنواع السيارات
=========================== */
async function loadCarTypes() {
    try {
        const res = await apiGetCarTypes();
        carTypesData = res.rows || [];

        const brandSelect = el("car_type");
        const modelSelect = el("car_model");
        const sizeInput = el("car_size");

        brandSelect.innerHTML = '<option value="">— اختر البراند —</option>';
        modelSelect.innerHTML = '<option value="">— اختر الموديل —</option>';
        sizeInput.value = "";

        const brands = [...new Set(carTypesData.map(r => r[0]))];

        brands.forEach(b => {
            const opt = document.createElement("option");
            opt.value = b;
            opt.textContent = b;
            brandSelect.appendChild(opt);
        });

        brandSelect.addEventListener("change", () => {
            const brand = brandSelect.value;
            modelSelect.innerHTML = '<option value="">— اختر الموديل —</option>';
            sizeInput.value = "";

            if (!brand) return;

            const models = carTypesData.filter(r => r[0] === brand);
            const uniqueModels = [...new Set(models.map(r => r[1]))];

            uniqueModels.forEach(m => {
                const opt = document.createElement("option");
                opt.value = m;
                opt.textContent = m;
                modelSelect.appendChild(opt);
            });
        });

        modelSelect.addEventListener("change", () => {
            const brand = brandSelect.value;
            const model = modelSelect.value;
            const row = carTypesData.find(r => r[0] === brand && r[1] === model);
            sizeInput.value = row ? row[2] : "";
        });

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل أنواع السيارات", "error");
    }
}

/* ===========================
   التعرف التلقائي من اللوحة
=========================== */
async function autoDetectCar() {
    const plate = el("plate_numbers").value.trim();
    if (!plate) return;

    try {
        const res = await apiPost({
            action: "detectCarByPlate",
            plate_numbers: plate
        });

        if (!res.success) return;

        currentMembership = res.membership || "";

        el("car_type").value = res.brand || "";
        el("car_model").value = res.model || "";
        el("car_size").value = res.size || "";

        showToast("تم التعرف على السيارة", "success");

    } catch (err) {
        currentMembership = "";
    }
}

/* ===========================
   تحميل الخدمات
=========================== */
async function loadServices() {
    try {
        const res = await apiGetServices();
        servicesData = res.services || [];

        const typeSelect = el("service_type");
        const detailSelect = el("service_detail");

        typeSelect.innerHTML = '<option value="">— اختر نوع الخدمة —</option>';
        detailSelect.innerHTML = '<option value="">— اختر الخدمة —</option>';

        const categories = [...new Set(servicesData.map(s => s.category))];

        categories.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            typeSelect.appendChild(opt);
        });

        typeSelect.addEventListener("change", () => {
            const cat = typeSelect.value;
            detailSelect.innerHTML = '<option value="">— اختر الخدمة —</option>';

            const filtered = servicesData.filter(s => s.category === cat);

            filtered.forEach(s => {
                const opt = document.createElement("option");
                opt.value = s.service;
                opt.textContent = s.service;
                detailSelect.appendChild(opt);
            });
        });

        detailSelect.addEventListener("change", () => {
            const name = detailSelect.value;
            const row = servicesData.find(s => s.service === name);

            el("price").value = row ? row.price : 0;
            el("points").value = row ? row.commission : 0;
        });

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل الخدمات", "error");
    }
}

/* ===========================
   تحميل الموظفين
=========================== */
async function loadEmployees() {
    try {
        const res = await apiGetEmployees();
        const employees = res.employees || [];

        const sel = el("employee_in");
        sel.innerHTML = '<option value="">— اختر الموظف —</option>';

        employees.forEach(e => {
            const opt = document.createElement("option");
            opt.value = e.employee;
            opt.textContent = e.employee;
            sel.appendChild(opt);
        });

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل الموظفين", "error");
    }
}

/* ===========================
   إضافة خدمة
=========================== */
function addServiceToList() {
    const detail = el("service_detail").value;
    const price = Number(el("price").value || 0);
    const points = Number(el("points").value || 0);

    if (!detail) {
        showToast("اختر خدمة", "error");
        return;
    }

    selectedServices.push({ name: detail, price, points });
    renderServicesList();
    recalcTotal();
}

function renderServicesList() {
    const box = el("servicesList");
    box.innerHTML = "";

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
        btn.addEventListener("click", () => {
            const i = btn.getAttribute("data-i");
            selectedServices.splice(i, 1);
            renderServicesList();
            recalcTotal();
        });
    });
}

/* ===========================
   حساب الإجمالي
=========================== */
function recalcTotal() {
    const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const discount = Number(el("discount").value || 0);
    el("totalPrice").textContent = Math.max(0, total - discount);
}

/* ===========================
   الدفع الجزئي
=========================== */
function setupPaymentStatus() {
    const statusSel = el("payment_status");
    const methodSel = el("payment_method");
    const methodWrapper = el("payment_method_wrapper");
    const partialBox = el("partial_payment_box");

    statusSel.addEventListener("change", () => {
        if (statusSel.value === "مدفوع") {
            methodWrapper.style.display = "block";
        } else {
            methodWrapper.style.display = "none";
            partialBox.style.display = "none";
        }
    });

    methodSel.addEventListener("change", () => {
        if (methodSel.value === "جزئي") {
            partialBox.style.display = "block";
        } else {
            partialBox.style.display = "none";
        }
    });

    ["cash_amount", "card_amount"].forEach(id => {
        el(id).addEventListener("input", () => {
            const cash = Number(el("cash_amount").value || 0);
            const card = Number(el("card_amount").value || 0);
            el("paid_total").textContent = cash + card;
        });
    });
}

/* ===========================
   إرسال الزيارة
=========================== */
async function submitVisit() {
    const plate_numbers = el("plate_numbers").value.trim();
    const plate_letters = el("plate_letters").value.trim();
    const car_type = el("car_type").value;
    const car_model = el("car_model").value;
    const car_size = el("car_size").value;
    const employee_in = el("employee_in").value;
    const branch = el("branch").value;
    const parking_slot = el("parking_slot").value;
    const payment_status = el("payment_status").value;
    const payment_method = el("payment_method").value;

    if (!plate_numbers) return showToast("أدخل أرقام اللوحة", "error");
    if (!employee_in) return showToast("اختر الموظف", "error");
    if (!selectedServices.length) return showToast("أضف خدمة واحدة على الأقل", "error");

    const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const discount = Number(el("discount").value || 0);
    const finalPrice = Math.max(0, totalPrice - discount);
    const totalPoints = selectedServices.reduce((sum, s) => sum + s.points, 0);

    const serviceNames = selectedServices.map(s => s.name).join(" + ");

    let cash_amount = 0;
    let card_amount = 0;

    if (payment_method === "جزئي") {
        cash_amount = Number(el("cash_amount").value || 0);
        card_amount = Number(el("card_amount").value || 0);
    }

    const payload = {
        membership: currentMembership,
        plate_numbers,
        plate_letters,
        car_type,
        car_model,
        car_size,
        service_detail: serviceNames,
        price: finalPrice,
        points: totalPoints,
        employee_in,
        employee_out: "",
        branch,
        commission: 0,
        payment_status,
        payment_method,
        cash_amount,
        card_amount,
        parking_slot,
        rating: ""
    };

    try {
        await apiAddVisit(payload);
        showToast("تم تسجيل الزيارة", "success");
        resetForm();
        loadActiveVisits();
    } catch (err) {
        console.error(err);
        showToast("خطأ في تسجيل الزيارة", "error");
    }
}

/* ===========================
   إعادة تعيين النموذج
=========================== */
function resetForm() {
    el("plate_numbers").value = "";
    el("plate_letters").value = "";
    el("car_type").value = "";
    el("car_model").innerHTML = '<option value="">— اختر الموديل —</option>';
    el("car_size").value = "";
    el("service_type").value = "";
    el("service_detail").innerHTML = '<option value="">— اختر الخدمة —</option>';
    el("price").value = "";
    el("points").value = "";
    el("discount").value = "";
    el("parking_slot").value = "";
    el("payment_status").value = "";
    el("payment_method").value = "";
    el("payment_method_wrapper").style.display = "none";
    el("partial_payment_box").style.display = "none";
    selectedServices = [];
    renderServicesList();
    recalcTotal();
    currentMembership = "";
}

/* ===========================
   INIT
=========================== */
document.addEventListener("DOMContentLoaded", () => {
    loadActiveVisits();
    loadCarTypes();
    loadServices();
    loadEmployees();
    setupPaymentStatus();

    el("btnRefreshActive").addEventListener("click", loadActiveVisits);
    el("btnAddService").addEventListener("click", addServiceToList);
    el("discount").addEventListener("input", recalcTotal);
    el("plate_numbers").addEventListener("blur", autoDetectCar);
    el("btnSubmitVisit").addEventListener("click", submitVisit);
});
