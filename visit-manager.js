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
   تحميل الزيارات النشطة (نسخة نهائية)
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

    <!-- قائمة التعديل -->
    <div class="dropdown">
        <button class="edit-btn">⋮ تعديل ▼</button>
        <div class="dropdown-content edit-menu" data-plate="${car.plate}">
            <a href="#" data-action="swap">تبديل خدمة</a>
            <a href="#" data-action="delete">حذف خدمة</a>
            <a href="#" data-action="add">إضافة خدمة</a>
            <a href="#" data-action="emp">تغيير الموظف</a>
            <a href="#" data-action="disc">تغيير الخصم</a>
            <a href="#" data-action="tip">تغيير الإكرامية</a>
        </div>
    </div>
</div>

<div class="card-body">
    <p><b>الخدمات:</b></p>
    <ul>${servicesHTML}</ul>
    <p><b>الإجمالي:</b> ${car.totalPrice} ريال</p>
</div>

<div class="card-footer">
    <!-- قائمة الدفع -->
    <div class="dropdown">
        <button class="btn-pay">تحديث الدفع ▼</button>
        <div class="dropdown-content pay-menu" data-plate="${car.plate}">
            <a href="#" data-method="كاش">دفع كاش</a>
            <a href="#" data-method="شبكة">دفع شبكة</a>
            <a href="#" data-method="جزئي">دفع جزئي</a>
        </div>
    </div>
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

    // قائمة الدفع
    if (e.target.matches(".pay-menu a")) {
        e.preventDefault();
        selectedPlate = e.target.parentElement.dataset.plate;
        const method = e.target.dataset.method;
        openPaymentModal(method);
    }

    // قائمة التعديل
    if (e.target.matches(".edit-menu a")) {
        e.preventDefault();
        selectedPlate = e.target.parentElement.dataset.plate;
        const action = e.target.dataset.action;
        handleEditAction(action, selectedPlate);
    }
});

/* ===========================
   مودال الدفع
=========================== */
function openPaymentModal(method) {
    el("modal").style.display = "block";

    const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);

    const totalRequired = visitRows.reduce(
        (sum, v) => sum + Number(v.data[7] || 0),
        0
    );

    el("modal_total").textContent = totalRequired + " ريال";
    el("modal_method").textContent = method;

    el("modal_cash").value = "";
    el("modal_card").value = "";

    el("cash_box").style.display = "none";
    el("card_box").style.display = "none";

    if (method === "كاش") {
        el("cash_box").style.display = "block";
        el("modal_cash").value = totalRequired;
    }

    if (method === "شبكة") {
        el("card_box").style.display = "block";
        el("modal_card").value = totalRequired;
    }

    if (method === "جزئي") {
        el("cash_box").style.display = "block";
        el("card_box").style.display = "block";
    }

    el("modal_confirm").onclick = () => submitPayment(method);
}

function closeModal() {
    el("modal").style.display = "none";
}

/* ===========================
   تحديث الدفع
=========================== */
async function submitPayment(method) {
    const cash = Number(el("modal_cash").value || 0);
    const card = Number(el("modal_card").value || 0);

    const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);

    const totalRequired = visitRows.reduce(
        (sum, v) => sum + Number(v.data[7] || 0),
        0
    );

    let totalPaid = cash + card;

    if (method !== "جزئي") {
        totalPaid = method === "كاش" ? cash : card;
    }

    if (totalPaid !== totalRequired) {
        showToast(`المبلغ يجب أن يكون ${totalRequired} ريال`, "error");
        return;
    }

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
   تبويب: تبديل خدمة
=========================== */
function loadSwapTab() {
    const sel = el("swapServiceSelect");
    sel.innerHTML = "";

    // تحميل جميع الخدمات
    servicesData.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.service;
        opt.textContent = `${s.service} — ${s.price} ريال`;
        opt.dataset.price = s.price;
        sel.appendChild(opt);
    });

    // عند الضغط على تأكيد التبديل
    el("swapConfirm").onclick = async () => {
        const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);

        if (!visitRows.length) {
            showToast("لا توجد خدمات لهذه السيارة", "error");
            return;
        }

        const row = visitRows[0]; // أول خدمة فقط

        const newService = sel.value;
        const newPrice = Number(sel.selectedOptions[0].dataset.price);

        await apiUpdateRow("Visits", row.row, {
            service_detail: newService,
            price: newPrice
        });

        showToast("تم تبديل الخدمة", "success");
        loadActiveVisits();
    };
}

/* ===========================
   فتح مودال التعديل
=========================== */
function handleEditAction(action, plate) {
    selectedPlate = plate;
    openEditModal();
}

/* ===========================
   تشغيل مودال التعديل
=========================== */
function openEditModal() {
    el("editModal").style.display = "block";

    loadSwapTab();
    loadDeleteTab();
    loadAddTab();
    loadEmpTab();
}

