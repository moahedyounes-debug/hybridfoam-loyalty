/* ===========================================
   رغوة الهجين - إدارة الزيارات
   Visit Manager JS — الجزء (1/3)
=========================================== */

/* ===========================
   المتغيرات العامة
=========================== */
const el = id => document.getElementById(id);

let activeVisits = [];
let selectedPlate = null;
let selectedServices = [];
let carTypesData = [];
let servicesData = [];
let employeesData = [];

/* ===========================
   Toast Notifications
=========================== */
function showToast(msg, type = "info") {
    const box = el("toast-container");
    const div = document.createElement("div");
    div.className = `toast ${type}`;
    div.textContent = msg;
    box.appendChild(div);

    setTimeout(() => div.classList.add("show"), 10);
    setTimeout(() => {
        div.classList.remove("show");
        setTimeout(() => div.remove(), 300);
    }, 3000);
}

/* ===========================
   تحميل الزيارات النشطة
=========================== */
async function loadActiveVisits() {
    const list = el("activeVisitsList");
    list.innerHTML = '<div class="loading">جارِ التحميل...</div>';

    try {
        const res = await apiGetActiveVisits();
        const rows = res.visits || [];
        activeVisits = rows;

        updateSummary(rows);

        if (!rows.length) {
            list.innerHTML = `
                <p style="text-align:center;padding:40px;color:#6b7280;">
                    لا توجد زيارات حالياً
                </p>`;
            return;
        }

        const cars = {};

        for (const v of rows) {
            const r = v.data;

            const plate = String(r[1]).replace(/\s+/g, "").trim();
            const brand = r[3] || "";
            const service = r[6];
            const price = Number(r[7] || 0);
            const emp = r[9] || "غير محدد";
            const parking = r[17];
            const discount = Number(r[24] || 0);

            if (!cars[plate]) {
                cars[plate] = {
                    plate,
                    brand,
                    employee: emp,
                    parking,
                    services: [],
                    total: 0,
                    discount
                };
            }

            cars[plate].services.push({ name: service, price });
            cars[plate].total += price;
        }

        Object.values(cars).forEach(car => {
            car.totalAfterDiscount = car.total - car.discount;
        });

        const fragment = document.createDocumentFragment();

        for (const car of Object.values(cars)) {
            const card = document.createElement("div");
            card.className = "car-card";

            const servicesHTML = car.services
                .map(s => `<li><span>${s.name}</span><span>${s.price} ريال</span></li>`)
                .join("");

            card.innerHTML = `
<div class="card">

    <div class="card-header">
        <h4>لوحة: ${car.plate} — ${car.brand}</h4>
    </div>

    <div class="card-body">
        <p>الموظف: ${car.employee}</p>
        <p>الموقف: ${car.parking}</p>

        <ul class="service-list">
            ${servicesHTML}
        </ul>

        <p><b>الإجمالي قبل الخصم:</b> ${car.total} ريال</p>
        <p><b>الخصم:</b> ${car.discount} ريال</p>
        <p><b>الإجمالي بعد الخصم:</b> ${car.totalAfterDiscount} ريال</p>
    </div>

    <div class="card-footer">

        <div class="dropdown">
            <button class="btn-pay" type="button">💳 تحديث الدفع ▼</button>

            <div class="dropdown-content pay-menu" data-plate="${car.plate}">
                <button data-method="كاش" type="button">💵 دفع كاش</button>
                <button data-method="شبكة" type="button">💳 دفع شبكة</button>
                <button data-method="جزئي" type="button">💰 دفع جزئي</button>
            </div>
        </div>

        <div class="dropdown">
            <button class="edit-btn" type="button">✏️ تعديل ▼</button>

            <div class="dropdown-content edit-menu" data-plate="${car.plate}">
                <button data-action="swap">🔄 تبديل خدمة</button>
                <button data-action="delete">🗑️ حذف خدمة</button>
                <button data-action="add">➕ إضافة خدمة</button>
                <button data-action="emp">👤 تغيير الموظف</button>
                <button data-action="disc">💰 تغيير الخصم</button>
                <button data-action="tip">🎁 تغيير الإكرامية</button>
            </div>
        </div>

    </div>

</div>
`;

            fragment.appendChild(card);
        }

        list.innerHTML = "";
        list.appendChild(fragment);

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل الزيارات", "error");
    }
}
/* ===========================
   تحديث شريط الملخص
=========================== */
function updateSummary(rows) {
    const uniquePlates = new Set(rows.map(v => v.data[1])).size;
    const totalAmount = rows.reduce((sum, v) => sum + Number(v.data[7] || 0), 0);

    el("summaryActive").textContent = rows.length;
    el("summaryCars").textContent = uniquePlates;
    el("summaryTotal").textContent = totalAmount + " ريال";
}
/* ===========================
   مودال الدفع (النسخة النهائية بعد الإصلاح)
=========================== */
function openPaymentModal(plate) {
    selectedPlate = plate;

    const rows = activeVisits.filter(v => v.data && String(v.data[1]) === String(plate));
    if (!rows.length) {
        showToast("لا توجد بيانات لهذه اللوحة", "error");
        return;
    }

    const prices = rows.map(v => Number(v.data[7] || 0));
    const totalBeforeDiscount = prices.reduce((a, b) => a + b, 0);

    const oldTip = Number(rows[0].data[23] || 0);
    const oldDiscount = Number(rows[0].data[24] || 0);

    el("modal_total_before").textContent = totalBeforeDiscount + " ريال";
    el("modal_discount").textContent = oldDiscount + " ريال";
    el("modal_tip").textContent = oldTip + " ريال";

    el("modal_discount_input").value = oldDiscount;
    el("modal_tip_input").value = oldTip;

    const updateTotals = () => {
        const d = Number(el("modal_discount_input").value || 0);
        const after = totalBeforeDiscount - d;
        el("modal_total_after").textContent = after + " ريال";
    };

    updateTotals();
    el("modal_discount_input").oninput = updateTotals;

    el("cash_box").style.display = "none";
    el("card_box").style.display = "none";
    el("modal_cash").value = "";
    el("modal_card").value = "";

    el("modal_method_select").onchange = () => {
        const method = el("modal_method_select").value;
        if (method === "جزئي") {
            el("cash_box").style.display = "block";
            el("card_box").style.display = "block";
        } else {
            el("cash_box").style.display = "none";
            el("card_box").style.display = "none";
        }
    };
    el("modal_method_select").dispatchEvent(new Event("change"));

    el("paymentModal").classList.add("show");

    // ✅ نمرّر كل القيم المطلوبة لـ submitPayment
    el("modal_confirm").onclick = () => {
        const method = el("modal_method_select").value;
        const newDiscount = Number(el("modal_discount_input").value || 0);
        const newTip = Number(el("modal_tip_input").value || 0);
        const totalAfter = totalBeforeDiscount - newDiscount;

        submitPayment({
            method,
            totalAfter,
            discount: newDiscount,
            tip: newTip
        });
    };
}

