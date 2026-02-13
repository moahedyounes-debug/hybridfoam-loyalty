/* ============================
   متغيرات عامة
============================ */
let vm_selectedMembership = "";
let vm_services = [];
let vm_commissions = [];

/* ============================
   تحميل البيانات عند فتح الصفحة
============================ */
window.onload = async function () {
    await vm_loadCommissions();
    await vm_loadActiveVisits();
};

/* ============================
   1) تحميل الخدمات من Commissions
============================ */
async function vm_loadCommissions() {
    const res = await apiGet({ action: "getCommissions" });
    if (!res.success) return;

    vm_commissions = res.commissions;

    const serviceType = document.getElementById("service_type");
    serviceType.innerHTML = `<option value="">— اختر نوع الخدمة —</option>`;

    const types = [...new Set(vm_commissions.map(s => s.service_type))];

    types.forEach(t => {
        serviceType.innerHTML += `<option value="${t}">${t}</option>`;
    });
}

/* ============================
   2) البحث عن العميل
============================ */
async function vm_searchCustomer() {
    const phone = document.getElementById("phone").value.trim();
    if (!phone) return alert("أدخل رقم الجوال");

    const res = await apiGet({
        action: "checkCustomer",
        phone
    });

    if (!res.success || res.status === "new") {
        alert("العميل غير موجود");
        return;
    }

    const carsBox = document.getElementById("carsBox");
    const carsList = document.getElementById("carsList");

    carsList.innerHTML = "";
    carsBox.style.display = "block";

    res.cars.forEach(car => {
        const div = document.createElement("div");
        div.className = "car-item";
        div.innerHTML = `
            <div>
                <strong>${car.car}</strong> (${car.size})<br>
                ${car.plate_letters} - ${car.plate_numbers}
            </div>
            <button onclick="vm_selectCar('${car.membership}')">اختيار</button>
        `;
        carsList.appendChild(div);
    });
}

/* ============================
   3) اختيار السيارة
============================ */
function vm_selectCar(membership) {
    vm_selectedMembership = membership;
    document.getElementById("visitBox").style.display = "block";
}

/* ============================
   4) فلترة تفاصيل الخدمة
============================ */
function vm_filterServiceDetails() {
    const type = document.getElementById("service_type").value;
    const detail = document.getElementById("service_detail");

    detail.innerHTML = `<option value="">— اختر الخدمة —</option>`;

    vm_commissions
        .filter(s => s.service_type === type)
        .forEach(s => {
            detail.innerHTML += `<option value="${s.service}">${s.service}</option>`;
        });
}

/* ============================
   5) تحديث السعر والنقاط
============================ */
function vm_updatePrice() {
    const detail = document.getElementById("service_detail").value;
    const service = vm_commissions.find(s => s.service === detail);
    if (!service) return;

    document.getElementById("price").value = service.price;
    document.getElementById("points").value = service.commission;
}

/* ============================
   6) إضافة خدمة
============================ */
function vm_addService() {
    const detail = document.getElementById("service_detail").value;
    const price = Number(document.getElementById("price").value);
    const points = Number(document.getElementById("points").value);

    if (!detail || !price) return alert("اختر خدمة");

    vm_services.push({ detail, price, points });
    vm_renderServices();
}

/* ============================
   7) عرض الخدمات
============================ */
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

/* ============================
   8) حذف خدمة
============================ */
function vm_removeService(index) {
    vm_services.splice(index, 1);
    vm_renderServices();
}

/* ============================
   9) تسجيل الزيارة
============================ */
async function vm_submitVisit() {
    if (!vm_selectedMembership) return alert("اختر السيارة");
    if (vm_services.length === 0) return alert("أضف خدمة واحدة على الأقل");

    const payment_status = document.getElementById("payment_status").value;
    const payment_method = document.getElementById("payment_method").value;
    const parking_slot = document.getElementById("parking_slot").value;
    const branch = document.getElementById("branch").value;

    if (!payment_status || !payment_method || !branch)
        return alert("أكمل جميع الحقول");

    for (const s of vm_services) {
        await apiPost({
            action: "addVisit",
            membership: vm_selectedMembership,
            service_type: s.detail,
            service_detail: s.detail,
            price: s.price,
            points: s.points,
            employee_in: "الموظف",
            branch,
            payment_status,
            payment_method,
            parking_slot
        });
    }

    alert("تم تسجيل الزيارة");
    vm_services = [];
    vm_renderServices();
    vm_loadActiveVisits();
}

/* ============================
   10) تحميل الزيارات النشطة
============================ */
async function vm_loadActiveVisits() {
    const res = await apiGet({ action: "getActiveVisits" });
    const list = document.getElementById("activeVisitsList");

    list.innerHTML = "";

    if (!res.success || res.visits.length === 0) {
        list.innerHTML = "<p>لا توجد زيارات نشطة</p>";
        return;
    }

    res.visits.forEach(v => {
        const div = document.createElement("div");
        div.className = "active-item";

        div.innerHTML = `
            <div>
                <strong>${v.membership}</strong><br>
                ${v.service_detail}<br>
                السعر: ${v.price} ريال
            </div>
            <button onclick="vm_closeVisit(${v.row})">إغلاق</button>
        `;

        list.appendChild(div);
    });
}

/* ============================
   11) إغلاق الزيارة
============================ */
async function vm_closeVisit(row) {
    const payment_status = prompt("حالة الدفع (مدفوع / غير مدفوع):");
    const payment_method = prompt("طريقة الدفع (كاش / شبكة):");

    if (!payment_status || !payment_method) return;

    await apiPost({
        action: "closeVisit",
        row,
        payment_status,
        payment_method
    });

    alert("تم إغلاق الزيارة");
    vm_loadActiveVisits();
}
