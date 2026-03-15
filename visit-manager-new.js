/* ===========================
   عناصر أساسية
=========================== */

const el = id => document.getElementById(id);

const carsContainer = document.getElementById("carsContainer");
const btnAddCar = document.getElementById("btnAddCar");
const btnSubmitVisit = document.getElementById("btnSubmitVisit");
const template = document.getElementById("carCardTemplate");

let activeVisits = [];
let carTypesData = [];
let servicesData = [];
let employeesData = [];

/* ===========================
   تحميل أنواع السيارات
=========================== */
async function loadCarTypes() {
    try {
        const res = await apiGetCarTypes();
        carTypesData = res.rows || [];
    } catch (err) {
        console.error(err);
    }
}

/* ===========================
   تحميل الخدمات
=========================== */
async function loadServices() {
    try {
        const res = await apiGetServices();
        servicesData = res.services || [];
    } catch (err) {
        console.error(err);
    }
}

/* ===========================
   تحميل الموظفين
=========================== */
async function loadEmployees() {
    try {
        const res = await apiGetEmployees();
        employeesData = res.rows || [];
    } catch (err) {
        console.error(err);
    }
}

/* ===========================
   تحميل الزيارات النشطة
=========================== */
async function loadActiveVisits() {
    try {
        const res = await apiGetActiveVisits();
        activeVisits = res.visits || [];
    } catch (err) {
        console.error(err);
    }
}

/* ===========================
   تشغيل التحميل عند فتح الصفحة
=========================== */
window.addEventListener("DOMContentLoaded", async () => {
    await loadCarTypes();
    await loadServices();
    await loadEmployees();
    await loadActiveVisits();
});
/* ===========================
   إضافة سيارة جديدة
=========================== */

btnAddCar.addEventListener("click", () => {
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector(".car-card");

    // زر حذف السيارة
    card.querySelector(".btn-remove-car").addEventListener("click", () => {
        card.remove();
        updateSubmitButton();
    });

    // زر إضافة خدمة داخل الكارد
    card.querySelector(".btnAddService").addEventListener("click", () => {
        addServiceItem(card);
    });

    carsContainer.appendChild(card);
    updateSubmitButton();
});

/* ===========================
   تحديث زر تسجيل الزيارة
=========================== */

function updateSubmitButton() {
    const count = document.querySelectorAll(".car-card").length;

    if (count > 1) {
        btnSubmitVisit.textContent = "💾 تسجيل الزيارات";
    } else {
        btnSubmitVisit.textContent = "💾 تسجيل الزيارة";
    }
}

/* ===========================
   إضافة خدمة داخل السيارة
=========================== */

function addServiceItem(card) {
    const box = card.querySelector(".servicesList");

    const div = document.createElement("div");
    div.className = "service-item";

    div.innerHTML = `
        <span>خدمة إضافية</span>
        <button class="btn-remove-service">✕</button>
    `;

    div.querySelector(".btn-remove-service").addEventListener("click", () => {
        div.remove();
    });

    box.appendChild(div);
}
/* ===========================
   دالة submitVisit الأصلية
=========================== */

async function submitVisit(data) {
    return apiAddVisit({
        membership: data.plate_numbers,
        plate_numbers: data.plate_numbers,
        plate_letters: data.plate_letters,
        car_type: data.car_type,
        car_model: data.car_model,
        car_size: data.car_size,
        employee_in: data.employee_in,
        branch: "مكة",
        parking_slot: data.parking_slot,
        payment_status: data.payment_status,
        payment_method: data.payment_method,
        discount: data.discount,
        tip: data.tip,
        cash_amount: data.cash_amount,
        card_amount: data.card_amount,
        services: JSON.stringify([
            {
                name: data.service_detail,
                price: Number(data.price),
                points: Number(data.points),
                commission: Number(data.points)
            }
        ])
    });
}
/* ===========================
   إرسال كل سيارة باستخدام submitVisit()
=========================== */

btnSubmitVisit.addEventListener("click", async () => {
    const cars = document.querySelectorAll(".car-card");

    if (cars.length === 0) {
        alert("أضف سيارة واحدة على الأقل");
        return;
    }

    for (const card of cars) {

        const data = {
            plate_numbers: card.querySelector(".plate_numbers").value,
            plate_letters: card.querySelector(".plate_letters").value,
            car_type: card.querySelector(".car_type").value,
            car_model: card.querySelector(".car_model").value,
            service_type: card.querySelector(".service_type").value,
            service_detail: card.querySelector(".service_detail").value,
            price: card.querySelector(".price").value,
            points: card.querySelector(".points").value,
            employee_in: card.querySelector(".employee_in").value,
            parking_slot: card.querySelector(".parking_slot").value,
            discount: card.querySelector(".discount").value,
            tip: card.querySelector(".tip").value,
            car_size: card.querySelector(".car_size").value,
            payment_status: card.querySelector(".payment_status").value,
            payment_method: card.querySelector(".payment_method").value,
            cash_amount: card.querySelector(".cash_amount").value,
            card_amount: card.querySelector(".card_amount").value
        };

        try {
            await submitVisit(data);
            console.log("✔ تمت إضافة زيارة:", data.plate_numbers);
        } catch (err) {
            console.error("❌ خطأ أثناء إرسال الزيارة:", err);
            alert("حدث خطأ أثناء إرسال زيارة السيارة: " + data.plate_numbers);
        }
    }

    alert("🎉 تم تسجيل جميع الزيارات بنجاح");
});