/* ===========================
   تنفيذ الدفع (نسخة آمنة)
=========================== */
async function submitPayment({ method, totalAfter, discount, tip }) {
    const btn = el("modal_confirm");
    btn.disabled = true;
    btn.textContent = "جاري المعالجة...";

    let cash = 0, card = 0;

    if (method === "كاش") {
        cash = totalAfter;
    } else if (method === "شبكة") {
        card = totalAfter;
    } else if (method === "جزئي") {
        cash = Number(el("modal_cash").value || 0);
        card = Number(el("modal_card").value || 0);

        if (cash + card !== totalAfter) {
            showToast(`المبلغ يجب أن يكون ${totalAfter} ريال`, "error");
            btn.disabled = false;
            btn.textContent = "تأكيد";
            return;
        }
    }

    const rows = activeVisits.filter(v => v.data && String(v.data[1]) === String(selectedPlate));
    if (!rows.length) {
        showToast("خطأ: لا توجد بيانات", "error");
        btn.disabled = false;
        btn.textContent = "تأكيد";
        return;
    }

    try {
        await api_closeVisit(rows[0].row, {
            payment_method: method,
            CASH_AMOUNT: cash,
            CARD_AMOUNT: card,
            TOTAL_PAID: totalAfter,
            tip: tip,
            discount: discount
        });

        showToast("تم تحديث الدفع بنجاح", "success");
        closePaymentModal();
        loadActiveVisits();
    } catch (err) {
        console.error(err);
        showToast("خطأ في تحديث الدفع", "error");
    }

    btn.disabled = false;
    btn.textContent = "تأكيد";
}

/* ===========================
   مودال التعديل
=========================== */
function openEditModal(plate) {

    selectedPlate = String(plate).replace(/\s+/g, "").trim();

    el("editModal").classList.add("show");

    loadSwapTab();
    loadDeleteTab();
    loadAddTab();
    loadEmpTab();
}