/* ===========================
   إغلاق المودال
=========================== */
el("editClose").onclick = () => {
    el("editModal").style.display = "none";
};

/* ===========================
   التبويبات
=========================== */
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

        btn.classList.add("active");
        el(btn.dataset.tab).classList.add("active");
    };
});

/* ===========================
   تبويب: تبديل خدمة
=========================== */
function loadSwapTab() {
    const sel = el("swapServiceSelect");
    sel.innerHTML = "";

    servicesData.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.service;
        opt.textContent = `${s.service} — ${s.price} ريال`;
        opt.dataset.price = s.price;
        sel.appendChild(opt);
    });

    el("swapConfirm").onclick = async () => {
        const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);
        const row = visitRows[0];

        const newService = sel.value;
        const newPrice = Number(sel.selectedOptions[0].dataset.price);

        await apiUpdateRow("Visits", row.row, {
            service_detail: newService,
            price: newPrice
        });

        showToast("تم تبديل الخدمة", "success");
        loadActiveVisits();
    };
}

/* ===========================
   تبويب: حذف خدمة
=========================== */
function loadDeleteTab() {
    const sel = el("deleteServiceSelect");
    sel.innerHTML = "";

    const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);

    visitRows.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.row;
        opt.textContent = `${v.data[6]} — ${v.data[7]} ريال`;
        sel.appendChild(opt);
    });

    el("deleteConfirm").onclick = async () => {
        const rowId = sel.value;

        await apiDeleteRow("Visits", rowId);

        showToast("تم حذف الخدمة", "success");
        loadActiveVisits();
    };
}

/* ===========================
   تبويب: إضافة خدمة
=========================== */
function loadAddTab() {
    const sel = el("addServiceSelect");
    sel.innerHTML = "";

    servicesData.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.service;
        opt.textContent = `${s.service} — ${s.price} ريال`;
        opt.dataset.price = s.price;
        sel.appendChild(opt);
    });

    el("addConfirm").onclick = async () => {
        const service = sel.value;
        const price = Number(sel.selectedOptions[0].dataset.price);

        await apiAddVisit({
            plate: selectedPlate,
            service_detail: service,
            price: price,
            service_type: "",
            commission: 0,
            employee: "",
            branch: "",
            discount: 0,
            tip: 0,
            parking_slot: "",
            payment_status: "غير مدفوع",
            payment_method: "",
            CASH_AMOUNT: 0,
            CARD_AMOUNT: 0,
            TOTAL_PAID: 0
        });

        showToast("تم إضافة الخدمة", "success");
        loadActiveVisits();
    };
}

/* ===========================
   تبويب: تغيير الموظف
=========================== */
function loadEmpTab() {
    const sel = el("empSelect");
    sel.innerHTML = "";

    el("employee_in").querySelectorAll("option").forEach(o => {
        if (o.value) {
            const opt = document.createElement("option");
            opt.value = o.value;
            opt.textContent = o.textContent;
            sel.appendChild(opt);
        }
    });

    el("empConfirm").onclick = async () => {
        const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);

        for (const v of visitRows) {
            await apiUpdateRow("Visits", v.row, {
                employee: sel.value
            });
        }

        showToast("تم تحديث الموظف", "success");
        loadActiveVisits();
    };
}

/* ===========================
   تبويب: تغيير الخصم
=========================== */
el("discConfirm").onclick = async () => {
    const newDisc = Number(el("discInput").value || 0);

    const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);

    for (const v of visitRows) {
        await apiUpdateRow("Visits", v.row, {
            discount: newDisc
        });
    }

    showToast("تم تحديث الخصم", "success");
    loadActiveVisits();
};

