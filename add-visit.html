let selectedMembership = null;
let commissions = [];
let addedServices = [];
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

// إضافة خدمة
function addService() {
    const name = document.getElementById("service_detail").value;
    const price = Number(document.getElementById("price").value);
    const points = Number(document.getElementById("points").value);

    addedServices.push({ name, price, points });

    renderServices();
}

// عرض الخدمات
function renderServices() {
    const box = document.getElementById("servicesList");
    box.innerHTML = "";

    let total = 0;

    addedServices.forEach((s, i) => {
        total += s.price;

        const div = document.createElement("div");
        div.className = "service-card";
        div.innerHTML = `
            <b>${s.name}</b><br>
            السعر: ${s.price} ريال<br>
            النقاط: ${s.points}<br>
            <button class="remove-btn" onclick="removeService(${i})">حذف</button>
        `;
        box.appendChild(div);
    });

    document.getElementById("totalPrice").textContent = total;
}

// حذف خدمة
function removeService(i) {
    addedServices.splice(i, 1);
    renderServices();
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
    if (addedServices.length === 0) return alert("أضف خدمة واحدة على الأقل");

    const branch = document.getElementById("branch").value;
    const payment_status = document.getElementById("payment_status").value;
    const parking_slot = document.getElementById("parking_slot").value;
    const payment_method = document.getElementById("payment_method").value;

    for (const s of addedServices) {
        await apiPost({
            action: "addVisit",
            membership: selectedMembership,
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

    alert("تم تسجيل الزيارة بنجاح");
    location.reload();
}

// تشغيل الصفحة
loadServices();
loadBranches();