function closeEditModal() {
    el("editModal").classList.remove("show");
}
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
========================== */
function loadSwapTab() {

    const oldSel = el("swapOldServiceSelect");
    oldSel.innerHTML = "";

    const rows = activeVisits.filter(v =>
        String(v.data[1]).replace(/\s+/g, "").trim() ===
        String(selectedPlate).replace(/\s+/g, "").trim()
    );

    rows.forEach(v => {
        const serviceName = v.data[6] || "";
        const price = Number(v.data[7] || 0);

        if (serviceName.trim() !== "") {
            const opt = document.createElement("option");
            opt.value = v.row;
            opt.textContent = `${serviceName} — ${price} ريال`;
            oldSel.appendChild(opt);
        }
    });

    const newSel = el("swapNewServiceSelect");
    newSel.innerHTML = "";

    servicesData.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.service;
        opt.textContent = `${s.service} — ${s.price} ريال`;
        opt.dataset.price = s.price;
        newSel.appendChild(opt);
    });

el("swapConfirm").onclick = async () => {

    const btn = el("swapConfirm");
    btn.disabled = true;
    btn.textContent = "جاري التبديل...";

    const oldRow = oldSel.value;
    const newService = newSel.value;
    const newPrice = Number(newSel.selectedOptions[0].dataset.price);

    const res = await apiUpdateRow("Visits", oldRow, {
        service_detail: newService,
        price: newPrice
    });

    btn.disabled = false;
    btn.textContent = "تأكيد التبديل";

    if (!res || res.success !== true) {
        showToast("فشل التبديل — تحقق من الاتصال", "error");
        return;
    }

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

    const rows = activeVisits.filter(v =>
        String(v.data[1]).replace(/\s+/g, "").trim() ===
        String(selectedPlate).replace(/\s+/g, "").trim()
    );

    if (!rows.length) return;

    rows.forEach(v => {
        const serviceName = v.data[6] || "";
        const price = Number(v.data[7] || 0);

        if (serviceName.trim() !== "") {
            const opt = document.createElement("option");
            opt.value = v.row;
            opt.textContent = `${serviceName} — ${price} ريال`;
            sel.appendChild(opt);
        }
    });

    el("deleteConfirm").onclick = async () => {
        if (!sel.value) return;

        el("deleteConfirm").disabled = true;
        el("deleteConfirm").textContent = "جاري الحذف...";

        await apiDeleteRow("Visits", sel.value);

        el("deleteConfirm").disabled = false;
        el("deleteConfirm").textContent = "حذف الخدمة";

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
        opt.dataset.points = s.commission;
        sel.appendChild(opt);
    });

    el("addConfirm").onclick = async () => {

        const btn = el("addConfirm");
        btn.disabled = true;
        btn.textContent = "جاري الإضافة...";

        const service = sel.value;
        const price = Number(sel.selectedOptions[0].dataset.price);
        const points = Number(sel.selectedOptions[0].dataset.points);

/* ===========================
   🔥 منع إضافة أكثر من غسيل
=========================== */

const selectedServiceObj = servicesData.find(s => s.service === service);
const isWash = selectedServiceObj && selectedServiceObj.category === "غسيل";

if (isWash) {

    const hasWash = activeVisits.some(v => {
        const existingServiceName = v.data[6]; // اسم الخدمة
        const existingServiceObj = servicesData.find(s => s.service === existingServiceName);

        return (
            String(v.data[1]).replace(/\s+/g, "").trim() === String(selectedPlate).trim() &&
            existingServiceObj &&
            existingServiceObj.category === "غسيل"
        );
    });

    if (hasWash) {
        btn.disabled = false;
        btn.textContent = "إضافة الخدمة";
        showToast("لا يمكن إضافة أكثر من خدمة غسيل لنفس السيارة", "error");
        return;
    }
}

        /* ===========================
           إضافة الخدمة
        ============================ */

const res = await apiAddRow("Visits", {
    membership: "",
    plate_numbers: selectedPlate,
    plate_letters: "",
    car_type: "",
    car_model: "",
    car_size: "",
    service_detail: service,
    price: price,
    points: points,
    employee_in: "",
    employee_out: "",
    branch: "",
    commission: points,   // ←🔥 العمولة الصحيحة
    check_in: "",
    check_out: "",
    payment_status: "غير مدفوع",
    payment_method: "",
    parking_slot: "",
    rating: "",
    payment_method_copy: "",
    CASH_AMOUNT: "",
    CARD_AMOUNT: "",
    TOTAL_PAID: "",
    tip: "",
    discount: ""
});

        btn.disabled = false;
        btn.textContent = "إضافة الخدمة";

        if (!res || res.success !== true) {
            showToast("فشل إضافة الخدمة — تحقق من الاتصال", "error");
            return;
        }

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

    employeesData.forEach(e => {
        const opt = document.createElement("option");
        opt.value = e[0];
        opt.textContent = e[0];
        sel.appendChild(opt);
    });

el("empConfirm").onclick = async () => {

    const btn = el("empConfirm");
    btn.disabled = true;
    btn.textContent = "جاري التحديث...";

    const rows = activeVisits.filter(v =>
        String(v.data[1]).replace(/\s+/g, "").trim() ===
        String(selectedPlate).replace(/\s+/g, "").trim()
    );

    let ok = true;

    for (const v of rows) {
        const res = await apiUpdateRow("Visits", v.row, {
            employee_in: sel.value
        });

        if (!res || res.success !== true) {
            ok = false;
        }
    }

    btn.disabled = false;
    btn.textContent = "تغيير الموظف";

    if (!ok) {
        showToast("فشل تحديث الموظف — تحقق من الاتصال", "error");
        return;
    }

    showToast("تم تحديث الموظف", "success");
    loadActiveVisits();
    };
}
/* ===========================
   تبويب: تغيير الخصم
=========================== */
el("discConfirm").onclick = async () => {
    const val = Number(el("discInput").value || 0);

    await api_updateVisit({
        plate_numbers: selectedPlate,
        discount: val
    });

    showToast("تم تحديث الخصم", "success");
    loadActiveVisits();
};

