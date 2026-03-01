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
/* ===========================
   تحديث ملخص الزيارات
=========================== */
function updateSummary(rows) {
    const total = rows.length;
    const paid = rows.filter(v => v.data[16] === "مدفوع").length;
    const unpaid = total - paid;

    el("sum_total").textContent = total;
    el("sum_paid").textContent = paid;
    el("sum_unpaid").textContent = unpaid;
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
            car.total_paidDiscount = car.total - car.discount;
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
        <p><b>الإجمالي بعد الخصم:</b> ${car.total_paidDiscount} ريال</p>
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
function openPaymentModal(plate) {
    selectedPlate = plate;

    // كل الخدمات لنفس اللوحة
    const rows = activeVisits.filter(v => v.data && String(v.data[1]) === String(plate));
    if (!rows.length) {
        showToast("لا توجد بيانات لهذه اللوحة", "error");
        return;
    }

    // إجمالي السعر قبل الخصم
    const totalBefore = rows.reduce((sum, r) => sum + Number(r.data[7] || 0), 0);

    // الخصم القديم (مجموع كل الخدمات)
    const oldDiscount = rows.reduce((sum, r) => sum + Number(r.data[24] || 0), 0);

    // الإكرامية القديمة
    const oldTip = rows.reduce((sum, r) => sum + Number(r.data[23] || 0), 0);

    // تعبئة المودال
    el("modal_total_before").textContent = totalBefore + " ريال";
    el("modal_discount_input").value = oldDiscount;
    el("modal_tip_input").value = oldTip;

    const updateTotals = () => {
        const d = Number(el("modal_discount_input").value || 0);
        const totalAfter = Math.max(0, totalBefore - d);
        el("modal_total_after").textContent = totalAfter + " ريال";
    };

    updateTotals();
    el("modal_discount_input").oninput = updateTotals;

    // إخفاء حقول الدفع الجزئي
    el("cash_box").style.display = "none";
    el("card_box").style.display = "none";
    el("modal_cash").value = "";
    el("modal_card").value = "";

    el("modal_method_select").onchange = () => {
        const method = el("modal_method_select").value;
        const show = method === "جزئي";
        el("cash_box").style.display = show ? "block" : "none";
        el("card_box").style.display = show ? "block" : "none";
    };

    el("modal_method_select").dispatchEvent(new Event("change"));

    el("paymentModal").classList.add("show");

    el("modal_confirm").onclick = () => {
        const method = el("modal_method_select").value;
        const newDiscount = Number(el("modal_discount_input").value || 0);
        const newTip = Number(el("modal_tip_input").value || 0);
        const total_paid = Math.max(0, totalBefore - newDiscount);

        submitPayment({
            method,
            total_paid,
            discount: newDiscount,
            tip: newTip
        });
    };
}

/* ===========================
   تحديث الدفع 
=========================== */

async function submitPayment({ method, total_paid, discount, tip }) {
    const btn = el("modal_confirm");
    btn.disabled = true;
    btn.textContent = "جاري المعالجة...";

    let cash = 0, card = 0;

    if (method === "كاش") {
        cash = total_paid;
    } else if (method === "شبكة") {
        card = total_paid;
    } else if (method === "جزئي") {
        cash = Number(el("modal_cash").value || 0);
        card = Number(el("modal_card").value || 0);

        if (cash + card !== total_paid) {
            showToast(`المبلغ يجب أن يكون ${total_paid} ريال`, "error");
            btn.disabled = false;
            btn.textContent = "تأكيد";
            return;
        }
    }

    // كل الصفوف الخاصة باللوحة
    const rows = activeVisits.filter(v => v.data && String(v.data[1]) === String(selectedPlate));
    if (!rows.length) {
        showToast("خطأ: لا توجد بيانات", "error");
        btn.disabled = false;
        btn.textContent = "تأكيد";
        return;
    }

    try {
        await apiCloseVisit(
            rows.map(r => r.row),   // ← نرسل كل الصفوف
            {
                payment_method: method,
                cash_amount: cash,
                card_amount: card,
                total_paid,
                tip,
                discount
            }
        );

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
   إغلاق مودال الدفع
=========================== */
function closePaymentModal() {
    el("paymentModal").classList.remove("show");
}
   
// إغلاق مودال الدفع
el("modal_close").onclick = closePaymentModal;

/* ===========================
   مودال التعديل
=========================== */
function openEditModal(plate, action) {

    selectedPlate = String(plate).replace(/\s+/g, "").trim();

    // افتح المودال
    el("editModal").classList.add("show");

    // أخفِ كل التابات
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

    // ألغِ تفعيل كل الأزرار
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));

    // حدّد التاب المطلوب
    let tabId = "";

    if (action === "swap") tabId = "tab-swap";
    if (action === "delete") tabId = "tab-delete";
    if (action === "add") tabId = "tab-add";
    if (action === "emp") tabId = "tab-emp";
    if (action === "disc") tabId = "tab-disc";
    if (action === "tip") tabId = "tab-tip";

    // فعّل التاب
    el(tabId).classList.add("active");

    // فعّل زر التاب
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add("active");

    // تحميل بيانات التاب
    loadSwapTab();
    loadDeleteTab();
    loadAddTab();
    loadEmpTab();
}
/* ===========================
   تبويب: تبديل الخدمة
=========================== */
function loadSwapTab() {

    const oldSel = el("oldServiceSelect");
    const newSel = el("newServiceSelect");

    // تعبئة الخدمات الحالية
    oldSel.innerHTML = "";
    const rows = activeVisits.filter(v =>
        String(v.data[1]).replace(/\s+/g, "").trim() === selectedPlate
    );
    rows.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.row;
        opt.textContent = r.data[6]; // service_detail
        oldSel.appendChild(opt);
    });

    // تعبئة الخدمات الجديدة
    newSel.innerHTML = "";
    servicesData.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.service;
        opt.textContent = s.service;
        newSel.appendChild(opt);
    });

    el("swapConfirm").onclick = async () => {

        const row = Number(oldSel.value);
        const newService = newSel.value;

        const svc = servicesData.find(s => s.service === newService);

        await apiUpdateRow("Visits", row, {
            SERVICE: svc.service,
            PRICE: svc.price,
            POINTS: svc.commission,
            COMMISSION: svc.commission
        });

        showToast("تم تبديل الخدمة", "success");
        loadActiveVisits();
    };
}

