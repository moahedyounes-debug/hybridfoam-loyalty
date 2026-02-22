/* ===========================
   أدوات مساعدة
=========================== */

const el = id => document.getElementById(id);

let activeVisits = [];
let selectedPlate = null;
let selectedServices = [];
let carTypesData = [];
let servicesData = [];
let employeesData = [];
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
   تحميل الزيارات داخل المغسلة
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
            const serviceName = row[6];
            const price = Number(row[7] || 0);
            const checkIn = row[13];
            const parking = row[17];
            const employee = row[9] || "غير محدد";

            if (!cars[plate]) {
                cars[plate] = {
                    plate,
                    services: [],
                    totalPrice: 0,
                    checkIn,
                    parking,
                    employee
                };
            }

            cars[plate].services.push({ name: serviceName, price });
            cars[plate].totalPrice += price;
        });

        Object.values(cars).forEach(car => {
            const servicesHTML = car.services
                .map(s => `<li>${s.name} — ${s.price} ريال</li>`)
                .join("");

            const card = document.createElement("div");
            card.className = "car-card";

            card.innerHTML = `
                <h4>لوحة: ${car.plate}</h4>

                <p><b>الدخول:</b> ${car.checkIn}</p>
                <p><b>رقم الموقف:</b> ${car.parking}</p>
                <p><b>الموظف:</b> ${car.employee}</p>

                <button class="btn-edit" data-plate="${car.plate}">تعديل الخدمات</button>
                <button class="btn-emp" data-plate="${car.plate}">تغيير الموظف</button>

                <p><b>الخدمات:</b></p>
                <ul>${servicesHTML}</ul>

                <p><b>الإجمالي:</b> ${car.totalPrice} ريال</p>

                <div class="dropdown">
                    <button class="btn-pay">تحديث الدفع ▼</button>
                    <div class="dropdown-content">
                        <a href="#" data-method="كاش" data-plate="${car.plate}">دفع كاش (${car.totalPrice} ريال)</a>
                        <a href="#" data-method="شبكة" data-plate="${car.plate}">دفع شبكة (${car.totalPrice} ريال)</a>
                        <a href="#" data-method="جزئي" data-plate="${car.plate}">دفع جزئي</a>
                    </div>
                </div>
            `;

            list.appendChild(card);
        });

        loadEmployeeSummary(rows);

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل الزيارات", "error");
    }
}
/* ===========================
   Event Delegation
=========================== */

document.addEventListener("click", function (e) {

    /* فتح مودال الدفع */
    if (e.target.matches(".dropdown-content a")) {
        e.preventDefault();
        const method = e.target.getAttribute("data-method");
        selectedPlate = e.target.getAttribute("data-plate");
        openPaymentModal(method);
    }

    /* تعديل الخدمات */
    if (e.target.matches(".btn-edit")) {
        const plate = e.target.getAttribute("data-plate");
        openServiceEditor(plate);
    }

    /* تغيير الموظف */
    if (e.target.matches(".btn-emp")) {
        const plate = e.target.getAttribute("data-plate");
        openEmployeeEditor(plate);
    }
});

/* ===========================
   مودال الدفع
=========================== */