/* ===========================
   تبويب: تغيير الإكرامية
=========================== */
el("tipConfirm").onclick = async () => {
    const val = Number(el("tipInput").value || 0);

    await api_updateVisit({
        plate_numbers: selectedPlate,
        tip: val
    });

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

        const brandSel = el("car_type");
        const modelSel = el("car_model");
        const sizeInput = el("car_size");

        brandSel.innerHTML = '<option value="">— اختر البراند —</option>';
        modelSel.innerHTML = '<option value="">— اختر الموديل —</option>';
        sizeInput.value = "";

        const brands = [...new Set(carTypesData.map(r => r[0]))];

        brands.forEach(b => {
            const opt = document.createElement("option");
            opt.value = b;
            opt.textContent = b;
            brandSel.appendChild(opt);
        });

        brandSel.onchange = () => {
            const brand = brandSel.value;
            modelSel.innerHTML = '<option value="">— اختر الموديل —</option>';

            const models = carTypesData.filter(r => r[0] === brand);
            const uniqueModels = [...new Set(models.map(r => r[1]))];

            uniqueModels.forEach(m => {
                const opt = document.createElement("option");
                opt.value = m;
                opt.textContent = m;
                modelSel.appendChild(opt);
            });
        };

        modelSel.onchange = () => {
            const brand = brandSel.value;
            const model = modelSel.value;

            const row = carTypesData.find(r => r[0] === brand && r[1] === model);
            sizeInput.value = row ? row[2] : "";
        };

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

        const typeSel = el("service_type");
        const detailSel = el("service_detail");

        typeSel.innerHTML = '<option value="">— اختر النوع —</option>';
        detailSel.innerHTML = '<option value="">— اختر الخدمة —</option>';

        const cats = [...new Set(servicesData.map(s => s.category))];

        cats.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            typeSel.appendChild(opt);
        });

        typeSel.onchange = () => {
            const cat = typeSel.value;
            detailSel.innerHTML = '<option value="">— اختر الخدمة —</option>';

            const filtered = servicesData.filter(s => s.category === cat);

            filtered.forEach(s => {
                const opt = document.createElement("option");
                opt.value = s.service;
                opt.textContent = s.service;
                opt.dataset.price = s.price;
                opt.dataset.points = s.commission;
                detailSel.appendChild(opt);
            });
        };

        detailSel.onchange = () => {
            const opt = detailSel.selectedOptions[0];
            if (opt) {
                el("price").value = opt.dataset.price || "";
                el("points").value = opt.dataset.points || "";
            }
        };

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل الخدمات", "error");
    }
}

