/* ===========================================
   رغوة الهجين - إدارة الزيارات (النسخة الكاملة المدمجة)
   تنسيق: متوافق مع api.js و واجهة HTML
=========================================== */

const el = id => document.getElementById(id);
let activeVisits = [];
let selectedPlate = null;
let selectedServices = [];
let carTypesData = [];
let servicesData = [];
let employeesData = [];

// ===========================
// 1. تنبيهات النظام (Toast)
// ===========================
function showToast(msg, type = "info") {
    const box = el("toast-container");
    if (!box) return;
    const div = document.createElement("div");
    div.className = `toast ${type}`;
    div.textContent = msg;
    box.appendChild(div);
    setTimeout(() => div.classList.add("show"), 10);
    setTimeout(() => {
        div.classList.remove("show");
        setTimeout(() => div.remove(), 300);
    }, 3000);
}

// ===========================
// 2. تحميل البيانات الأساسية (مهم جداً لتجنب الأخطاء)
// ===========================
async function initSystemData() {
    try {
        console.log("جاري تحميل بيانات النظام...");
        const [cars, servs, emps, branc] = await Promise.all([
            apiGetCarTypes(), 
            apiGetServices(), 
            apiGetEmployees(), 
            apiGetBranches()
        ]);
        
        carTypesData = cars.rows || [];
        servicesData = servs.services || [];
        employeesData = emps.rows || [];

        // تعبئة البراندات
        const brands = [...new Set(carTypesData.map(r => r[0]))];
        el("car_type").innerHTML = '<option value="">— اختر البراند —</option>' + 
            brands.map(b => `<option value="${b}">${b}</option>`).join("");
        
        // تعبئة تصنيفات الخدمات
        const cats = [...new Set(servicesData.map(s => s.category))];
        el("service_type").innerHTML = '<option value="">— اختر النوع —</option>' + 
            cats.map(c => `<option value="${c}">${c}</option>`).join("");
        
        // تعبئة الموظفين
        el("employee_in").innerHTML = '<option value="">— اختر الموظف —</option>' + 
            employeesData.map(e => `<option value="${e[0]}">${e[0]}</option>`).join("");
        
        // تعبئة الفروع
        const branchSelect = el("branch");
        if (branchSelect) {
            branchSelect.innerHTML = (branc.rows || []).map(b => `<option value="${b[0]}" ${b[0] === "مكة" ? "selected" : ""}>${b[0]}</option>`).join("");
        }

        console.log("تم تحميل البيانات بنجاح.");
    } catch (err) {
        console.error("خطأ في initSystemData:", err);
        showToast("❌ خطأ في تحميل البيانات الأساسية", "error");
    }
}