/* ===========================
   تبويب: تبديل الخدمة (نسخة صحيحة)
=========================== */
function loadSwapTab() {

    const oldSel = el("oldServiceSelect");
    const newSel = el("newServiceSelect");

    oldSel.innerHTML = "";
    newSel.innerHTML = "";

    /* ===========================
       تحميل الخدمات الحالية للسيارة
    ============================ */
    const rows = activeVisits.filter(v =>
        String(v.data[1]).replace(/\s+/g, "").trim() === selectedPlate
    );

    rows.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.row;          // رقم الصف
        opt.textContent = r.data[6]; // اسم الخدمة الحالية
        oldSel.appendChild(opt);
    });

    /* ===========================
       تحميل قائمة الخدمات الجديدة
    ============================ */
    servicesData.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.service;
        opt.textContent = `${s.service} — ${s.price} ريال`;
        newSel.appendChild(opt);
    });

    /* ===========================
       تنفيذ التبديل
    ============================ */
    el("swapConfirm").onclick = async () => {

        const row = Number(oldSel.value);
        const newServiceName = newSel.value;

        const svc = servicesData.find(s => s.service === newServiceName);

        if (!svc) {
            showToast("الخدمة غير موجودة", "error");
            return;
        }

        await apiUpdateRow("Visits", row, {
            SERVICE: svc.service,
            PRICE: svc.price,
            POINTS: svc.commission,
            COMMISSION: svc.commission
        });

        showToast("تم تبديل الخدمة بنجاح", "success");
        loadActiveVisits();
    };
}

