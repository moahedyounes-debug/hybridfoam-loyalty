/* =====================================================
   Visit Manager — النسخة الذهبية
   كل شيء جاهز ويعمل بدون أخطاء
===================================================== */

let vm_selectedMembership = null;
let vm_commissions = [];
let vm_addedServices = [];
let vm_branches = [];

let vm_loading = {
    search: false,
    submit: false,
    refresh: false,
    closeVisit: false
};

/* =====================================================
   Helper — تفاعل الأزرار
===================================================== */
function vm_setButtonLoading(id, isLoading, textNormal, textLoading) {
    const btn = document.getElementById(id);
    if (!btn) return;

    btn.disabled = isLoading;
    btn.textContent = isLoading ? textLoading : textNormal;
}

/* =====================================================
   Normalize Phone
===================================================== */
function vm_fixPhone(phone) {
    phone = String(phone).trim();
    if (!phone.startsWith("0")) phone = "0" + phone;
    return phone;
}

/* =====================================================
   تحميل الخدمات من شيت العمولة
===================================================== */
async function vm_loadServices() {
    const res = await apiGet({ action: "getCommissions" });

    if (!res.success) {
        alert("خطأ في تحميل الخدمات");
        return;
    }

    vm_commissions = res.commissions || [];

    const types = [...new Set(vm_commissions.map(r => r.type))];
    const typeSelect = document.getElementById("service_type");

    typeSelect.innerHTML = "";
    types.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        typeSelect.appendChild(opt);
    });

    vm_filterServiceDetails();
}

/* =====================================================
   تصفية تفاصيل الخدمة حسب النوع
===================================================== */
function vm_filterServiceDetails() {
    const type = document.getElementById("service_type").value;
    const detailSelect = document.getElementById("service_detail");

    detailSelect.innerHTML = "";

    vm_commissions
        .filter(r => r.type === type)
        .forEach(r => {
            const opt = document.createElement("option");
            opt.value = r.detail;
            opt.textContent = r.detail;
            detailSelect.appendChild(opt);
        });

    vm_updatePrice();
}

/* =====================================================
   تحديث السعر
===================================================== */
function vm_updatePrice() {
    const detail = document.getElementById("service_detail").value;
    const row = vm_commissions.find(r => r.detail === detail);

    document.getElementById("price").value = row ? row.price : 0;
    vm_updatePoints();
}

/* =====================================================
   حساب النقاط
===================================================== */
function vm_updatePoints() {
    const price = Number(document.getElementById("price").value || 0);
    document.getElementById("points").value = Math.floor(price / 5);
}

/* =====================================================
   البحث عن سيارات العميل
===================================================== */
async function vm_searchCustomer() {
    if (vm_loading.search) return;

    let phone = document.getElementById("phone").value.trim();
    phone = vm_fixPhone(phone);

    if (phone.length < 10) {
        alert("أدخل رقم جوال صحيح");
        return;
    }

    vm_loading.search = true;
    vm_setButtonLoading("btnSearch", true, "بحث عن السيارات", "جاري البحث...");

    const res = await apiGet({
        action: "getCarsByPhone",
        phone
    });

    vm_loading.search = false;
    vm_setButtonLoading("btnSearch", false, "بحث عن السيارات", "جاري البحث...");

    if (!res.success || !res.cars || res.cars.length === 0) {
        alert("لا يوجد سيارات لهذا العميل");
        return;
    }

    const carsBox = document.getElementById("carsBox");
    const list = document.getElementById("carsList");

    carsBox.style.display = "block";
    list.innerHTML = "";

    res.cars.forEach(car => {
        const div = document.createElement("div");
        div.className = "car-item";
        div.innerHTML = `
            <b>${car.car}</b> — ${car.plate_letters} ${car.plate_numbers}
            <br>عضوية: ${car.membership}
        `;
        div.onclick = () => vm_selectCar(div, car);
        list.appendChild(div);
    });
}

/* =====================================================
   اختيار السيارة
===================================================== */
function vm_selectCar(element, car) {
    vm_selectedMembership = car.membership;

    document.querySelectorAll(".car-item").forEach(el => el.classList.remove("selected"));
    element.classList.add("selected");

    document.getElementById("visitBox").style.display = "block";
}

/* =====================================================
   إضافة خدمة
===================================================== */
function vm_addService() {
    const name = document.getElementById("service_detail").value;
    const price = Number(document.getElementById("price").value || 0);
    const points = Number(document.getElementById("points").value || 0);

    if (!name) {
        alert("اختر تفاصيل الخدمة");
        return;
    }

    vm_addedServices.push({ name, price, points });
    vm_renderServices();
}

/* =====================================================
   عرض الخدمات
===================================================== */
function vm_renderServices() {
    const box = document.getElementById("servicesList");
    box.innerHTML = "";

    let total = 0;

    vm_addedServices.forEach((s, i) => {
        total += s.price;

        const div = document.createElement("div");
        div.className = "service-card";
        div.innerHTML = `
            <div class="service-card-header">
                <div><b>${s.name}</b></div>
                <button class="remove-btn" onclick="vm_removeService(${i})">حذف</button>
            </div>
            <div>السعر: ${s.price} ريال — النقاط: ${s.points}</div>
        `;
        box.appendChild(div);
    });

    document.getElementById("totalPrice").textContent = total;
}

/* =====================================================
   حذف خدمة
===================================================== */
function vm_removeService(i) {
    vm_addedServices.splice(i, 1);
    vm_renderServices();
}

