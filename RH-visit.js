/* ===========================
   أدوات مساعدة
=========================== */

const el = id => document.getElementById(id);

let activeVisits = [];
let employeesData = [];
let servicesData = [];
let carTypesData = [];
let selectedPlate = null;

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
   تحميل الزيارات داخل المغسلة (غير مدفوع)
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
            list.innerHTML = "<p>لا توجد سيارات داخل المغسلة</p>";
            return;
        }

        const cars = {};

        rows.forEach(v => {
            const d = v.data;

            const plate = d[1];
            const brand = d[3]; // car_type
            const service = d[6];
            const price = Number(d[7] || 0);
            const employee = d[9] || "غير محدد";
            const checkin = d[13];
            const status = d[15]; // payment_status
            const parking = d[17];

            if (status === "مدفوع") return;

            if (!cars[plate]) {
                cars[plate] = {
                    plate,
                    brand,
                    services: [],
                    total: 0,
                    employee,
                    checkin,
                    parking
                };
            }

            cars[plate].services.push({ service, price });
            cars[plate].total += price;
        });

        Object.values(cars).forEach(car => {
            const card = document.createElement("div");
            card.className = "car-card";

            const servicesHTML = car.services
                .map(s => `<li>${s.service} — ${s.price} ريال</li>`)
                .join("");

            card.innerHTML = `
                <h4>🚗 ${car.brand} | ${car.plate}</h4>
                <p><b>الدخول:</b> ${car.checkin}</p>
                <p><b>الموظف:</b> ${car.employee}</p>
                <p><b>الموقف:</b> ${car.parking}</p>

                <p><b>الخدمات:</b></p>
                <ul>${servicesHTML}</ul>

                <p><b>الإجمالي:</b> ${car.total} ريال</p>

                <button class="btn-edit" data-plate="${car.plate}">تعديل الخدمات</button>
                <button class="btn-emp" data-plate="${car.plate}">تغيير الموظف</button>

                <div class="dropdown">
                    <button class="btn-pay">تحديث الدفع ▼</button>
                    <div class="dropdown-content">
                        <a href="#" data-method="كاش" data-plate="${car.plate}">دفع كاش (${car.total} ريال)</a>
                        <a href="#" data-method="شبكة" data-plate="${car.plate}">دفع شبكة (${car.total} ريال)</a>
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
   ملخص الموظفين (جدول)
=========================== */

function loadEmployeeSummary(rows) {
    const box = el("employeeSummary");
    if (!box) return;

    const perEmployee = {};

    rows.forEach(v => {
        const d = v.data;
        const status = d[15];
        if (status === "مدفوع") return;

        const emp = d[9] || "غير محدد";
        const price = Number(d[7] || 0);

        if (!perEmployee[emp]) {
            perEmployee[emp] = { count: 0, total: 0 };
        }

        perEmployee[emp].count++;
        perEmployee[emp].total += price;
    });

    box.innerHTML = `
        <table class="summary-table">
            <tr>
                <th>الموظف</th>
                <th>عدد الخدمات</th>
                <th>إجمالي المبلغ</th>
            </tr>
            ${Object.keys(perEmployee).map(emp => `
                <tr>
                    <td>${emp}</td>
                    <td>${perEmployee[emp].count}</td>
                    <td>${perEmployee[emp].total} ريال</td>
                </tr>
            `).join("")}
        </table>
    `;
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
   فتح مودال الدفع
=========================== */

function openPaymentModal(method) {
    // افتح المودال
    el("modal").style.display = "flex";
    el("modal_method").textContent = method;

    // تفريغ الحقول
    el("modal_cash").value = "";
    el("modal_card").value = "";

    // فلترة الزيارات حسب اللوحة (نفس طريقة الدفع)
    const visitRows = activeVisits.filter(v => {
        const plateCell = String(v.data[1] || "");
        return plateCell.startsWith(String(selectedPlate));
    });

    // حساب الإجمالي
    const totalRequired = visitRows.reduce(
        (sum, v) => sum + Number(v.data[7] || 0),
        0
    );

    // عرض الإجمالي
    el("modal_total").textContent = totalRequired + " ريال";

    // إخفاء الحقول
    el("cash_box").style.display = "none";
    el("card_box").style.display = "none";

    // تعبئة المبلغ تلقائيًا
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

    // زر التأكيد
    el("modal_confirm").onclick = () => submitPayment(method);
}

/* ===========================
   إغلاق مودال الدفع
=========================== */

function closeModal() {
    el("modal").style.display = "none";
    el("modal_cash").value = "";
    el("modal_card").value = "";
}

el("modal_close").addEventListener("click", closeModal);
el("modal_cancel").addEventListener("click", closeModal);

/* ===========================
   تنفيذ الدفع
=========================== */

async function submitPayment(method) {
    const cash = Number(el("modal_cash").value || 0);
    const card = Number(el("modal_card").value || 0);

    const confirmBtn = el("modal_confirm");
    confirmBtn.disabled = true;
    confirmBtn.textContent = "جاري التحديث...";

    try {
        const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);

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
            <div class="service-edit-item" style="margin-bottom:10px;">
                <label>الخدمة ${i + 1}</label>
                <input type="text" id="edit_name_${i}" value="${v.data[6]}" class="modal-input">
                <input type="number" id="edit_price_${i}" value="${v.data[7]}" class="modal-input">
            </div>
        `;
    });

    html += `<button id="saveServices" class="btn-primary full">حفظ التعديلات</button>`;

    el("modal_edit").innerHTML = html;
    el("modal_edit_container").style.display = "flex";

    el("saveServices").onclick = async () => {
        try {
            for (let i = 0; i < visitRows.length; i++) {
                const newName = el(`edit_name_${i}`).value;
                const newPrice = Number(el(`edit_price_${i}`).value);

                await apiUpdateRow("Visits", visitRows[i].row, {
                    service_detail: newName,
                    price: newPrice
                });
            }

            showToast("تم تعديل الخدمات", "success");
            closeEditModal();
            loadActiveVisits();

        } catch (err) {
            console.error(err);
            showToast("خطأ أثناء تعديل الخدمات", "error");
        }
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
        <label>اختر الموظف الجديد</label>
        <select id="newEmp" class="modal-input">
            ${employeesData.map(e => `<option value="${e[0]}">${e[0]}</option>`).join("")}
        </select>

        <button id="saveEmp" class="btn-primary full" style="margin-top:15px;">حفظ</button>
    `;

    el("modal_edit").innerHTML = html;
    el("modal_edit_container").style.display = "flex";

    el("saveEmp").onclick = async () => {
        const newEmp = el("newEmp").value;

        try {
            for (const v of visitRows) {
                await apiUpdateRow("Visits", v.row, {
                    employee_in: newEmp
                });
            }

            showToast("تم تغيير الموظف", "success");
            closeEditModal();
            loadActiveVisits();

        } catch (err) {
            console.error(err);
            showToast("خطأ أثناء تغيير الموظف", "error");
        }
    };
}

/* ===========================
   إغلاق مودال التعديل
=========================== */

function closeEditModal() {
    el("modal_edit_container").style.display = "none";
    el("modal_edit").innerHTML = "";
}

el("modal_edit_close").addEventListener("click", closeEditModal);
/* ===========================
   تحميل الزيارات المكتملة (مدفوع)
=========================== */

async function loadCompletedVisits() {
    const box = el("completedList");
    box.innerHTML = "جارِ التحميل...";

    try {
        const res = await apiGetActiveVisits();
        const rows = res.visits || [];

        const paid = rows.filter(v => v.data[15] === "مدفوع");

        if (!paid.length) {
            box.innerHTML = "<p>لا توجد زيارات مكتملة</p>";
            el("paidSummary").innerHTML = "";
            return;
        }

        box.innerHTML = paid.map(v => `
            <div class="car-card">
                <h4>✔ ${v.data[3]} | ${v.data[1]}</h4>
                <p><b>الخدمة:</b> ${v.data[6]}</p>
                <p><b>السعر:</b> ${v.data[7]} ريال</p>
                <p><b>الموظف:</b> ${v.data[9] || "غير محدد"}</p>
                <p><b>طريقة الدفع:</b> ${v.data[16]}</p>
            </div>
        `).join("");

        loadPaidSummary(paid);

    } catch (err) {
        console.error(err);
        box.innerHTML = "<p>خطأ في تحميل الزيارات المكتملة</p>";
    }
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
        <div class="summary-box">
            <p><b>عدد السيارات:</b> ${totalCars}</p>
            <p><b>إجمالي المبلغ:</b> ${totalAmount} ريال</p>
        </div>

        <table class="summary-table" style="margin-top:15px;">
            <tr>
                <th>الموظف</th>
                <th>عدد السيارات</th>
                <th>إجمالي المبلغ</th>
            </tr>
            ${Object.keys(perEmployee).map(emp => `
                <tr>
                    <td>${emp}</td>
                    <td>${perEmployee[emp].cars}</td>
                    <td>${perEmployee[emp].total} ريال</td>
                </tr>
            `).join("")}
        </table>
    `;
}