/* ===========================
   تبويب: إضافة خدمة (نسخة صحيحة)
=========================== */
function loadAddTab() {

    const sel = el("addServiceSelect");
    sel.innerHTML = "";

    // تحميل قائمة الخدمات
    servicesData.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.service;
        opt.textContent = `${s.service} — ${s.price} ريال`;
        opt.dataset.price = s.price;
        opt.dataset.points = s.commission;
        opt.dataset.category = s.category;
        sel.appendChild(opt);
    });

    el("addConfirm").onclick = async () => {

        const btn = el("addConfirm");
        btn.disabled = true;
        btn.textContent = "جاري الإضافة...";

        const service = sel.value;
        const price = Number(sel.selectedOptions[0].dataset.price);
        const points = Number(sel.selectedOptions[0].dataset.points);
        const category = sel.selectedOptions[0].dataset.category;

        /* ===========================
           🔥 منع إضافة أكثر من غسيل
        ============================ */
        if (category === "غسيل") {

            const hasWash = activeVisits.some(v => {
                const existingServiceName = v.data[6];
                const existingServiceObj = servicesData.find(s => s.service === existingServiceName);

                return (
                    String(v.data[1]).replace(/\s+/g, "").trim() === selectedPlate &&
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
           🔥 جلب بيانات السيارة من أول صف
        ============================ */
        const base = activeVisits.find(v =>
            String(v.data[1]).replace(/\s+/g, "").trim() === selectedPlate
        ).data;

        /* ===========================
           🔥 إضافة الخدمة فعليًا
        ============================ */
        const res = await apiAddRow("Visits", {
            MEMBERSHIP: base[0],
            PLATE_NUMBERS: base[1],
            PLATE_LETTERS: base[2],
            CAR_TYPE: base[3],
            CAR_MODEL: base[4],
            CAR_SIZE: base[5],
            SERVICE: service,
            PRICE: price,
            POINTS: points,
            EMP_IN: base[9],
            EMP_OUT: "",
            BRANCH: base[11],
            COMMISSION: points,
            CHECK_IN: base[13],
            CHECK_OUT: "",
            PAY_STATUS: "غير مدفوع",
            PAY_METHOD: "",
            PARKING: base[17],
            RATING: "",
            PAY_METHOD_COPY: "",
            CASH_AMOUNT: "",
            CARD_AMOUNT: "",
            TOTAL_PAID: "",
            TIP: 0,
            DISCOUNT: 0
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
   تبويب: تغيير الموظف (نسخة صحيحة)
=========================== */
function loadEmpTab() {

    const sel = el("empSelect");
    sel.innerHTML = "";

    // تعبئة قائمة الموظفين بشكل صحيح
    employeesData.forEach(emp => {
        const opt = document.createElement("option");
        opt.value = emp[0];        // اسم الموظف
        opt.textContent = emp[0];  // اسم الموظف
        sel.appendChild(opt);
    });

    el("empConfirm").onclick = async () => {

        const newEmp = sel.value;

        // كل الصفوف الخاصة باللوحة
        const rows = activeVisits.filter(v =>
            String(v.data[1]).replace(/\s+/g, "").trim() === selectedPlate
        );

        if (!rows.length) {
            showToast("لا توجد خدمات لهذه السيارة", "error");
            return;
        }

        // تحديث الموظف لكل الخدمات
        for (const r of rows) {
            await apiUpdateRow("Visits", r.row, {
                EMP_IN: newEmp   // المفتاح الصحيح
            });
        }

        showToast("تم تحديث الموظف لكل الخدمات", "success");
        loadActiveVisits();
    };
}

/* ===========================
   تبويب: تغيير الخصم (نسخة صحيحة)
=========================== */
function loadDiscTab() {

    el("discConfirm").onclick = async () => {

        const newDisc = Number(el("discInput").value || 0);

        // كل الصفوف الخاصة باللوحة
        const rows = activeVisits.filter(v =>
            String(v.data[1]).replace(/\s+/g, "").trim() === selectedPlate
        );

        if (!rows.length) {
            showToast("لا توجد خدمات لهذه السيارة", "error");
            return;
        }

        // استخراج الأسعار
        const prices = rows.map(r => Number(r.data[7] || 0));
        const totalBefore = prices.reduce((a, b) => a + b, 0);

        // توزيع الخصم نسبيًا
        const distributed = prices.map(p =>
            totalBefore ? Math.round((p / totalBefore) * newDisc) : 0
        );

        // تحديث كل الصفوف
        for (let i = 0; i < rows.length; i++) {
            await apiUpdateRow("Visits", rows[i].row, {
                DISCOUNT: distributed[i]   // المفتاح الصحيح
            });
        }

        showToast("تم تحديث الخصم بالتوزيع النسبي", "success");
        loadActiveVisits();
    };
}

/* ===========================
   تبويب: تغيير الإكرامية (نسخة صحيحة)
=========================== */
function loadTipTab() {

    el("tipConfirm").onclick = async () => {

        const newTip = Number(el("tipInput").value || 0);

        // كل الصفوف الخاصة باللوحة
        const rows = activeVisits.filter(v =>
            String(v.data[1]).replace(/\s+/g, "").trim() === selectedPlate
        );

        if (!rows.length) {
            showToast("لا توجد خدمات لهذه السيارة", "error");
            return;
        }

        // استخراج الأسعار
        const prices = rows.map(r => Number(r.data[7] || 0));
        const totalBefore = prices.reduce((a, b) => a + b, 0);

        // توزيع الإكرامية نسبيًا
        const distributed = prices.map(p =>
            totalBefore ? Math.round((p / totalBefore) * newTip) : 0
        );

        // تحديث كل الصفوف
        for (let i = 0; i < rows.length; i++) {
            await apiUpdateRow("Visits", rows[i].row, {
                TIP: distributed[i]   // المفتاح الصحيح
            });
        }

        showToast("تم تحديث الإكرامية بالتوزيع النسبي", "success");
        loadActiveVisits();
    };
}

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

// 🔥 منع إضافة أكثر من غسيل أثناء التسجيل
const isWash = servicesData.find(s => s.service === name)?.category === "غسيل";

if (isWash) {
    const hasWash = selectedServices.some(s => {
        const svc = servicesData.find(x => x.service === s.name);
        return svc && svc.category === "غسيل";
    });

    if (hasWash) {
        showToast("لا يمكن إضافة أكثر من خدمة غسيل لنفس السيارة", "error");
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
        commission: svc ? svc.commission : Math.floor(s.price / 5)
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

    // إغلاق أي قائمة مفتوحة
    if (
        !e.target.closest(".dropdown") &&
        !e.target.closest("#paymentModal") &&
        !e.target.closest(".modal-content")
    ) {
        document.querySelectorAll(".dropdown-content").forEach(menu => {
            menu.classList.remove("show");
        });
    }

    // فتح قائمة التعديل
    if (e.target.classList.contains("edit-btn")) {
        const dropdown = e.target.nextElementSibling;

        document.querySelectorAll(".dropdown-content").forEach(m => {
            if (m !== dropdown) m.classList.remove("show");
        });

        dropdown.classList.toggle("show");
        return;
    }

    // فتح قائمة الدفع
    if (e.target.classList.contains("btn-pay")) {
        const dropdown = e.target.nextElementSibling;

        document.querySelectorAll(".dropdown-content").forEach(m => {
            if (m !== dropdown) m.classList.remove("show");
        });

        dropdown.classList.toggle("show");
        return;
    }

    // اختيار طريقة الدفع
    if (e.target.matches(".pay-menu button")) {

        const plate = e.target.parentElement.dataset.plate;
        const method = e.target.dataset.method;

        selectedPlate = String(plate).replace(/\s+/g, "").trim();

        openPaymentModal(selectedPlate);

        el("modal_method_select").value = method;
        el("modal_method_select").dispatchEvent(new Event("change"));

        e.target.parentElement.classList.remove("show");
        return;
    }

    // اختيار إجراء التعديل
    if (e.target.matches(".edit-menu button")) {

        const plate = e.target.parentElement.dataset.plate;
        const action = e.target.dataset.action;

        selectedPlate = String(plate).replace(/\s+/g, "").trim();

        openEditModal(selectedPlate, action);

        e.target.parentElement.classList.remove("show");
        return;
    }

});


/* ===========================
   إغلاق مودال التعديل
=========================== */
function closeEditModal() {
    el("editModal").classList.remove("show");
}


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

        // أزرار الزيارة
        el("btnAddService").onclick = addServiceToList;
        el("btnSubmitVisit").onclick = submitVisit;
        el("btnRefreshActive").onclick = loadActiveVisits;

        // الدفع
        el("payment_status").onchange = function () {
            el("payment_method_wrapper").style.display =
                this.value === "مدفوع" ? "block" : "none";
        };

        el("payment_method").onchange = function () {
            el("partial_payment_box").style.display =
                this.value === "جزئي" ? "block" : "none";
        };

        // إغلاق مودال التعديل
        el("editClose").onclick = closeEditModal;

        // تحديث الإجمالي عند تغيير الخصم
        el("discount").oninput = recalcTotal;

        // رسالة نجاح
        showToast("تم تحميل النظام بنجاح", "success");

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل البيانات", "error");
    }
};
