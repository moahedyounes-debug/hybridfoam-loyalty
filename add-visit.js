let selectedMembership = null;
let commissions = [];
let branches = [];

// تحميل الخدمات
async function loadServices() {
    const res = await apiGet({ action: "getCommissions" });
    commissions = res.commissions;

    const types = [...new Set(commissions.map(r => r.type))];

    const typeSelect = document.getElementById("service_type");
    typeSelect.innerHTML = "";

    types.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        typeSelect.appendChild(opt);
    });

    filterServiceDetails();
}

// تصفية تفاصيل الخدمة
function filterServiceDetails() {
    const type = document.getElementById("service_type").value;
    const detailSelect = document.getElementById("service_detail");

    detailSelect.innerHTML = "";

    commissions
        .filter(r => r.type === type)
        .forEach(r => {
            const opt = document.createElement("option");
            opt.value = r.detail;
            opt.textContent = r.detail;
            detailSelect.appendChild(opt);
        });

    updatePrice();
}

// تحديث السعر
function updatePrice() {
    const detail = document.getElementById("service_detail").value;
    const row = commissions.find(r => r.detail === detail);

    document.getElementById("price").value = row ? row.price : 0;
    updatePoints();
}

// النقاط
function updatePoints() {
    const price = Number(document.getElementById("price").value || 0);
    document.getElementById("points").value = Math.floor(price / 5);
}

// البحث عن سيارات العميل
async function searchCustomer() {
    const phone = document.getElementById("phone").value.trim();
    if (!phone) return alert("أدخل رقم الجوال");

    const res = await apiGet({ action: "getCarsByPhone", phone });

    if (!res.success || res.cars.length === 0) {
        alert("لا يوجد سيارات لهذا العميل");
        return;
    }

    document.getElementById("carsBox").style.display = "block";

    const list = document.getElementById("carsList");
    list.innerHTML = "";

    res.cars.forEach(car => {
        const div = document.createElement("div");
        div.className = "car-item";
        div.innerHTML = `
            <b>${car.car}</b> — ${car.plate_letters} ${car.plate_numbers}
            <br>عضوية: ${car.membership}
        `;
        div.onclick = () => selectCar(div, car);
        list.appendChild(div);
    });
}

// اختيار السيارة
function selectCar(element, car) {
    selectedMembership = car.membership;
    selectedCar = car;

    document.querySelectorAll(".car-item").forEach(el => el.classList.remove("selected"));
    element.classList.add("selected");

    document.getElementById("visitBox").style.display = "block";
}

// تحميل الفروع
async function loadBranches() {
    const res = await apiGet({ action: "getBranches" });
    branches = res.branches;

    const select = document.getElementById("branch");
    select.innerHTML = "";

    branches.forEach(b => {
        const opt = document.createElement("option");
        opt.value = b.name;
        opt.textContent = b.name;
        select.appendChild(opt);
    });
}

// إرسال الزيارة
async function submitVisit() {
    if (!selectedMembership) return alert("اختر السيارة أولاً");

    const res = await apiPost({
        action: "addVisit",
        membership: selectedMembership,
        service_type: document.getElementById("service_type").value,
        service_detail: document.getElementById("service_detail").value,
        price: document.getElementById("price").value,
        points: document.getElementById("points").value,
        employee: "",
        branch: document.getElementById("branch").value,
        payment_status: document.getElementById("payment_status").value,
        parking_slot: document.getElementById("parking_slot").value
    });

    if (res.success) {
        alert("تم تسجيل الزيارة بنجاح");
        location.reload();
    } else {
        alert("خطأ في التسجيل");
    }
}

// تشغيل الصفحة
loadServices();
loadBranches();
