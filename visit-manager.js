/* ===========================
   أدوات مساعدة + متغيرات عامة
=========================== */
const el = id => document.getElementById(id);

let activeVisits = [];
let selectedPlate = null;
let selectedServices = [];
let carTypesData = [];
let servicesData = [];
let employeesData = [];

/* ===========================
   Toast
=========================== */
function showToast(msg, type = "info") {
    const box = el("toast-container");
    const div = document.createElement("div");
    div.className = "toast " + type;
    div.textContent = msg;
    box.appendChild(div);
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

        rows.forEach(v => {
            const r = v.data;
            const plate = r[1];              // PLATE_NUMBERS
            const brand = r[3] || "";        // CAR_TYPE
            const service = r[6];            // SERVICE
            const price = Number(r[7] || 0); // PRICE
            const emp = r[9] || "غير محدد"; // EMP_IN
            const parking = r[17];           // PARKING

            if (!cars[plate]) {
                cars[plate] = {
                    plate,
                    brand,
                    employee: emp,
                    parking,
                    services: [],
                    total: 0
                };
            }

            cars[plate].services.push({ name: service, price });
            cars[plate].total += price;
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
                    <p><b>الإجمالي:</b> ${car.total} ريال</p>
                </div>

                <div class="card-footer">
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
   Event Delegation (دفع + تعديل)
=========================== */
document.addEventListener("click", e => {
    // الدفع
    if (e.target.matches(".pay-menu a")) {
        e.preventDefault();
        selectedPlate = e.target.parentElement.dataset.plate;
        openPaymentModal(e.target.dataset.method);
    }

    // التعديل
    if (e.target.matches(".edit-menu a")) {
        e.preventDefault();
        selectedPlate = e.target.parentElement.dataset.plate;
        openEditModal(e.target.dataset.action);
    }
});

/* ===========================
   مودال الدفع
=========================== */
function openPaymentModal(method) {
    el("modal").style.display = "flex";

    const rows = activeVisits.filter(v => v.data[1] === selectedPlate);
    const total = rows.reduce((s, v) => s + Number(v.data[7] || 0), 0);

    el("modal_method").textContent = method;
    el("modal_total").textContent = total + " ريال";

    el("modal_cash").value = "";
    el("modal_card").value = "";

    el("cash_box").style.display = (method === "كاش" || method === "جزئي") ? "block" : "none";
    el("card_box").style.display = (method === "شبكة" || method === "جزئي") ? "block" : "none";

    el("modal_confirm").onclick = () => submitPayment(method, total);
}

function closeModal() {
    el("modal").style.display = "none";
}

el("modal_close").onclick = closeModal;

/* ===========================
   تنفيذ الدفع
=========================== */
async function submitPayment(method, total) {
    const cash = Number(el("modal_cash").value || 0);
    const card = Number(el("modal_card").value || 0);

    let paid = 0;
    if (method === "كاش") paid = cash;
    if (method === "شبكة") paid = card;
    if (method === "جزئي") paid = cash + card;

    if (paid !== total) {
        showToast(`المبلغ يجب أن يكون ${total} ريال`, "error");
        return;
    }

    const rows = activeVisits.filter(v => v.data[1] === selectedPlate);

    for (const v of rows) {
        const price = Number(v.data[7] || 0);

        await apiCloseVisit(v.row, {
            payment_status: "مدفوع",
            payment_method: method,
            cash_amount: method === "كاش" ? price : (method === "جزئي" ? cash : 0),
            card_amount: method === "شبكة" ? price : (method === "جزئي" ? card : 0)
        });
    }

    showToast("تم تحديث الدفع", "success");
    closeModal();
    loadActiveVisits();
}
/* ===========================
   فتح مودال التعديل
=========================== */
function openEditModal(action) {
    el("editModal").style.display = "flex";

    loadSwapTab();
    loadDeleteTab();
    loadAddTab();
    loadEmpTab();
}

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
        const rows = activeVisits.filter(v => v.data[1] === selectedPlate);
        const row = rows[0];

        await apiUpdateRow("Visits", row.row, {
            service_detail: sel.value,
            price: Number(sel.selectedOptions[0].dataset.price)
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

    const rows = activeVisits.filter(v => v.data[1] === selectedPlate);

    rows.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.row;
        opt.textContent = `${v.data[6]} — ${v.data[7]} ريال`;
        sel.appendChild(opt);
    });

    el("deleteConfirm").onclick = async () => {
        await apiDeleteRow("Visits", sel.value);
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
        const service = sel.value;
        const price = Number(sel.selectedOptions[0].dataset.price);
        const points = Number(sel.selectedOptions[0].dataset.points);

        await apiAddVisit({
            services: [{ name: service, price, points }],
            plate_numbers: selectedPlate,
            plate_letters: "",
            car_type: "",
            car_model: "",
            car_size: "",
            employee_in: "",
            branch: "",
            parking_slot: "",
            payment_status: "غير مدفوع",
            payment_method: ""
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

    employeesData.forEach(e => {
        const opt = document.createElement("option");
        opt.value = e[0];
        opt.textContent = e[0];
        sel.appendChild(opt);
    });

    el("empConfirm").onclick = async () => {
        const rows = activeVisits.filter(v => v.data[1] === selectedPlate);

        for (const v of rows) {
            await apiUpdateRow("Visits", v.row, {
                employee_in: sel.value
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
    const val = Number(el("discInput").value || 0);
    const rows = activeVisits.filter(v => v.data[1] === selectedPlate);

    for (const v of rows) {
        await apiUpdateRow("Visits", v.row, { discount: val });
    }

    showToast("تم تحديث الخصم", "success");
    loadActiveVisits();
};

/* ===========================
   تبويب: تغيير الإكرامية
=========================== */
el("tipConfirm").onclick = async () => {
    const val = Number(el("tipInput").value || 0);
    const rows = activeVisits.filter(v => v.data[1] === selectedPlate);

    for (const v of rows) {
        await apiUpdateRow("Visits", v.row, { tip: val });
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
            el("price").value = opt.dataset.price;
            el("points").value = opt.dataset.points;
        };

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

    if (!name) return showToast("اختر خدمة", "error");

    selectedServices.push({ name, price, points, category });
    renderServicesList();
    recalcTotal();
}

/* ===========================
   عرض الخدمات المضافة
=========================== */
function renderServicesList() {
    const box = el("servicesList");
    box.innerHTML = "";

    selectedServices.forEach((s, i) => {
        const div = document.createElement("div");
        div.className = "service-item";
        div.innerHTML = `
            <span>${s.name} — ${s.price} ريال</span>
            <button data-i="${i}" class="btn-remove">X</button>
        `;
        box.appendChild(div);
    });

    box.querySelectorAll(".btn-remove").forEach(btn => {
        btn.onclick = () => {
            selectedServices.splice(btn.dataset.i, 1);
            renderServicesList();
            recalcTotal();
        };
    });
}

/* ===========================
   حساب الإجمالي
=========================== */
function recalcTotal() {
    const total = selectedServices.reduce((s, x) => s + x.price, 0);
    const discount = Number(el("discount").value || 0);
    el("totalPrice").textContent = Math.max(0, total - discount);
}
/* ===========================
   تسجيل الزيارة
=========================== */
async function submitVisit() {
    const plate_numbers = el("plate_numbers").value.trim();
    const plate_letters = el("plate_letters").value.trim();

    if (!plate_numbers)
        return showToast("أدخل أرقام اللوحة", "error");

    if (!selectedServices.length)
        return showToast("أضف خدمة واحدة على الأقل", "error");

    const car_type = el("car_type").value;
    const car_model = el("car_model").value;
    const car_size = el("car_size").value;

    const employee_in = el("employee_in").value;
    const branch = el("branch").value;
    const parking_slot = el("parking_slot").value;

    const payment_status = el("payment_status").value;
    const payment_method = el("payment_method").value;

    const discount = Number(el("discount").value || 0);
    const tip = Number(el("tip").value || 0);

    const total = selectedServices.reduce((s, x) => s + x.price, 0);
    const finalTotal = Math.max(0, total - discount);

    let cash = 0, card = 0;

    if (payment_status === "مدفوع") {
        if (!payment_method)
            return showToast("اختر طريقة الدفع", "error");

        if (payment_method === "كاش") cash = finalTotal;
        if (payment_method === "شبكة") card = finalTotal;

        if (payment_method === "جزئي") {
            cash = Number(el("cash_amount").value || 0);
            card = Number(el("card_amount").value || 0);

            if (cash + card !== finalTotal)
                return showToast(`المبلغ يجب أن يكون ${finalTotal} ريال`, "error");
        }
    }

    try {
        await apiAddVisit({
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
            services: selectedServices.map(s => ({
                name: s.name,
                price: s.price,
                points: s.points,
                commission: s.points
            }))
        });

        showToast("تم تسجيل الزيارة بنجاح", "success");
        resetForm();
        loadActiveVisits();

    } catch (err) {
        console.error(err);
        showToast("خطأ أثناء تسجيل الزيارة", "error");
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
   تشغيل النظام عند التحميل
=========================== */
window.onload = async () => {
    await loadCarTypes();
    await loadServices();
    await loadEmployees();
    await loadActiveVisits();

    el("btnAddService").onclick = addServiceToList;
    el("btnSubmitVisit").onclick = submitVisit;

    el("btnRefreshActive").onclick = loadActiveVisits;

    el("payment_status").onchange = () => {
        const val = el("payment_status").value;
        el("payment_method_wrapper").style.display = val === "مدفوع" ? "block" : "none";
    };

    el("payment_method").onchange = () => {
        const val = el("payment_method").value;
        el("partial_payment_box").style.display = val === "جزئي" ? "block" : "none";
    };
};
