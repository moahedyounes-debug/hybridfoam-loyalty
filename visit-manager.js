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
    el("modal").style.display = "flex";

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
    el("editModal").style.display = "flex";

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

        if (!visitRows.length) {
            showToast("لا توجد خدمات لهذه السيارة", "error");
            return;
        }

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

    employeesData.forEach(emp => {
        const opt = document.createElement("option");
        opt.value = emp.name;
        opt.textContent = emp.name;
        sel.appendChild(opt);
    });

    el("empConfirm").onclick = async () => {
        const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);

        if (!visitRows.length) {
            showToast("لا توجد خدمات لهذه السيارة", "error");
            return;
        }

        const newEmp = sel.value;

        for (const v of visitRows) {
            await apiUpdateRow("Visits", v.row, {
                employee: newEmp
            });
        }

        showToast("تم تحديث الموظف", "success");
        loadActiveVisits();
    };
}

/* ===========================
   تبويب: تغيير الخصم
=========================== */
function loadDiscTab() {
    const input = el("discInput");
    input.value = "";

    el("discConfirm").onclick = async () => {
        const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);

        if (!visitRows.length) {
            showToast("لا توجد خدمات لهذه السيارة", "error");
            return;
        }

        const newDisc = Number(input.value || 0);

        for (const v of visitRows) {
            await apiUpdateRow("Visits", v.row, {
                discount: newDisc
            });
        }

        showToast("تم تحديث الخصم", "success");
        loadActiveVisits();
    };
}

/* ===========================
   تبويب: تغيير الإكرامية
=========================== */
function loadTipTab() {
    const input = el("tipInput");
    input.value = "";

    el("tipConfirm").onclick = async () => {
        const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);

        if (!visitRows.length) {
            showToast("لا توجد خدمات لهذه السيارة", "error");
            return;
        }

        const newTip = Number(input.value || 0);

        for (const v of visitRows) {
            await apiUpdateRow("Visits", v.row, {
                tip: newTip
            });
        }

        showToast("تم تحديث الإكرامية", "success");
        loadActiveVisits();
    };
}
/* ===========================
   تحميل بيانات أنواع السيارات
=========================== */
async function loadCarTypes() {
    try {
        const res = await apiGetCarTypes();
        carTypesData = res.types || [];

        const typeSel = el("car_type");
        typeSel.innerHTML = "";

        carTypesData.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.type;
            opt.textContent = t.type;
            typeSel.appendChild(opt);
        });

        typeSel.onchange = loadCarModels;

        loadCarModels();

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل أنواع السيارات", "error");
    }
}

/* ===========================
   تحميل موديلات السيارة
=========================== */
function loadCarModels() {
    const selectedType = el("car_type").value;
    const modelSel = el("car_model");
    modelSel.innerHTML = "";

    const models = carTypesData.find(t => t.type === selectedType)?.models || [];

    models.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.model;
        opt.textContent = m.model;
        opt.dataset.size = m.size;
        modelSel.appendChild(opt);
    });

    modelSel.onchange = () => {
        const size = modelSel.selectedOptions[0]?.dataset.size || "";
        el("car_size").value = size;
    };

    if (models.length) {
        el("car_size").value = models[0].size;
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

        typeSel.innerHTML = "";
        detailSel.innerHTML = "";

        const types = [...new Set(servicesData.map(s => s.type))];

        types.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = t;
            typeSel.appendChild(opt);
        });

        typeSel.onchange = loadServiceDetails;

        loadServiceDetails();

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل الخدمات", "error");
    }
}

/* ===========================
   تحميل تفاصيل الخدمة
=========================== */
function loadServiceDetails() {
    const selectedType = el("service_type").value;
    const detailSel = el("service_detail");
    detailSel.innerHTML = "";

    const filtered = servicesData.filter(s => s.type === selectedType);

    filtered.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.service;
        opt.textContent = `${s.service} — ${s.price} ريال`;
        opt.dataset.price = s.price;
        opt.dataset.points = s.points;
        detailSel.appendChild(opt);
    });

    detailSel.onchange = () => {
        const opt = detailSel.selectedOptions[0];
        el("price").value = opt.dataset.price;
        el("points").value = opt.dataset.points;
    };

    if (filtered.length) {
        const opt = detailSel.selectedOptions[0];
        el("price").value = opt.dataset.price;
        el("points").value = opt.dataset.points;
    }
}

/* ===========================
   تحميل الموظفين
=========================== */
let employeesData = [];

async function loadEmployees() {
    try {
        const res = await apiGetEmployees();
        employeesData = res.employees || [];

        const sel = el("employee_in");
        sel.innerHTML = "";

        employeesData.forEach(emp => {
            const opt = document.createElement("option");
            opt.value = emp.name;
            opt.textContent = emp.name;
            sel.appendChild(opt);
        });

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل الموظفين", "error");
    }
}
/* ===========================
   إضافة خدمة إلى قائمة الزيارة
=========================== */
el("btnAddService").onclick = () => {
    const detailSel = el("service_detail");
    const service = detailSel.value;
    const price = Number(detailSel.selectedOptions[0].dataset.price);
    const points = Number(detailSel.selectedOptions[0].dataset.points);

    selectedServices.push({ service, price, points });

    renderSelectedServices();
    updateTotalPrice();
};