function openPaymentModal(method) {
    el("modal").style.display = "block";
    el("modal_method").textContent = method;

    el("modal_cash").value = "";
    el("modal_card").value = "";

    const visitRows = activeVisits.filter(v => {
        const plateCell = String(v.data[1] || "");
        return plateCell.startsWith(String(selectedPlate));
    });

    const totalRequired = visitRows.reduce(
        (sum, v) => sum + Number(v.data[7] || 0),
        0
    );

    el("modal_total").textContent = totalRequired + " ريال";

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

/* ===========================
   تحديث الدفع
=========================== */

async function submitPayment(method) {
    const cash = Number(el("modal_cash").value || 0);
    const card = Number(el("modal_card").value || 0);

    const confirmBtn = el("modal_confirm");
    confirmBtn.disabled = true;
    confirmBtn.textContent = "جاري التحديث...";

    try {
        const visitRows = activeVisits.filter(v => {
            const plateCell = String(v.data[1] || "");
            return plateCell.startsWith(String(selectedPlate));
        });

        const totalRequired = visitRows.reduce(
            (sum, v) => sum + Number(v.data[7] || 0),
            0
        );

        const totalPaid = cash + card;

        if (totalPaid !== totalRequired) {
            showToast(`المبلغ المدفوع يجب أن يكون ${totalRequired} ريال`, "error");
            confirmBtn.disabled = false;
            confirmBtn.textContent = "تأكيد";
            return;
        }

        const paymentMethodLabel =
            method === "جزئي" ? "كاش + شبكة" : method;

        for (const v of visitRows) {
            const servicePrice = Number(v.data[7] || 0);
            const ratio = servicePrice / totalRequired;

            const cashForThis = cash * ratio;
            const cardForThis = card * ratio;

            await apiCloseVisit(v.row, {
                payment_status: "مدفوع",
                payment_method: paymentMethodLabel,
                CASH_AMOUNT: cashForThis,
                CARD_AMOUNT: cardForThis,
                TOTAL_PAID: servicePrice
            });
        }

        showToast("تم تحديث الدفع", "success");
        closeModal();
        setTimeout(loadActiveVisits, 20);

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحديث الدفع", "error");
    }

    confirmBtn.disabled = false;
    confirmBtn.textContent = "تأكيد";
}

/* ===========================
   تعديل الخدمات
=========================== */

function openServiceEditor(plate) {
    const visitRows = activeVisits.filter(v => {
        const plateCell = String(v.data[1] || "");
        return plateCell.startsWith(String(plate));
    });

    if (!visitRows.length) {
        showToast("لا توجد خدمات لهذه السيارة", "error");
        return;
    }

    let html = `<h3>تعديل الخدمات</h3>`;

    visitRows.forEach((v, i) => {
        html += `
            <div class="service-edit-item">
                <label>الخدمة ${i + 1}</label>
                <input type="text" value="${v.data[6]}" id="edit_name_${i}">
                <input type="number" value="${v.data[7]}" id="edit_price_${i}">
            </div>
        `;
    });

    html += `<button id="saveServices">حفظ التعديلات</button>`;

    el("modal_edit").innerHTML = html;
    el("modal_edit_container").style.display = "block";

    el("saveServices").onclick = async () => {
        for (let i = 0; i < visitRows.length; i++) {
            const newName = el(`edit_name_${i}`).value;
            const newPrice = Number(el(`edit_price_${i}`).value);

            await apiUpdateRow("Visits", visitRows[i].row, {
                service_detail: newName,
                price: newPrice
            });
        }

        showToast("تم تعديل الخدمات", "success");
        el("modal_edit_container").style.display = "none";
        loadActiveVisits();
    };
}

/* ===========================
   تغيير الموظف
=========================== */

function openEmployeeEditor(plate) {
    const visitRows = activeVisits.filter(v => {
        const plateCell = String(v.data[1] || "");
        return plateCell.startsWith(String(plate));
    });

    if (!visitRows.length) {
        showToast("لا توجد زيارات لهذه السيارة", "error");
        return;
    }

    let html = `
        <h3>تغيير الموظف</h3>
        <select id="newEmp">
            ${employeesData.map(e => `<option value="${e[0]}">${e[0]}</option>`).join("")}
        </select>
        <button id="saveEmp">حفظ</button>
    `;

    el("modal_edit").innerHTML = html;
    el("modal_edit_container").style.display = "block";

    el("saveEmp").onclick = async () => {
        const newEmp = el("newEmp").value;

        for (const v of visitRows) {
            await apiUpdateRow("Visits", v.row, {
                employee_in: newEmp
            });
        }

        showToast("تم تغيير الموظف", "success");
        el("modal_edit_container").style.display = "none";
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

        const categories = [...new Set(servicesData.map(s => s.Category || s.category))];

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
    const detail = el("service_detail").value;
    const price = Number(el("price").value || 0);
    const points = Number(el("points").value || 0);
    const category = el("service_type").value;

    if (!detail) {
        showToast("اختر خدمة", "error");
        return;
    }

    // منع تكرار الغسيل
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
   تسجيل الزيارة
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

    if (!plate_numbers) {
        showToast("أدخل أرقام اللوحة", "error");
        resetSubmitButton(btn);
        return;
    }

    if (!employee_in) {
        showToast("اختر الموظف", "error");
        resetSubmitButton(btn);
        return;
    }

    if (!selectedServices.length) {
        showToast("أضف خدمة واحدة على الأقل", "error");
        resetSubmitButton(btn);
        return;
    }

    const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const discount = Number(el("discount").value || 0);
    const finalTotal = Math.max(0, total - discount);

    let cash_amount = 0;
    let card_amount = 0;

    if (payment_status === "مدفوع") {
        if (payment_method === "جزئي") {
            cash_amount = Number(el("cash_amount").value || 0);
            card_amount = Number(el("card_amount").value || 0);

            if (cash_amount + card_amount !== finalTotal) {
                showToast(`المبلغ المدفوع يجب أن يكون ${finalTotal} ريال`, "error");
                resetSubmitButton(btn);
                return;
            }

        } else if (payment_method === "كاش") {
            cash_amount = finalTotal;

        } else if (payment_method === "شبكة") {
            card_amount = finalTotal;
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
        services: selectedServices.map(s => ({
            name: s.name,
            price: s.price,
            points: s.points,
            commission: s.commission
        }))
    };

    try {
        await apiAddVisit({
            ...payload,
            services: JSON.stringify(payload.services)
        });

        showToast("تم تسجيل الزيارة", "success");
        resetForm();
        setTimeout(loadActiveVisits, 20);

    } catch (err) {
        console.error(err);
        showToast("خطأ في تسجيل الزيارة", "error");

    } finally {
        resetSubmitButton(btn);
    }
}

function resetSubmitButton(btn) {
    btn.classList.remove("btn-loading");
    btn.textContent = "تسجيل الزيارة";
    btn.disabled = false;
}
/* ===========================
   الزيارات المكتملة (مدفوع فقط)
=========================== */

async function loadCompletedVisits() {
    const box = el("completedList");
    box.innerHTML = "جارِ التحميل...";

    try {
        const res = await apiGetActiveVisits();
        const rows = res.visits || [];

        // فلترة المدفوع فقط
        const paid = rows.filter(v => {
            const status = v.data[14] || v.data[15] || "";
            return status === "مدفوع";
        });

        if (!paid.length) {
            box.innerHTML = "<p>لا توجد زيارات مكتملة</p>";
            return;
        }

        box.innerHTML = paid.map(v => `
            <div class="car-card">
                <h4>لوحة: ${v.data[1]}</h4>
                <p><b>الخدمة:</b> ${v.data[6]}</p>
                <p><b>السعر:</b> ${v.data[7]} ريال</p>
                <p><b>الموظف:</b> ${v.data[9] || "غير محدد"}</p>
                <p><b>طريقة الدفع:</b> ${v.data[14] || "—"}</p>
            </div>
        `).join("");

        loadPaidSummary(paid);

    } catch (err) {
        console.error(err);
        box.innerHTML = "<p>خطأ في تحميل الزيارات المكتملة</p>";
    }
}

/* ===========================
   ملخص الموظفين داخل المغسلة
=========================== */

function loadEmployeeSummary(rows) {
    const box = el("employeeSummary");
    if (!box) return;

    const perEmployee = {};

    rows.forEach(v => {
        const emp = v.data[9] || "غير محدد";
        const price = Number(v.data[7] || 0);

        if (!perEmployee[emp]) {
            perEmployee[emp] = { count: 0, total: 0 };
        }

        perEmployee[emp].count++;
        perEmployee[emp].total += price;
    });

    box.innerHTML = `
        <h3 class="section-title">📌 ملخص الموظفين داخل المغسلة</h3>
        ${Object.keys(perEmployee).map(emp => `
            <div class="summary-box">
                <p><b>الموظف:</b> ${emp}</p>
                <p><b>عدد الخدمات:</b> ${perEmployee[emp].count}</p>
                <p><b>إجمالي المبلغ:</b> ${perEmployee[emp].total} ريال</p>
            </div>
        `).join("")}
    `;
}

/* ===========================
   ملخص المدفوع اليوم
=========================== */

function loadPaidSummary(paidRows) {
    const box = el("paidSummary");
    if (!box) return;

    let totalCars = 0;
    let totalAmount = 0;
    const perEmployee = {};

    paidRows.forEach(v => {
        const emp = v.data[9] || "غير محدد";
        const price = Number(v.data[7] || 0);

        totalCars++;
        totalAmount += price;

        if (!perEmployee[emp]) {
            perEmployee[emp] = { cars: 0, total: 0 };
        }

        perEmployee[emp].cars++;
        perEmployee[emp].total += price;
    });

    box.innerHTML = `
        <h3 class="section-title">📌 ملخص المدفوع اليوم</h3>

        <div class="summary-box">
            <p><b>عدد السيارات:</b> ${totalCars}</p>
            <p><b>إجمالي المبلغ:</b> ${totalAmount} ريال</p>
        </div>

        <h4>تفاصيل الموظفين:</h4>
        ${Object.keys(perEmployee).map(emp => `
            <div class="summary-box">
                <p><b>الموظف:</b> ${emp}</p>
                <p><b>عدد السيارات:</b> ${perEmployee[emp].cars}</p>
                <p><b>إجمالي المبلغ:</b> ${perEmployee[emp].total} ريال</p>
            </div>
        `).join("")}
    `;
}

/* ===========================
   إغلاق مودال تعديل الخدمات / الموظف
=========================== */

function closeEditModal() {
    el("modal_edit_container").style.display = "none";
}

/* ===========================
   INIT
=========================== */

document.addEventListener("DOMContentLoaded", () => {

    loadActiveVisits();
    loadCompletedVisits();

    loadCarTypes();
    loadServices();
    loadEmployees();

    el("btnRefreshActive").addEventListener("click", loadActiveVisits);
    el("btnRefreshCompleted").addEventListener("click", loadCompletedVisits);

    el("btnAddService").addEventListener("click", addServiceToList);
    el("discount").addEventListener("input", recalcTotal);
    el("btnSubmitVisit").addEventListener("click", submitVisit);

    el("modal_close").addEventListener("click", closeModal);
    el("modal_edit_close").addEventListener("click", closeEditModal);

    el("payment_status").addEventListener("change", () => {
        const val = el("payment_status").value;

        if (val === "مدفوع") {
            el("payment_method_wrapper").style.display = "block";
        } else {
            el("payment_method_wrapper").style.display = "none";
            el("partial_payment_box").style.display = "none";
        }
    });

    el("payment_method").addEventListener("change", () => {
        const val = el("payment_method").value;

        if (val === "جزئي") {
            el("partial_payment_box").style.display = "block";
        } else {
            el("partial_payment_box").style.display = "none";
        }
    });
});
