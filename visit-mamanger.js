/* =====================================================
   متغيرات عامة
===================================================== */
let vm_selectedMembership = "";
let vm_services = [];
let vm_commissions = [];

/* =====================================================
   أدوات مساعدة
===================================================== */
function disableBtn(btn, text) {
    btn.dataset.old = btn.innerText;
    btn.innerText = text;
    btn.disabled = true;
}

function enableBtn(btn) {
    btn.innerText = btn.dataset.old;
    btn.disabled = false;
}

/* =====================================================
   تحميل البيانات عند فتح الصفحة
===================================================== */
window.onload = async function () {
    await vm_loadCommissions();
    await vm_loadActiveVisits();
};

/* =====================================================
   1) تحميل الخدمات من شيت Commissions
===================================================== */
async function vm_loadCommissions() {
    const res = await apiGet({
        action: "getAll",
        sheet: "Commissions"
    });

    if (!res.success) {
        alert("خطأ في تحميل الخدمات");
        return;
    }

    vm_commissions = res.rows;

    const serviceType = document.getElementById("service_type");
    serviceType.innerHTML = `<option value="">— اختر نوع الخدمة —</option>`;

    const types = [...new Set(vm_commissions.map(s => s[4]))]; // Category

    types.forEach(t => {
        serviceType.innerHTML += `<option value="${t}">${t}</option>`;
    });
}

/* =====================================================
   2) البحث عن العميل
===================================================== */
async function vm_searchCustomer() {
    const phone = document.getElementById("phone").value.trim();
    const btn = document.getElementById("btnSearch");

    if (!phone) return alert("أدخل رقم الجوال");

    disableBtn(btn, "جاري البحث...");

    const res = await apiGet({
        action: "getCarsByPhone",
        phone
    });

    enableBtn(btn);

    const carsBox = document.getElementById("carsBox");
    const carsList = document.getElementById("carsList");

    carsList.innerHTML = "";
    carsBox.style.display = "block";

    if (!res.success || res.cars.length === 0) {
        carsList.innerHTML = "<p>لا توجد سيارات لهذا العميل</p>";
        return;
    }

    res.cars.forEach(car => {
        const div = document.createElement("div");
        div.className = "car-item";
        div.innerHTML = `
            <div>
                <strong>${car[2]}</strong> (${car[3]})<br>
                ${car[4]} - ${car[5]}
            </div>
            <button onclick="vm_selectCar('${car[0]}')">اختيار</button>
        `;
        carsList.appendChild(div);
    });
}

/* =====================================================
   3) اختيار السيارة
===================================================== */
function vm_selectCar(membership) {
    vm_selectedMembership = membership;
    document.getElementById("visitBox").style.display = "block";
}

/* =====================================================
   4) فلترة تفاصيل الخدمة
===================================================== */
function vm_filterServiceDetails() {
    const type = document.getElementById("service_type").value;
    const detail = document.getElementById("service_detail");

    detail.innerHTML = `<option value="">— اختر الخدمة —</option>`;

    vm_commissions
        .filter(s => s[4] === type)
        .forEach(s => {
            detail.innerHTML += `<option value="${s[0]}">${s[0]}</option>`;
        });
}

/* =====================================================
   5) تحديث السعر والنقاط
===================================================== */
function vm_updatePrice() {
    const detail = document.getElementById("service_detail").value;
    const service = vm_commissions.find(s => s[0] === detail);
    if (!service) return;

    document.getElementById("price").value = service[2];
    document.getElementById("points").value = service[1];
}

/* =====================================================
   6) إضافة خدمة
===================================================== */
function vm_addService() {
    const detail = document.getElementById("service_detail").value;
    const price = Number(document.getElementById("price").value);
    const points = Number(document.getElementById("points").value);

    if (!detail || !price) return alert("اختر خدمة");

    vm_services.push({ detail, price, points });
    vm_renderServices();
}

/* =====================================================
   7) عرض الخدمات
===================================================== */
function vm_renderServices() {
    const list = document.getElementById("servicesList");
    list.innerHTML = "";

    let total = 0;

    vm_services.forEach((s, i) => {
        total += s.price;

        const div = document.createElement("div");
        div.className = "service-item";
        div.innerHTML = `
            ${s.detail} — ${s.price} ريال
            <button onclick="vm_removeService(${i})">حذف</button>
        `;
        list.appendChild(div);
    });

    document.getElementById("totalPrice").innerText = total;
}

/* =====================================================
   8) حذف خدمة
===================================================== */
function vm_removeService(index) {
    vm_services.splice(index, 1);
    vm_renderServices();
}

/* =====================================================
   9) تسجيل الزيارة
===================================================== */
async function vm_submitVisit() {
    const btn = document.getElementById("btnSubmitVisit");

    if (!vm_selectedMembership) return alert("اختر السيارة");
    if (vm_services.length === 0) return alert("أضف خدمة واحدة على الأقل");

    const payment_status = document.getElementById("payment_status").value;
    const payment_method = document.getElementById("payment_method").value;
    const parking_slot = document.getElementById("parking_slot").value;
    const branch = document.getElementById("branch").value;

    if (!payment_status || !payment_method || !branch)
        return alert("أكمل جميع الحقول");

    disableBtn(btn, "جاري إضافة الزيارة...");

    const now = new Date().toISOString();

    for (const s of vm_services) {
        await apiPost({
            action: "addRow",
            sheet: "Visits",
            values: JSON.stringify([
                vm_selectedMembership, // membership
                s.detail,              // service_detail
                s.price,               // price
                s.points,              // points
                "الموظف",             // employee_in
                "",                    // employee_out
                branch,                // branch
                "",                    // commission
                now,                   // check_in
                "",                    // check_out
                payment_status,        // payment_status
                payment_method,        // payment_method
                parking_slot,          // parking_slot
                "",                    // rating
                payment_method         // Payment Method (duplicate)
            ])
        });
    }

    enableBtn(btn);
    alert("تم تسجيل الزيارة");

    vm_services = [];
    vm_renderServices();
    vm_loadActiveVisits();
}

/* =====================================================
   10) تحميل الزيارات النشطة
===================================================== */
async function vm_loadActiveVisits() {
    const res = await apiGet({
        action: "getAll",
        sheet: "Visits"
    });

    const list = document.getElementById("activeVisitsList");
    list.innerHTML = "";

    if (!res.success || res.rows.length === 0) {
        list.innerHTML = "<p>لا توجد زيارات نشطة</p>";
        return;
    }

    const active = res.rows.filter(v => v[10] !== "مدفوع");

    active.forEach((v, i) => {
        const div = document.createElement("div");
        div.className = "active-item";

        div.innerHTML = `
            <div>
                <strong>${v[0]}</strong><br>
                ${v[1]}<br>
                السعر: ${v[2]} ريال
            </div>
            <button onclick="vm_closeVisit(${i + 2})">إغلاق</button>
        `;

        list.appendChild(div);
    });
}

/* =====================================================
   11) إغلاق الزيارة
===================================================== */
async function vm_closeVisit(row) {
    const payment_status = prompt("حالة الدفع (مدفوع / غير مدفوع):");
    const payment_method = prompt("طريقة الدفع (كاش / شبكة):");

    if (!payment_status || !payment_method) return;

    await apiPost({
        action: "updateRow",
        sheet: "Visits",
        row,
        values: JSON.stringify([
            "", "", "", "", "", "", "", "", "", "",
            payment_status,
            payment_method,
            "", "", payment_method
        ])
    });

    alert("تم إغلاق الزيارة");
    vm_loadActiveVisits();
}