/* ===========================
   تبويب: تغيير الإكرامية
=========================== */
el("tipConfirm").onclick = async () => {
    const newTip = Number(el("tipInput").value || 0);

    const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);

    for (const v of visitRows) {
        await apiUpdateRow("Visits", v.row, {
            tip: newTip
        });
    }

    showToast("تم تحديث الإكرامية", "success");
    loadActiveVisits();
};

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

        const categories = [...new Set(servicesData.map(s => (s.Category || s.category)))];

        categories.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            typeSelect.appendChild(opt);
        });

        typeSelect.addEventListener("change", () => {
            const cat = typeSelect.value;
            detailSelect.innerHTML = '<option value="">— اختر الخدمة —</option>';

            const filtered = servicesData.filter(s => (s.Category || s.category) === cat);

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
        const employees = res.rows || [];
        const sel = el("employee_in");

        sel.innerHTML = '<option value="">— اختر الموظف —</option>';

        employees.forEach(e => {
            const opt = document.createElement("option");
            opt.value = e[0];
            opt.textContent = e[0];
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
    const category = el("service_type").value;

    if (!detail) {
        showToast("اختر خدمة", "error");
        return;
    }

    if (category === "غسيل") {
        const already = selectedServices.some(s => s.category === "غسيل");
        if (already) {
            showToast("لا يمكن إضافة أكثر من خدمة غسيل لنفس الزيارة", "error");
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
   عرض قائمة الخدمات
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
        btn.addEventListener("click", () => {
            const i = Number(btn.getAttribute("data-i"));
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
   إرسال الزيارة
=========================== */
async function submitVisit() {
    const btn = el("btnSubmitVisit");
    btn.classList.add("btn-loading");
    btn.textContent = "جاري تسجيل الزيارة...";
    btn.disabled = true;

    const plate_numbers = el("plate_numbers").value.trim();
    const plate_letters = el("plate_letters").value.trim();
    const car_type = el("car_type").value;
    const car_model = el("car_model").value;
    const car_size = el("car_size").value;
    const employee_in = el("employee_in").value;
    const branch = el("branch").value;
    const parking_slot = el("parking_slot").value;
    const payment_status = el("payment_status").value.trim();
    const payment_method = el("payment_method").value.trim();
    const discountVal = el("discount").value.trim();
    const tipVal = el("tip").value.trim();

    if (!plate_numbers) {
        showToast("أدخل أرقام اللوحة", "error");
        return resetSubmitButton(btn);
    }

    if (!car_type || !car_model) {
        showToast("اختر نوع وموديل السيارة", "error");
        return resetSubmitButton(btn);
    }

    if (!employee_in) {
        showToast("اختر الموظف", "error");
        return resetSubmitButton(btn);
    }

    if (!selectedServices.length) {
        showToast("أضف خدمة واحدة على الأقل", "error");
        return resetSubmitButton(btn);
    }

    const hasWash = selectedServices.some(s => s.category === "غسيل");
    if (hasWash && !parking_slot) {
        showToast("رقم الموقف مطلوب لخدمات الغسيل", "error");
        return resetSubmitButton(btn);
    }

    const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const discount = Number(discountVal || 0);
    const finalTotal = Math.max(0, total - discount);

    let cash_amount = 0;
    let card_amount = 0;

    if (payment_status === "مدفوع") {
        if (payment_method === "جزئي") {
            cash_amount = Number(el("cash_amount").value || 0);
            card_amount = Number(el("card_amount").value || 0);

            if (cash_amount + card_amount !== finalTotal) {
                showToast(`المبلغ يجب أن يساوي ${finalTotal} ريال`, "error");
                return resetSubmitButton(btn);
            }
        } else if (payment_method === "كاش") {
            cash_amount = finalTotal;
        } else if (payment_method === "شبكة") {
            card_amount = finalTotal;
        }
    }

    try {
        for (const s of selectedServices) {
            await apiAddVisit({
                plate: plate_numbers + " " + plate_letters,
                brand: car_type,
                model: car_model,
                size: car_size,
                service_type: s.category,
                service_detail: s.name,
                price: s.price,
                commission: s.commission,
                employee: employee_in,
                branch,
                discount,
                tip: Number(tipVal || 0),
                parking_slot,
                payment_status,
                payment_method,
                CASH_AMOUNT: cash_amount,
                CARD_AMOUNT: card_amount,
                TOTAL_PAID: cash_amount + card_amount
            });
        }

        showToast("تم تسجيل الزيارة بنجاح", "success");

        // 🔥 التأخير اللي طلبته (0.4 ثانية)
        await new Promise(res => setTimeout(res, 400));

        resetForm();
        loadActiveVisits();

    } catch (err) {
        console.error(err);
        showToast("خطأ أثناء تسجيل الزيارة", "error");
    }

    resetSubmitButton(btn);
}

/* ===========================
   إعادة زر التسجيل
=========================== */
function resetSubmitButton(btn) {
    btn.classList.remove("btn-loading");
    btn.textContent = "تسجيل الزيارة";
    btn.disabled = false;
}

/* ===========================
   إعادة ضبط النموذج
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
    el("tip").value = "";
    el("parking_slot").value = "";
    el("payment_status").value = "";
    el("payment_method").value = "";
    el("cash_amount").value = "";
    el("card_amount").value = "";
    el("partial_payment_box").style.display = "none";

    selectedServices = [];
    renderServicesList();
    recalcTotal();
}

/* ===========================
   تشغيل النظام
=========================== */
window.onload = async () => {
    await loadCarTypes();
    await loadServices();
    await loadEmployees();
    await loadActiveVisits();

    el("btnAddService").onclick = addServiceToList;
    el("btnSubmitVisit").onclick = submitVisit;

    el("payment_status").addEventListener("change", () => {
        const val = el("payment_status").value;
        el("payment_method_wrapper").style.display = val === "مدفوع" ? "block" : "none";
    });

    el("payment_method").addEventListener("change", () => {
        const val = el("payment_method").value;
        el("partial_payment_box").style.display = val === "جزئي" ? "block" : "none";
    });

    el("modal_close").onclick = closeModal;
};