/* =====================================================
   تحميل الفروع
===================================================== */
async function vm_loadBranches() {
    const res = await apiGet({ action: "getBranches" });

    if (!res.success) return;

    vm_branches = res.branches || [];

    const select = document.getElementById("branch");
    select.innerHTML = `<option value="">— اختر الفرع —</option>`;

    vm_branches.forEach(b => {
        const opt = document.createElement("option");
        opt.value = b.name;
        opt.textContent = b.name;
        select.appendChild(opt);
    });
}

/* =====================================================
   تسجيل الزيارة
===================================================== */
async function vm_submitVisit() {
    if (vm_loading.submit) return;

    if (!vm_selectedMembership) {
        alert("اختر السيارة أولاً");
        return;
    }

    if (vm_addedServices.length === 0) {
        alert("أضف خدمة واحدة على الأقل");
        return;
    }

    const branch = document.getElementById("branch").value;
    const payment_status = document.getElementById("payment_status").value;
    const payment_method = document.getElementById("payment_method").value;
    const parking_slot = document.getElementById("parking_slot").value;

    if (!branch) return alert("اختر الفرع");
    if (!payment_status) return alert("اختر حالة الدفع");

    vm_loading.submit = true;
    vm_setButtonLoading("btnSubmitVisit", true, "تسجيل الزيارة", "جاري التسجيل...");

    for (const s of vm_addedServices) {
        await apiPost({
            action: "addVisit",
            membership: vm_selectedMembership,
            service_type: "",
            service_detail: s.name,
            price: s.price,
            points: s.points,
            employee: "",
            branch,
            payment_status,
            payment_method,
            parking_slot
        });
    }

    vm_loading.submit = false;
    vm_setButtonLoading("btnSubmitVisit", false, "تسجيل الزيارة", "جاري التسجيل...");

    alert("تم تسجيل الزيارة بنجاح");

    vm_resetForm();
    vm_loadActiveVisits();
}

/* =====================================================
   Reset
===================================================== */
function vm_resetForm() {
    vm_selectedMembership = null;
    vm_addedServices = [];

    document.getElementById("phone").value = "";
    document.getElementById("carsBox").style.display = "none";
    document.getElementById("visitBox").style.display = "none";
    document.getElementById("carsList").innerHTML = "";
    document.getElementById("servicesList").innerHTML = "";
    document.getElementById("totalPrice").textContent = "0";

    document.getElementById("payment_status").value = "";
    document.getElementById("payment_method").value = "";
    document.getElementById("parking_slot").value = "";
    document.getElementById("branch").value = "";
}

/* =====================================================
   تحميل الزيارات النشطة
===================================================== */
async function vm_loadActiveVisits() {
    if (vm_loading.refresh) return;

    vm_loading.refresh = true;
    vm_setButtonLoading("btnRefreshActive", true, "تحديث القائمة", "جاري التحديث...");

    const res = await apiGet({ action: "getActiveVisits" });

    const list = document.getElementById("activeVisitsList");
    list.innerHTML = "";

    vm_loading.refresh = false;
    vm_setButtonLoading("btnRefreshActive", false, "تحديث القائمة", "جاري التحديث...");

    if (!res.success || !res.visits || res.visits.length === 0) {
        list.innerHTML = `<div class="small">لا توجد سيارات غير مدفوعة حالياً.</div>`;
        return;
    }

    res.visits.forEach(v => {
        const div = document.createElement("div");
        div.className = "visit-item";

        const statusTag = v.payment_status === "مدفوع"
            ? `<span class="tag tag-success">مدفوع</span>`
            : `<span class="tag tag-danger">غير مدفوع</span>`;

        const parkingTag = v.parking_slot
            ? `<span class="tag">موقف ${v.parking_slot}</span>`
            : `<span class="tag tag-warning">بدون موقف</span>`;

        div.innerHTML = `
            <div class="visit-header">
                <div><b>${v.membership}</b></div>
                <div>${statusTag} ${parkingTag}</div>
            </div>

            <div class="small">
                الخدمة: ${v.service} — السعر: ${v.price} ريال<br>
                الفرع: ${v.branch || "-"} — الموظف: ${v.employee || "-"}<br>
                التاريخ: ${new Date(v.date).toLocaleString("ar-SA")}
            </div>

            <div class="visit-actions">
                <button class="btn-secondary" onclick="vm_openCloseVisitDialog(${v.row}, '${v.membership}', '${v.service.replace(/'/g, "\\'")}')">
                    تسجيل خروج / دفع
                </button>
            </div>
        `;

        list.appendChild(div);
    });
}

/* =====================================================
   نافذة الدفع
===================================================== */
function vm_openCloseVisitDialog(row, membership, service) {
    if (vm_loading.closeVisit) return;

    const payment_status = prompt(`حالة الدفع للعضوية ${membership} (مدفوع / غير مدفوع):`, "مدفوع");
    if (!payment_status) return;

    const payment_method = prompt(`طريقة الدفع (كاش / شبكة) — يمكن تركها فارغة لو الدفع لاحقاً:`, "");

    vm_closeVisit(row, payment_status, payment_method);
}

/* =====================================================
   إغلاق الزيارة
===================================================== */
async function vm_closeVisit(row, payment_status, payment_method) {
    if (vm_loading.closeVisit) return;

    vm_loading.closeVisit = true;

    const res = await apiPost({
        action: "closeVisit",
        row,
        payment_status,
        payment_method
    });

    vm_loading.closeVisit = false;

    if (!res.success) {
        alert("حدث خطأ أثناء تحديث حالة الدفع");
        return;
    }

    alert("تم تحديث حالة الزيارة بنجاح");
    vm_loadActiveVisits();
}

/* =====================================================
   تشغيل الصفحة
===================================================== */
window.addEventListener("DOMContentLoaded", () => {
    vm_loadServices();
    vm_loadBranches();
    vm_loadActiveVisits();
});
