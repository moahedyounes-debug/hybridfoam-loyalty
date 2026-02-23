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

/* ===========================
   Toast
=========================== */
function showToast(msg, type = "info") {
    const container = el("toast-container");
    const div = document.createElement("div");
    div.className = "toast " + type;
    div.textContent = msg;
    container.appendChild(div);
    setTimeout(() => div.classList.add("show"), 10);
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
            const brand = row[3] || "";
            const employee = row[9] || "غير محدد";
            const serviceName = row[6];
            const price = Number(row[7] || 0);
            const parking = row[17];

            if (!cars[plate]) {
                cars[plate] = {
                    plate,
                    brand,
                    employee,
                    services: [],
                    totalPrice: 0,
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
<div class="card-header">
    <div>
        <h4>لوحة: ${car.plate} — ${car.brand}</h4>
        <p><b>الموقف:</b> ${car.parking || "-"}</p>
        <p><b>الموظف:</b> ${car.employee}</p>
    </div>
    <button class="edit-btn" data-edit="${car.plate}">⋮</button>
</div>

<div class="card-body">
    <p><b>الخدمات:</b></p>
    <ul>${servicesHTML}</ul>
    <p><b>الإجمالي:</b> ${car.totalPrice} ريال</p>
</div>

<div class="card-footer">
    <button class="btn-pay" data-plate="${car.plate}">تحديث الدفع</button>
</div>
`;
            list.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل الزيارات", "error");
    }
}

/* ===========================
   Event Delegation
=========================== */
document.addEventListener("click", function (e) {
    if (e.target.matches(".btn-pay")) {
        selectedPlate = e.target.getAttribute("data-plate");
        openPaymentModal();
    }

    if (e.target.matches(".edit-btn")) {
        selectedPlate = e.target.getAttribute("data-edit");
        openEditModal(selectedPlate);
    }
});

/* ===========================
   مودال الدفع
=========================== */
function openPaymentModal() {
    el("modal").style.display = "block";

    const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);

    const totalRequired = visitRows.reduce(
        (sum, v) => sum + Number(v.data[7] || 0),
        0
    );

    el("modal_total").textContent = totalRequired + " ريال";

    el("modal_method").textContent = "كاش";

    el("cash_box").style.display = "block";
    el("card_box").style.display = "none";

    el("modal_cash").value = totalRequired;
    el("modal_cash").readOnly = true;

    el("modal_confirm").onclick = () => submitPayment("كاش", totalRequired);
}

function closeModal() {
    el("modal").style.display = "none";
}

/* ===========================
   تحديث الدفع
=========================== */
async function submitPayment(method, totalRequired) {
    const cash = Number(el("modal_cash").value || 0);
    const card = Number(el("modal_card").value || 0);

    let totalPaid = method === "كاش" ? cash : card;

    if (totalPaid !== totalRequired) {
        showToast(`المبلغ يجب أن يكون ${totalRequired} ريال`, "error");
        return;
    }

    const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);

    for (const v of visitRows) {
        const servicePrice = Number(v.data[7] || 0);

        await apiCloseVisit(v.row, {
            payment_status: "مدفوع",
            payment_method: method,
            CASH_AMOUNT: method === "كاش" ? servicePrice : 0,
            CARD_AMOUNT: method === "شبكة" ? servicePrice : 0,
            TOTAL_PAID: servicePrice
        });
    }

    showToast("تم تحديث الدفع", "success");
    closeModal();
    loadActiveVisits();
}

/* ===========================
   مودال التعديل
=========================== */
function openEditModal(plate) {
    const visitRows = activeVisits.filter(v => v.data[1] === plate);

    let html = `
        <h3>التعديل</h3>
        <p>سيتم إضافة التعديل الكامل لاحقًا.</p>
    `;

    el("editContent").innerHTML = html;
    el("editModal").style.display = "flex";
}

el("editClose").onclick = () => {
    el("editModal").style.display = "none";
};

/* ===========================
   تحميل أنواع السيارات
=========================== */
async function loadCarTypes() {
    const res = await apiGetCarTypes();
    carTypesData = res.rows || [];

    const brandSelect = el("car_type");
    const modelSelect = el("car_model");
    const sizeInput = el("car_size");

    brandSelect.innerHTML = '<option value="">— اختر البراند —</option>';
    modelSelect.innerHTML = '<option value="">— اختر الموديل —</option>';

    const brands = [...new Set(carTypesData.map(r => r[0]))];

    brands.forEach(b => {
        const opt = document.createElement("option");
        opt.value = b;
        opt.textContent = b;
        brandSelect.appendChild(opt);
    });

    brandSelect.onchange = () => {
        const brand = brandSelect.value;
        modelSelect.innerHTML = '<option value="">— اختر الموديل —</option>';

        const models = carTypesData.filter(r => r[0] === brand);
        const uniqueModels = [...new Set(models.map(r => r[1]))];

        uniqueModels.forEach(m => {
            const opt = document.createElement("option");
            opt.value = m;
            opt.textContent = m;
            modelSelect.appendChild(opt);
        });
    };

    modelSelect.onchange = () => {
        const brand = brandSelect.value;
        const model = modelSelect.value;
        const row = carTypesData.find(r => r[0] === brand && r[1] === model);
        sizeInput.value = row ? row[2] : "";
    };
}

/* ===========================
   تحميل الخدمات
=========================== */
async function loadServices() {
    const res = await apiGetServices();
    servicesData = res.services || [];

    const typeSelect = el("service_type");
    const detailSelect = el("service_detail");

    typeSelect.innerHTML = '<option value="">— اختر نوع الخدمة —</option>';
    detailSelect.innerHTML = '<option value="">— اختر الخدمة —</option>';

    const categories = [...new Set(servicesData.map(s => s.Category))];

    categories.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        typeSelect.appendChild(opt);
    });

    typeSelect.onchange = () => {
        const cat = typeSelect.value;
        detailSelect.innerHTML = '<option value="">— اختر الخدمة —</option>';

        const filtered = servicesData.filter(s => s.Category === cat);

        filtered.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s.service;
            opt.textContent = s.service;
            detailSelect.appendChild(opt);
        });
    };

    detailSelect.onchange = () => {
        const name = detailSelect.value;
        const row = servicesData.find(s => s.service === name);
        el("price").value = row ? row.price : 0;
        el("points").value = row ? row.commission : 0;
    };
}

/* ===========================
   تحميل الموظفين
=========================== */
async function loadEmployees() {
    const res = await apiGetEmployees();
    const employees = res.rows || [];
    const sel = el("employee_in");

    sel.innerHTML = '<option value="">— اختر الموظف —</option>';

    employees.forEach(e => {
        const opt = document.createElement("option");
        opt.value = e[0];
        opt.textContent = e[0];
        sel.appendChild(opt);
    });
}

/* ===========================
   إضافة خدمة
=========================== */
function addServiceToList() {
    const detail = el("service_detail").value;
    const price = Number(el("price").value || 0);
    const points = Number(el("points").value || 0);
    const category = el("service_type").value;

    if (!detail) {
        showToast("اختر خدمة", "error");
        return;
    }

    if (category === "غسيل") {
        const already = selectedServices.some(s => s.category === "غسيل");
        if (already) {
            showToast("لا يمكن إضافة أكثر من خدمة غسيل", "error");
            return;
        }
    }

    selectedServices.push({
        name: detail,
        price,
        points,
        commission: points,
        category
    });

    renderServicesList();
    recalcTotal();
}

/* ===========================
   عرض الخدمات
=========================== */
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
            const i = Number(btn.dataset.i);
            selectedServices.splice(i, 1);
            renderServicesList();
            recalcTotal();
        };
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
   إرسال الزيارة
=========================== */
async function submitVisit() {
    const btn = el("btnSubmitVisit");
    btn.classList.add("btn-loading");
    btn.disabled = true;

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
    const discountVal = el("discount").value;
    const tipVal = el("tip").value;

    if (!plate_numbers || !/^\d+$/.test(plate_numbers)) {
        showToast("أدخل أرقام اللوحة بشكل صحيح", "error");
        return resetSubmit(btn);
    }

    if (!car_type || !car_model) {
        showToast("اختر نوع وموديل السيارة", "error");
        return resetSubmit(btn);
    }

    if (!employee_in) {
        showToast("اختر الموظف", "error");
        return resetSubmit(btn);
    }

    if (!selectedServices.length) {
        showToast("أضف خدمة واحدة على الأقل", "error");
        return resetSubmit(btn);
    }

    const hasWash = selectedServices.some(s => s.category === "غسيل");
    if (hasWash && !parking_slot) {
        showToast("رقم الموقف مطلوب لخدمات الغسيل", "error");
        return resetSubmit(btn);
    }

    const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const discount = Number(discountVal || 0);
    const finalTotal = Math.max(0, total - discount);

    let cash_amount = 0;
    let card_amount = 0;

    if (payment_status === "مدفوع") {
        if (payment_method === "كاش") cash_amount = finalTotal;
        if (payment_method === "شبكة") card_amount = finalTotal;
        if (payment_method === "جزئي") {
            cash_amount = Number(el("cash_amount").value || 0);
            card_amount = Number(el("card_amount").value || 0);

            if (cash_amount + card_amount !== finalTotal) {
                showToast(`المبلغ يجب أن يكون ${finalTotal} ريال`, "error");
                return resetSubmit(btn);
            }
        }
    }

    const payload = {
        membership: currentMembership,
        plate_numbers,
        plate_letters,
        car_type,
        car_model,
        car_size,
        employee_in,
        employee_out: "",
        branch,
        parking_slot,
        payment_status,
        payment_method,
        cash_amount,
        card_amount,
        rating: "",
        discount: discountVal || "",
        tip: tipVal || "",
        services: JSON.stringify(selectedServices)
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

    resetSubmit(btn);
}

function resetSubmit(btn) {
    btn.classList.remove("btn-loading");
    btn.disabled = false;
}

/* ===========================
   Reset Form
=========================== */
function resetForm() {
    selectedServices = [];
    el("servicesList").innerHTML = "";
    el("plate_numbers").value = "";
    el("plate_letters").value = "";
    el("car_type").value = "";
    el("car_model").value = "";
    el("car_size").value = "";
    el("employee_in").value = "";
    el("discount").value = "";
    el("tip").value = "";
    el("totalPrice").textContent = "0";
    el("payment_status").value = "";
    el("payment_method").value = "";
    el("cash_amount").value = "";
    el("card_amount").value = "";
    el("parking_slot").value = "";
    el("payment_method_wrapper").style.display = "none";
    el("partial_payment_box").style.display = "none";
}

/* ===========================
   INIT
=========================== */
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
        el("payment_method_wrapper").style.display =
            el("payment_status").value === "مدفوع" ? "block" : "none";
    };

    el("payment_method").onchange = () => {
        el("partial_payment_box").style.display =
            el("payment_method").value === "جزئي" ? "block" : "none";
    };
});