// ===========================
// 3. تحميل وعرض الزيارات النشطة
// ===========================
async function loadActiveVisits() {
    const list = el("activeVisitsList");
    list.innerHTML = '<div class="loading">جارِ التحميل...</div>';

    try {
        const res = await apiGetActiveVisits(); 
        activeVisits = res.visits || [];
        updateSummary(activeVisits);

        if (!activeVisits.length) {
            list.innerHTML = '<p style="text-align:center;padding:40px;color:#6b7280;">لا توجد زيارات حالياً</p>';
            return;
        }

        const cars = {};
        activeVisits.forEach(v => {
            const r = v.data;
            const plate = r[1];
            if (!cars[plate]) {
                cars[plate] = {
                    plate, brand: r[3] || "", 
                    employee: r[9] || "غير محدد", 
                    parking: r[17] || "-",
                    services: [], totalBeforeDisc: 0, 
                    discount: Number(r[24] || 0)
                };
            }
            const servicePrice = Number(r[7] || 0);
            cars[plate].services.push({ name: r[6], price: servicePrice });
            cars[plate].totalBeforeDisc += servicePrice;
        });

        list.innerHTML = "";
        Object.values(cars).forEach(car => {
            const finalTotal = car.totalBeforeDisc - car.discount;
            const card = document.createElement("div");
            card.className = "car-card";
            card.innerHTML = `
                <div class="card-header">
                    <div>
                        <h4>🚗 لوحة: ${car.plate} — ${car.brand}</h4>
                        <p>👤 الموظف: ${car.employee} | 🅿️ الموقف: ${car.parking}</p>
                    </div>
                    <div class="dropdown">
                        <button class="edit-btn" type="button">⋮ تعديل ▼</button>
                        <div class="dropdown-content edit-menu" data-plate="${car.plate}">
                            <a href="#" data-action="disc">💰 الخصم</a>
                            <a href="#" data-action="delete">🗑️ حذف</a>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <ul>
                        ${car.services.map(s => `<li><span>${s.name}</span><span>${s.price} ريال</span></li>`).join('')}
                    </ul>
                    <div class="price-summary">
                        <p>الإجمالي: ${car.totalBeforeDisc} ريال</p>
                        <p>الخصم: ${car.discount} ريال</p>
                        <p class="final-price">الصافي: ${finalTotal} ريال</p>
                    </div>
                </div>
                <div class="card-footer">
                    <div class="dropdown">
                        <button class="btn-pay full" type="button">💳 تحديث الدفع ▼</button>
                        <div class="dropdown-content pay-menu" data-plate="${car.plate}">
                            <a href="#" data-method="كاش">💵 دفع كاش</a>
                            <a href="#" data-method="شبكة">💳 دفع شبكة</a>
                            <a href="#" data-method="جزئي">💰 دفع جزئي</a>
                        </div>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (err) {
        showToast("خطأ في تحميل الزيارات", "error");
    }
}

function updateSummary(rows) {
    const uniquePlates = new Set(rows.map(v => v.data[1])).size;
    const totalAmount = rows.reduce((sum, v) => sum + Number(v.data[7] || 0), 0);
    el("summaryActive").textContent = rows.length;
    el("summaryCars").textContent = uniquePlates;
    el("summaryTotal").textContent = totalAmount + " ريال";
}

// ===========================
// 4. تسجيل زيارة جديدة
// ===========================
function addServiceToList() {
    const type = el("service_type").value;
    const detail = el("service_detail").value;
    const price = Number(el("price").value || 0);
    const points = Number(el("points").value || 0);

    if (!detail) {
        showToast("⚠️ الرجاء اختيار خدمة أولاً", "warning");
        return;
    }

    selectedServices.push({ category: type, name: detail, price, points });
    renderServicesList();
    recalcTotal();
}

function renderServicesList() {
    const box = el("servicesList");
    box.innerHTML = selectedServices.map((s, i) => `
        <div class="service-item">
            <span>${s.name} (${s.price} ريال)</span>
            <button type="button" class="btn-remove" onclick="removeService(${i})">✕</button>
        </div>
    `).join("");
}

window.removeService = function(index) {
    selectedServices.splice(index, 1);
    renderServicesList();
    recalcTotal();
};

function recalcTotal() {
    const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const discount = Number(el("discount").value || 0);
    el("totalPrice").textContent = Math.max(0, total - discount);
}

async function submitVisit() {
    const plate_numbers = el("plate_numbers").value.trim();
    const employee_in = el("employee_in").value;

    if (!plate_numbers || selectedServices.length === 0 || !employee_in) {
        showToast("⚠️ أكمل البيانات الأساسية والخدمات", "warning");
        return;
    }

    const btn = el("btnSubmitVisit");
    btn.disabled = true;
    btn.textContent = "جاري التسجيل...";

    try {
        const discount = Number(el("discount").value || 0);
        const totalAfter = Math.max(0, selectedServices.reduce((sum, s) => sum + s.price, 0) - discount);
        
        let cash = 0, card = 0;
        const method = el("payment_method").value;
        const status = el("payment_status").value;

        if (status === "مدفوع") {
            if (method === "كاش") cash = totalAfter;
            else if (method === "شبكة") card = totalAfter;
            else { cash = Number(el("cash_amount").value); card = Number(el("card_amount").value); }
        }

        const res = await apiAddVisit({
            plate_numbers,
            plate_letters: el("plate_letters").value,
            car_type: el("car_type").value,
            car_model: el("car_model").value,
            employee_in,
            branch: el("branch").value,
            parking_slot: el("parking_slot").value,
            payment_status: status,
            payment_method: method,
            discount,
            cash_amount: cash,
            card_amount: card,
            services: JSON.stringify(selectedServices.map(s => ({
                name: s.name, price: s.price, points: s.points, commission: s.points
            })))
        });

        if (res.success) {
            showToast("✅ تم التسجيل بنجاح", "success");
            resetForm();
            loadActiveVisits();
        }
    } catch (err) {
        showToast("❌ خطأ في الإرسال", "error");
    } finally {
        btn.disabled = false;
        btn.textContent = "تسجيل الزيارة";
    }
}

// ===========================
// 5. تحديث الدفع والخصم (للسيارات الموجودة)
// ===========================
async function handlePaymentUpdate(plate, method) {
    const rows = activeVisits.filter(v => v.data[1] === plate);
    if (!rows.length) return;

    const totalBefore = rows.reduce((sum, v) => sum + Number(v.data[7] || 0), 0);
    const discount = Number(rows[0].data[24] || 0);
    const finalTotal = totalBefore - discount;

    let cash = 0, card = 0;
    if (method === "كاش") cash = finalTotal;
    else if (method === "شبكة") card = finalTotal;
    else { openPaymentModal(plate, finalTotal); return; }

    if (confirm(`تأكيد دفع ${finalTotal} ريال للوحة ${plate}؟`)) {
        await processFinalClose(rows, method, cash, card, discount);
    }
}

async function processFinalClose(rows, method, cash, card, totalDiscount) {
    try {
        const totalBefore = rows.reduce((sum, v) => sum + Number(v.data[7] || 0), 0);
        for (const v of rows) {
            const price = Number(v.data[7] || 0);
            const rowDiscount = totalBefore > 0 ? (price / totalBefore) * totalDiscount : 0;
            const rowNet = price - rowDiscount;
            
            const rowCash = (cash / (totalBefore - totalDiscount)) * rowNet || 0;
            const rowCard = (card / (totalBefore - totalDiscount)) * rowNet || 0;

            await apiCloseVisit({
                row: v.row,
                payment_status: "مدفوع",
                payment_method: method,
                cash_amount: rowCash.toFixed(2),
                card_amount: rowCard.toFixed(2),
                discount: rowDiscount.toFixed(2)
            });
        }
        showToast("✅ تم الدفع وإغلاق الزيارة", "success");
        loadActiveVisits();
    } catch (err) {
        showToast("❌ فشل إتمام العملية", "error");
    }
}

// ===========================
// 6. المودالات والأحداث المساعدة
// ===========================
function openPaymentModal(plate, amount) {
    selectedPlate = plate;
    el("modal_total_amount").textContent = amount;
    el("paymentModal").style.display = "block";
}

function closePaymentModal() {
    el("paymentModal").style.display = "none";
}

function resetForm() {
    el("plate_numbers").value = "";
    el("plate_letters").value = "";
    el("car_model").value = "";
    el("discount").value = "0";
    selectedServices = [];
    renderServicesList();
    recalcTotal();
}

// ===========================
// التشغيل الرئيسي
// ===========================
window.onload = async function() {
    await initSystemData();
    await loadActiveVisits();

    // ربط الأزرار
    el("btnRefreshActive").onclick = loadActiveVisits;
    el("btnAddService").onclick = addServiceToList;
    el("btnSubmitVisit").onclick = submitVisit;
    el("discount").oninput = recalcTotal;

    // تغيير حالة الدفع (عرض/إخفاء وسائل الدفع)
    el("payment_status").onchange = function() {
        el("payment_method_wrapper").style.display = (this.value === "مدفوع") ? "block" : "none";
    };

    // تغيير نوع الخدمة (تحديث قائمة التفاصيل)
    el("service_type").onchange = function() {
        const cat = this.value;
        const filtered = servicesData.filter(s => s.category === cat);
        el("service_detail").innerHTML = '<option value="">— اختر الخدمة —</option>' + 
            filtered.map(s => `<option value="${s.name}">${s.name}</option>`).join("");
    };

    // اختيار تفاصيل الخدمة (تحديث السعر والعمولة)
    el("service_detail").onchange = function() {
        const s = servicesData.find(item => item.name === this.value);
        if (s) {
            el("price").value = s.price;
            el("points").value = s.commission || s.points || 0;
        }
    };

    // مراقبة النقر العام (للقوائم المنسدلة في الكروت)
    document.addEventListener("click", function(e) {
        if (e.target.classList.contains("edit-btn")) {
            e.target.nextElementSibling.classList.toggle("show");
        }
        if (e.target.dataset.method) {
            const plate = e.target.closest(".pay-menu").dataset.plate;
            handlePaymentUpdate(plate, e.target.dataset.method);
        }
    });
};
