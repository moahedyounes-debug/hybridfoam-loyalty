/* ============================================================
   Visit Manager PRO – Fixed & Enhanced Version
   ============================================================ */

/* عناصر الصفحة */
const plate_numbers = document.getElementById("plate_numbers");
const plate_letters = document.getElementById("plate_letters");

const car_type = document.getElementById("car_type");   // الآن = brand
const car_size = document.getElementById("car_size");

const service_type = document.getElementById("service_type");
const service_detail = document.getElementById("service_detail");

const price = document.getElementById("price");
const points = document.getElementById("points");

const employee_in = document.getElementById("employee_in");
const branch = document.getElementById("branch");

const payment_status = document.getElementById("payment_status");
const payment_method = document.getElementById("payment_method");
const payment_method_wrapper = document.getElementById("payment_method_wrapper");

const parking_slot = document.getElementById("parking_slot");
const discount = document.getElementById("discount");

const btnSubmitVisit = document.getElementById("btnSubmitVisit");
const servicesList = document.getElementById("servicesList");
const totalPrice = document.getElementById("totalPrice");

let addedServices = [];

/* ============================================================
   تحميل بيانات السيارة (Car-Type) — الآن Brand وليس Model
   ============================================================ */
async function loadCarBrands() {
    const res = await apiGetCarTypes();
    if (!res.success) return;

    car_type.innerHTML = "";

    res.rows.forEach(row => {
        const brand = row[0]; // أول عمود = Brand
        const size = row[1];  // ثاني عمود = Size

        const opt = document.createElement("option");
        opt.value = brand;
        opt.dataset.size = size;
        opt.textContent = brand;

        car_type.appendChild(opt);
    });

    car_type.addEventListener("change", () => {
        const selected = car_type.selectedOptions[0];
        car_size.value = selected.dataset.size || "";
    });
}

/* ============================================================
   تحميل الموظفين
   ============================================================ */
async function loadEmployees() {
    const res = await apiGetEmployees();
    if (!res.success) return;

    employee_in.innerHTML = "";

    res.rows.forEach(row => {
        const name = row[0];
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        employee_in.appendChild(opt);
    });
}

/* ============================================================
   تحميل الخدمات
   ============================================================ */
async function loadServices() {
    const res = await apiGetServices();
    if (!res.success) return;

    const categories = [...new Set(res.services.map(s => s.category))];

    service_type.innerHTML = "";
    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        service_type.appendChild(opt);
    });

    service_type.addEventListener("change", () => {
        const selected = service_type.value;
        const filtered = res.services.filter(s => s.category === selected);

        service_detail.innerHTML = "";
        filtered.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s.service;
            opt.dataset.price = s.price;
            opt.dataset.points = s.duration;
            opt.dataset.commission = s.commission;
            opt.textContent = s.service;
            service_detail.appendChild(opt);
        });

        updateServiceInfo();
    });

    service_detail.addEventListener("change", updateServiceInfo);
}

function updateServiceInfo() {
    const opt = service_detail.selectedOptions[0];
    if (!opt) return;

    price.value = opt.dataset.price;
    points.value = opt.dataset.points;
}

/* ============================================================
   إضافة خدمة
   ============================================================ */
document.getElementById("btnAddService").addEventListener("click", () => {
    const opt = service_detail.selectedOptions[0];
    if (!opt) return;

    const service = {
        name: opt.value,
        price: Number(opt.dataset.price),
        points: Number(opt.dataset.points),
        commission: Number(opt.dataset.commission)
    };

    addedServices.push(service);
    renderServices();
});

function renderServices() {
    servicesList.innerHTML = "";

    addedServices.forEach((s, i) => {
        const div = document.createElement("div");
        div.className = "service-item";
        div.innerHTML = `
            <span>${s.name}</span>
            <span>${s.price} ريال</span>
            <button onclick="removeService(${i})">حذف</button>
        `;
        servicesList.appendChild(div);
    });

    const total = addedServices.reduce((sum, s) => sum + s.price, 0);
    totalPrice.textContent = total;
}

function removeService(i) {
    addedServices.splice(i, 1);
    renderServices();
}

/* ============================================================
   إظهار طريقة الدفع عند اختيار "مدفوع"
   ============================================================ */
payment_status.addEventListener("change", () => {
    payment_method_wrapper.style.display =
        payment_status.value === "مدفوع" ? "block" : "none";
});

/* ============================================================
   تسجيل الزيارة
   ============================================================ */
btnSubmitVisit.addEventListener("click", async () => {

    if (btnSubmitVisit.disabled) return;

    btnSubmitVisit.disabled = true;
    btnSubmitVisit.textContent = "جاري تسجيل الزيارة...";

    if (addedServices.length === 0) {
        alert("يجب إضافة خدمة واحدة على الأقل");
        btnSubmitVisit.disabled = false;
        btnSubmitVisit.textContent = "تسجيل الزيارة";
        return;
    }

    const total = addedServices.reduce((sum, s) => sum + s.price, 0);
    const finalTotal = total - Number(discount.value || 0);

    const data = {
        membership: "—", // لأنك ما تستخدم عضوية هنا
        service_detail: addedServices.map(s => s.name).join(", "),
        price: finalTotal,
        points: addedServices.reduce((sum, s) => sum + s.points, 0),
        employee_in: employee_in.value,
        employee_out: "",
        branch: branch.value,
        commission: addedServices.reduce((sum, s) => sum + s.commission, 0),
        payment_status: payment_status.value,
        payment_method: payment_method.value,
        parking_slot: parking_slot.value,
        rating: ""
    };

    const res = await apiAddVisit(data);

    if (!res.success) {
        alert("خطأ: " + res.error);
        btnSubmitVisit.disabled = false;
        btnSubmitVisit.textContent = "تسجيل الزيارة";
        return;
    }

    alert("تم تسجيل الزيارة بنجاح");

    addedServices = [];
    renderServices();

    btnSubmitVisit.disabled = false;
    btnSubmitVisit.textContent = "تسجيل الزيارة";
});

/* ============================================================
   تحميل السيارات داخل المغسلة
   ============================================================ */
async function loadActiveVisits() {
    const box = document.getElementById("activeVisitsList");
    box.innerHTML = "جاري التحميل...";

    const res = await apiGetActiveVisits();
    if (!res.success || !res.visits.length) {
        box.innerHTML = "<p>لا توجد سيارات داخل المغسلة حالياً</p>";
        return;
    }

    box.innerHTML = res.visits.map(v => {
        const d = v.data;
        return `
            <div class="card">
                <p><b>الخدمة:</b> ${d[1]}</p>
                <p><b>السعر:</b> ${d[2]} ريال</p>
                <p><b>الموقف:</b> ${d[12]}</p>
                <button onclick="markPaid(${v.row})">تحديث الدفع</button>
            </div>
        `;
    }).join("");
}

async function markPaid(row) {
    await apiCloseVisit(row, {
        payment_status: "مدفوع",
        payment_method: "كاش"
    });
    loadActiveVisits();
}

/* ============================================================
   تشغيل الصفحة
   ============================================================ */
loadCarBrands();
loadEmployees();
loadServices();
loadActiveVisits();

document.getElementById("btnRefreshActive").addEventListener("click", loadActiveVisits);