/* ===========================
   عرض الخدمات المضافة
=========================== */
function renderSelectedServices() {
    const box = el("servicesList");
    box.innerHTML = "";

    selectedServices.forEach((s, i) => {
        const div = document.createElement("div");
        div.className = "service-item";

        div.innerHTML = `
            <span>${s.service} — ${s.price} ريال</span>
            <button class="btn-remove" data-index="${i}">X</button>
        `;

        box.appendChild(div);
    });
}

/* ===========================
   حذف خدمة من القائمة
=========================== */
document.addEventListener("click", e => {
    if (e.target.matches(".btn-remove")) {
        const index = Number(e.target.dataset.index);
        selectedServices.splice(index, 1);
        renderSelectedServices();
        updateTotalPrice();
    }
});

/* ===========================
   تحديث الإجمالي
=========================== */
function updateTotalPrice() {
    const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
    el("totalPrice").textContent = total;
}

/* ===========================
   تسجيل الزيارة
=========================== */
el("btnSubmitVisit").onclick = async () => {
    const plateNumbers = el("plate_numbers").value.trim();
    const plateLetters = el("plate_letters").value.trim();
    const plate = plateNumbers + (plateLetters ? "-" + plateLetters : "");

    if (!plateNumbers) {
        showToast("أدخل أرقام اللوحة", "error");
        return;
    }

    if (!selectedServices.length) {
        showToast("أضف خدمة واحدة على الأقل", "error");
        return;
    }

    const carType = el("car_type").value;
    const carModel = el("car_model").value;
    const carSize = el("car_size").value;

    const discount = Number(el("discount").value || 0);
    const tip = Number(el("tip").value || 0);
    const parking = el("parking_slot").value;
    const employee = el("employee_in").value;
    const branch = el("branch").value;

    const paymentStatus = el("payment_status").value;
    const paymentMethod = el("payment_method").value;

    let cashAmount = 0;
    let cardAmount = 0;

    if (paymentStatus === "مدفوع") {
        if (!paymentMethod) {
            showToast("اختر طريقة الدفع", "error");
            return;
        }

        if (paymentMethod === "جزئي") {
            cashAmount = Number(el("cash_amount").value || 0);
            cardAmount = Number(el("card_amount").value || 0);

            const total = selectedServices.reduce((sum, s) => sum + s.price, 0);

            if (cashAmount + cardAmount !== total) {
                showToast("مجموع الدفع الجزئي غير مطابق للإجمالي", "error");
                return;
            }
        }

        if (paymentMethod === "كاش") {
            cashAmount = selectedServices.reduce((sum, s) => sum + s.price, 0);
        }

        if (paymentMethod === "شبكة") {
            cardAmount = selectedServices.reduce((sum, s) => sum + s.price, 0);
        }
    }

    // إرسال كل خدمة كصف مستقل
    for (const s of selectedServices) {
        await apiAddVisit({
            plate,
            service_type: "",
            service_detail: s.service,
            price: s.price,
            points: s.points,
            car_type: carType,
            car_model: carModel,
            car_size: carSize,
            discount,
            tip,
            parking_slot: parking,
            employee,
            branch,
            payment_status: paymentStatus,
            payment_method: paymentMethod,
            CASH_AMOUNT: cashAmount,
            CARD_AMOUNT: cardAmount,
            TOTAL_PAID: cashAmount + cardAmount
        });
    }

    showToast("تم تسجيل الزيارة", "success");
    resetVisitForm();
    loadActiveVisits();
};

/* ===========================
   إعادة ضبط النموذج
=========================== */
function resetVisitForm() {
    el("plate_numbers").value = "";
    el("plate_letters").value = "";
    el("discount").value = "";
    el("tip").value = "";
    el("parking_slot").value = "";
    el("payment_status").value = "";
    el("payment_method").value = "";
    el("cash_amount").value = "";
    el("card_amount").value = "";
    el("paid_total").textContent = "0";

    selectedServices = [];
    renderSelectedServices();
    updateTotalPrice();
}
/* ===========================
   التشغيل النهائي عند فتح الصفحة
=========================== */
window.onload = async () => {

    // تحميل البيانات الأساسية
    await loadCarTypes();
    await loadServices();
    await loadEmployees();

    // تحميل الزيارات النشطة
    await loadActiveVisits();

    // زر تحديث القائمة
    el("btnRefreshActive").onclick = loadActiveVisits;

    // تغيير حالة الدفع
    el("payment_status").onchange = () => {
        const status = el("payment_status").value;

        if (status === "مدفوع") {
            el("payment_method_wrapper").style.display = "block";
        } else {
            el("payment_method_wrapper").style.display = "none";
            el("partial_payment_box").style.display = "none";
        }
    };

    // تغيير طريقة الدفع
    el("payment_method").onchange = () => {
        const method = el("payment_method").value;

        if (method === "جزئي") {
            el("partial_payment_box").style.display = "block";
        } else {
            el("partial_payment_box").style.display = "none";
        }
    };

    // تحديث مجموع الدفع الجزئي
    el("cash_amount").oninput =
    el("card_amount").oninput = () => {
        const cash = Number(el("cash_amount").value || 0);
        const card = Number(el("card_amount").value || 0);
        el("paid_total").textContent = cash + card;
    };
};
