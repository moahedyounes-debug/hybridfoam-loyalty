// ===============================
// 1) البحث عن سيارات العميل
// ===============================

async function vm_searchCustomer() {
    const phone = document.getElementById("phone").value.trim();

    if (phone.length < 10) {
        alert("الرجاء إدخال رقم جوال صحيح");
        return;
    }

    const res = await apiGet({
        action: "getAll",
        sheet: "Cars"
    });

    if (!res.success) {
        alert("خطأ في قراءة بيانات السيارات");
        return;
    }

    const cars = res.rows.filter(c => c[1] == phone);

    const box = document.getElementById("carsBox");
    const list = document.getElementById("carsList");

    if (cars.length === 0) {
        box.style.display = "block";
        list.innerHTML = "<div>لا توجد سيارات لهذا العميل.</div>";
        return;
    }

    box.style.display = "block";
    list.innerHTML = cars.map(c => `
        <div class="car-item">
            <div>
                <strong>${c[2]}</strong> (${c[3]})<br>
                لوحة: ${c[5]} ${c[4]}
            </div>
            <button onclick="vm_selectCar('${c[0]}','${c[2]}','${c[4]}','${c[5]}')">
                اختيار
            </button>
        </div>
    `).join("");
}

// ===============================
// 2) اختيار السيارة
// ===============================

let SELECTED_CAR = null;

function vm_selectCar(membership, carName, letters, numbers) {
    SELECTED_CAR = { membership, carName, letters, numbers };

    document.getElementById("visitBox").style.display = "block";

    vm_loadServices();
}

// ===============================
// 3) تحميل الخدمات
// ===============================

async function vm_loadServices() {
    const res = await apiGet({
        action: "getAll",
        sheet: "Services"
    });

    if (!res.success) {
        alert("خطأ في تحميل الخدمات");
        return;
    }

    const serviceType = document.getElementById("service_type");
    const serviceDetail = document.getElementById("service_detail");

    const types = [...new Set(res.rows.map(r => r[0]))];

    serviceType.innerHTML = types.map(t => `<option value="${t}">${t}</option>`).join("");

    vm_filterServiceDetails();
}

// ===============================
// 4) تصفية تفاصيل الخدمة حسب النوع
// ===============================

async function vm_filterServiceDetails() {
    const type = document.getElementById("service_type").value;

    const res = await apiGet({
        action: "getAll",
        sheet: "Services"
    });

    const details = res.rows.filter(r => r[0] == type);

    document.getElementById("service_detail").innerHTML =
        details.map(d => `<option value="${d[1]}" data-price="${d[2]}">${d[1]}</option>`).join("");

    vm_updatePrice();
}

// ===============================
// 5) تحديث السعر والنقاط
// ===============================

function vm_updatePrice() {
    const detail = document.getElementById("service_detail");
    const price = detail.selectedOptions[0].dataset.price;

    document.getElementById("price").value = price;
    vm_updatePoints();
}

function vm_updatePoints() {
    const price = Number(document.getElementById("price").value);
    document.getElementById("points").value = Math.floor(price / 10);
}

// ===============================
// 6) إضافة الخدمة إلى القائمة
// ===============================

let SERVICES = [];

function vm_addService() {
    const type = document.getElementById("service_type").value;
    const detail = document.getElementById("service_detail").value;
    const price = Number(document.getElementById("price").value);
    const points = Number(document.getElementById("points").value);

    SERVICES.push({ type, detail, price, points });

    vm_renderServices();
}

function vm_renderServices() {
    const list = document.getElementById("servicesList");

    list.innerHTML = SERVICES.map((s, i) => `
        <div class="service-item">
            <div>${s.type} - ${s.detail} (${s.price} ريال)</div>
            <button onclick="vm_removeService(${i})">حذف</button>
        </div>
    `).join("");

    const total = SERVICES.reduce((sum, s) => sum + s.price, 0);
    document.getElementById("totalPrice").innerText = total;
}

function vm_removeService(i) {
    SERVICES.splice(i, 1);
    vm_renderServices();
}

// ===============================
// 7) تسجيل الزيارة
// ===============================

async function vm_submitVisit() {
    if (!SELECTED_CAR) {
        alert("الرجاء اختيار سيارة");
        return;
    }

    if (SERVICES.length === 0) {
        alert("الرجاء إضافة خدمة واحدة على الأقل");
        return;
    }

    const payment_status = document.getElementById("payment_status").value;
    const payment_method = document.getElementById("payment_method").value;
    const parking_slot = document.getElementById("parking_slot").value;
    const branch = document.getElementById("branch").value;

    const now = new Date().toISOString();

    for (let s of SERVICES) {
        await apiGet({
            action: "addRow",
            sheet: "Visits",
            row: [
                SELECTED_CAR.membership,
                s.detail,
                s.price,
                s.points,
                "موظف دخول",
                "",
                branch,
                "",
                now,
                "",
                payment_status,
                payment_method,
                parking_slot,
                "",
                payment_method
            ]
        });
    }

    alert("تم تسجيل الزيارة بنجاح");

    SERVICES = [];
    vm_renderServices();
    vm_loadActiveVisits();
}

// ===============================
// 8) تحميل السيارات داخل المغسلة
// ===============================

async function vm_loadActiveVisits() {
    const res = await apiGet({
        action: "getAll",
        sheet: "Visits"
    });

    const active = res.rows.filter(v => v[10] != "مدفوع");

    const list = document.getElementById("activeVisitsList");

    list.innerHTML = active.map(v => `
        <div class="active-item">
            <div>
                <strong>عضوية السيارة:</strong> ${v[0]}<br>
                <strong>الخدمة:</strong> ${v[1]}<br>
                <strong>الدخول:</strong> ${v[8]}
            </div>
            <button onclick="alert('تسليم السيارة لاحقًا')">تسليم</button>
        </div>
    `).join("");
}