/* ===========================
   تحميل الفروع
=========================== */
async function loadBranches() {
    try {
        const res = await apiGetBranches();
        const rows = res.rows || [];

        const sel = el("branch");
        sel.innerHTML = '<option value="">— اختر الفرع —</option>';

        rows.forEach(r => {
            const opt = document.createElement("option");
            opt.value = r[0];
            opt.textContent = r[0];
            sel.appendChild(opt);
        });

        // القيمة الافتراضية
        if ([...sel.options].some(o => o.value === "مكة")) {
            sel.value = "مكة";
        }

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل الفروع", "error");
    }
}

/* ===========================
   تحميل الموظفين
=========================== */
async function loadEmployees() {
    try {
        const res = await apiGetEmployees();
        employeesData = res.rows || [];

        const sel = el("employee_in");
        sel.innerHTML = '<option value="">— اختر الموظف —</option>';

        employeesData.forEach(e => {
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
   إضافة خدمة للزيارة
=========================== */
function addServiceToList() {
    const name = el("service_detail").value;
    const price = Number(el("price").value || 0);
    const points = Number(el("points").value || 0);
    const category = el("service_type").value;

    if (!name) {
        showToast("اختر خدمة أولاً", "warning");
        return;
    }

    // 🔥 منع تكرار الخدمة (ما عدا المبيعات)
    if (category !== "مبيعات") {
        const exists = selectedServices.some(s => s.name === name);
        if (exists) {
            showToast("هذه الخدمة مضافة مسبقاً", "warning");
            return;
        }
    }

    // إضافة الخدمة
    selectedServices.push({ name, price, points, category });

    renderServicesList();
    recalcTotal();

    // إعادة ضبط الحقول
    el("service_type").value = "";
    el("service_detail").innerHTML = '<option value="">— اختر الخدمة —</option>';
    el("price").value = "";
    el("points").value = "";

    showToast("تم إضافة الخدمة", "success");
}

/* ===========================
   عرض الخدمات المضافة
=========================== */
function renderServicesList() {
    const box = el("servicesList");
    box.innerHTML = "";

    if (!selectedServices.length) {
        box.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:20px;">لم تُضف أي خدمات بعد</p>';
        return;
    }

    selectedServices.forEach((s, i) => {
        const div = document.createElement("div");
        div.className = "service-item";

        div.innerHTML = `
            <span>${s.name} — ${s.price} ريال</span>
            <button data-i="${i}" class="btn-remove">✕</button>
        `;

        box.appendChild(div);
    });

    box.querySelectorAll(".btn-remove").forEach(btn => {
        btn.onclick = () => {
            const index = Number(btn.dataset.i);
            const removed = selectedServices.splice(index, 1)[0];

            showToast(`تم حذف ${removed.name}`, "info");

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
    const finalTotal = Math.max(0, total - discount);

    el("totalPrice").textContent = finalTotal;
}

/* ===========================
   تسجيل الزيارة (نسخة محسّنة)
=========================== */
async function submitVisit() {

const btn = el("btnSubmitVisit");
if (btn) {
    btn.disabled = true;
    btn.textContent = "جاري تسجيل الزيارة...";
}

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

    /* ===========================
       التحقق من الحقول
    ============================ */

    if (!plate_numbers) return resetBtn("أدخل أرقام اللوحة (إجباري)");
    if (!plate_letters) return resetBtn("أدخل حروف اللوحة (إجباري)");
    if (!selectedServices.length) return resetBtn("أضف خدمة واحدة على الأقل");
    if (!car_type || !car_model) return resetBtn("اختر نوع وموديل السيارة");
    if (!employee_in) return resetBtn("اختر الموظف");
    if (!branch) return resetBtn("اختر الفرع");
    if (!parking_slot) return resetBtn("اختر رقم الموقف");
    if (!payment_status) return resetBtn("اختر حالة الدفع");
    if (payment_status === "مدفوع" && !payment_method) return resetBtn("اختر طريقة الدفع");

    /* ===========================
       الحسابات
    ============================ */

    const discount = Number(el("discount").value || 0);
    const tip = Number(el("tip").value || 0);

    const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const finalTotal = Math.max(0, total - discount);

    let cash = 0, card = 0;

    if (payment_status === "مدفوع") {

        if (payment_method === "كاش") cash = finalTotal;
        if (payment_method === "شبكة") card = finalTotal;

        if (payment_method === "جزئي") {
            cash = Number(el("cash_amount").value || 0);
            card = Number(el("card_amount").value || 0);

            if (cash + card !== finalTotal) {
                return resetBtn(`المبلغ يجب أن يكون ${finalTotal} ريال`);
            }
        }
    }

    const membership = plate_numbers;

  /* ===========================
   إرسال البيانات
=========================== */

try {
    await apiAddVisit({
        membership,
        plate_numbers,
        plate_letters,
        car_type,
        car_model,
        car_size,
        employee_in,
        branch,
        parking_slot,
        payment_status,
        payment_method,
        discount,
        tip,
        cash_amount: cash,
        card_amount: card,

services: JSON.stringify(
    selectedServices.map(s => ({
        name: s.name,
        price: s.price,
        points: Math.floor(s.price / 5),
        commission: s.commission
    }))
)

    });

    showToast("تم تسجيل الزيارة بنجاح", "success");
    resetForm();
    loadActiveVisits();

} catch (err) {
    console.error(err);
    showToast("خطأ أثناء تسجيل الزيارة", "error");
}

// إعادة تفعيل الزر بعد الانتهاء
btn.disabled = false;
btn.textContent = "تسجيل الزيارة";


    /* ===========================
       دالة مساعدة لإعادة الزر
    ============================ */
    function resetBtn(msg) {
        showToast(msg, "warning");
        btn.disabled = false;
        btn.textContent = "تسجيل الزيارة";
        return;
    }
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
    el("discount").value = "0";
    el("tip").value = "0";

    // إزالة اسم الموظف
    el("employee_in").value = "";

    el("parking_slot").value = "";
    el("payment_status").value = "";
    el("payment_method").value = "";
    el("cash_amount").value = "";
    el("card_amount").value = "";

    el("partial_payment_box").style.display = "none";
    el("payment_method_wrapper").style.display = "none";

    selectedServices = [];
    renderServicesList();
    recalcTotal();
}

/* ===========================
   Event Delegation
=========================== */
document.addEventListener("click", function (e) {

    /* إغلاق أي قائمة مفتوحة عند الضغط خارجها */
    if (!e.target.closest(".dropdown")) {
        document.querySelectorAll(".dropdown-content").forEach(menu => {
            menu.classList.remove("show");
        });
    }

    /* فتح قائمة التعديل */
    if (e.target.classList.contains("edit-btn")) {
        const dropdown = e.target.nextElementSibling;

        document.querySelectorAll(".dropdown-content").forEach(m => {
            if (m !== dropdown) m.classList.remove("show");
        });

        dropdown.classList.toggle("show");
        return;
    }

    /* فتح قائمة الدفع */
    if (e.target.classList.contains("btn-pay")) {
        const dropdown = e.target.nextElementSibling;

        document.querySelectorAll(".dropdown-content").forEach(m => {
            if (m !== dropdown) m.classList.remove("show");
        });

        dropdown.classList.toggle("show");
        return;
    }

    /* اختيار طريقة الدفع (زر داخل pay-menu) */
    if (e.target.matches(".pay-menu button")) {

        const plate = e.target.parentElement.dataset.plate;
        const method = e.target.dataset.method;

        selectedPlate = plate;

        openPaymentModal(plate);

        el("modal_method_select").value = method;

        e.target.parentElement.classList.remove("show");
        return;
    }

/* اختيار إجراء التعديل (زر داخل edit-menu) */
if (e.target.matches(".edit-menu button")) {

    const plate = e.target.parentElement.dataset.plate;
    const action = e.target.dataset.action;

    selectedPlate = plate;

    // هنا كان الخطأ
    openEditModal(plate);

    e.target.parentElement.classList.remove("show");
    return;
}
});

/* ===========================
   تشغيل النظام عند التحميل
=========================== */
window.onload = async function () {
    try {
        await Promise.all([
            loadCarTypes(),
            loadServices(),
            loadEmployees(),
            loadBranches()
        ]);

        await loadActiveVisits();

        el("btnAddService").onclick = addServiceToList;
        el("btnSubmitVisit").onclick = submitVisit;
        el("btnRefreshActive").onclick = loadActiveVisits;

        el("payment_status").onchange = function () {
            el("payment_method_wrapper").style.display =
                this.value === "مدفوع" ? "block" : "none";
        };

        el("payment_method").onchange = function () {
            el("partial_payment_box").style.display =
                this.value === "جزئي" ? "block" : "none";
        };

        el("payment_modal").onclick = payment_modal;
        el("modal_close").onclick = payment_modal;
        el("editClose").onclick = closeEditModal;

        el("discount").oninput = recalcTotal;

        showToast("تم تحميل النظام بنجاح", "success");

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل البيانات", "error");
    }
};