/* ===========================
   INIT — تشغيل كل شيء
=========================== */

document.addEventListener("DOMContentLoaded", async () => {

    // تحميل البيانات الأساسية
    try {
        const empRes = await apiGetEmployees();
        employeesData = empRes.rows || [];

        const carRes = await apiGetCarTypes();
        carTypesData = carRes.rows || [];

        const servRes = await apiGetServices();
        servicesData = servRes.services || [];

    } catch (err) {
        console.error(err);
        showToast("خطأ في تحميل البيانات الأساسية", "error");
    }

    // تحميل الزيارات
    loadActiveVisits();
    loadCompletedVisits();

    // تحديث القائمة
    el("btnRefreshActive").addEventListener("click", loadActiveVisits);

    // إضافة خدمة
    el("btnAddService").addEventListener("click", addServiceToList);

    // الخصم
    el("discount").addEventListener("input", recalcTotal);

    // تسجيل الزيارة
    el("btnSubmitVisit").addEventListener("click", submitVisit);

    // إغلاق مودال الدفع
    el("modal_close").addEventListener("click", closeModal);
    el("modal_cancel").addEventListener("click", closeModal);

    // إغلاق مودال التعديل
    el("modal_edit_close").addEventListener("click", closeEditModal);

    // الدفع — إظهار طريقة الدفع
    el("payment_status").addEventListener("change", () => {
        const val = el("payment_status").value;

        if (val === "مدفوع") {
            el("payment_method_wrapper").style.display = "block";
        } else {
            el("payment_method_wrapper").style.display = "none";
            el("partial_payment_box").style.display = "none";
        }
    });

    // الدفع الجزئي
    el("payment_method").addEventListener("change", () => {
        const val = el("payment_method").value;

        if (val === "جزئي") {
            el("partial_payment_box").style.display = "block";
        } else {
            el("partial_payment_box").style.display = "none";
        }
    });
});
