/* ===========================================
   رغوة الهجين - إدارة الزيارات (الدفعة 1)
   تنبيه: هذا الكود يعتمد على الدوال المعرفة في api.js
=========================================== */

const el = id => document.getElementById(id);
let activeVisits = [];
let selectedPlate = null;
let selectedServices = [];
let carTypesData = [];
let servicesData = [];
let employeesData = [];

// ===========================
// تنبيهات النظام
// ===========================
function showToast(msg, type = "info") {
    const box = el("toast-container");
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
// تحميل وعرض الزيارات النشطة
// ===========================
async function loadActiveVisits() {
    const list = el("activeVisitsList");
    list.innerHTML = '<div class="loading">جارِ التحميل...</div>';

    try {
        const res = await apiGetActiveVisits(); // استخدام دالتك من api.js
        activeVisits = res.visits || [];
        updateSummary(activeVisits);

        if (!activeVisits.length) {
            list.innerHTML = '<p style="text-align:center;padding:40px;color:#6b7280;">لا توجد زيارات حالياً</p>';
            return;
        }

        // تجميع الزيارات حسب اللوحة (لو كانت السيارة لها أكثر من خدمة)
        const cars = {};
        activeVisits.forEach(v => {
            const r = v.data;
            const plate = r[1];
            if (!cars[plate]) {
                cars[plate] = {
                    plate, 
                    brand: r[3] || "", 
                    employee: r[9] || "غير محدد", 
                    parking: r[17] || "-",
                    services: [], 
                    totalBeforeDisc: 0, 
                    discount: Number(r[24] || 0)
                };
            }
            const servicePrice = Number(r[7] || 0);
            cars[plate].services.push({ name: r[6], price: servicePrice });
            cars[plate].totalBeforeDisc += servicePrice;
        });

        // بناء بطاقات السيارات
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
                            <a href="#" data-action="swap">🔄 تبديل خدمة</a>
                            <a href="#" data-action="delete">🗑️ حذف خدمة</a>
                            <a href="#" data-action="add">➕ إضافة خدمة</a>
                            <a href="#" data-action="emp">👤 تغيير الموظف</a>
                            <a href="#" data-action="disc">💰 الخصم</a>
                            <a href="#" data-action="tip">🎁 الإكرامية</a>
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
        console.error(err);
        showToast("خطأ في تحميل الزيارات", "error");
    }
}

// تحديث شريط الملخص العلوي
function updateSummary(rows) {
    const uniquePlates = new Set(rows.map(v => v.data[1])).size;
    const totalAmount = rows.reduce((sum, v) => sum + Number(v.data[7] || 0), 0);
    el("summaryActive").textContent = rows.length;
    el("summaryCars").textContent = uniquePlates;
    el("summaryTotal").textContent = totalAmount + " ريال";
}
/* ===========================================
   رغوة الهجين - إدارة الزيارات (الدفعة 2)
   منطق تسجيل الزيارة وحساب العمولات
=========================================== */

// ===========================
// إضافة خدمة إلى القائمة المؤقتة
// ===========================
function addServiceToList() {
    const type = el("service_type").value;
    const detail = el("service_detail").value;
    const price = Number(el("price").value || 0);
    const points = Number(el("points").value || 0); // هذه هي العمولة/النقاط

    if (!detail) {
        showToast("⚠️ الرجاء اختيار خدمة أولاً", "warning");
        return;
    }

    // التحقق من عدم تكرار نفس الخدمة لنفس السيارة في نفس الطلب
    const exists = selectedServices.some(s => s.name === detail);
    if (exists) {
        showToast("⚠️ هذه الخدمة مضافة بالفعل", "warning");
        return;
    }

    // إضافة الخدمة مع بياناتها كاملة (السعر والعمولة)
    selectedServices.push({
        category: type,
        name: detail,
        price: price,
        points: points
    });

    renderServicesList();
    recalcTotal();

    // إعادة ضبط حقول الخدمة للاختيار التالي
    el("service_type").value = "";
    el("service_detail").innerHTML = '<option value="">— اختر الخدمة —</option>';
    el("price").value = "";
    el("points").value = "";
}

// ===========================
// عرض قائمة الخدمات المضافة في النموذج
// ===========================
function renderServicesList() {
    const box = el("servicesList");
    box.innerHTML = "";

    if (selectedServices.length === 0) {
        box.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:10px;">لا توجد خدمات مضافة</p>';
        return;
    }

    selectedServices.forEach((s, i) => {
        const div = document.createElement("div");
        div.className = "service-item";
        div.innerHTML = `
            <span>${s.name} (${s.price} ريال)</span>
            <button type="button" class="btn-remove" onclick="removeService(${i})">✕</button>
        `;
        box.appendChild(div);
    });
}

function removeService(index) {
    selectedServices.splice(index, 1);
    renderServicesList();
    recalcTotal();
}

// ===========================
// حساب الإجمالي والخصم لحظياً
// ===========================
function recalcTotal() {
    const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const discount = Number(el("discount").value || 0);
    const final = Math.max(0, total - discount);
    
    el("totalPrice").textContent = final;
}

// ===========================
// إرسال الزيارة كاملة إلى السيرفر
// ===========================
async function submitVisit() {
    const plate_numbers = el("plate_numbers").value.trim();
    const plate_letters = el("plate_letters").value.trim();
    const car_type = el("car_type").value;
    const car_model = el("car_model").value;
    const employee_in = el("employee_in").value;
    const branch = el("branch").value;
    const parking_slot = el("parking_slot").value;
    const payment_status = el("payment_status").value;

    // التحقق من الحقول الأساسية
    if (!plate_numbers || selectedServices.length === 0 || !employee_in || !parking_slot) {
        showToast("⚠️ يرجى إكمال جميع الحقول وإضافة خدمة واحدة على الأقل", "warning");
        return;
    }

    const discount = Number(el("discount").value || 0);
    const tip = Number(el("tip").value || 0);
    const totalBefore = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const totalAfter = Math.max(0, totalBefore - discount);

    let cash = 0, card = 0;
    const method = el("payment_method").value;

    if (payment_status === "مدفوع") {
        if (method === "كاش") cash = totalAfter;
        else if (method === "شبكة") card = totalAfter;
        else if (method === "جزئي") {
            cash = Number(el("cash_amount").value || 0);
            card = Number(el("card_amount").value || 0);
            if (Math.abs((cash + card) - totalAfter) > 0.1) {
                showToast(`⚠️ المجموع ${cash + card} لا يساوي الصافي ${totalAfter}`, "error");
                return;
            }
        }
    }

    const btn = el("btnSubmitVisit");
    btn.disabled = true;
    btn.textContent = "جاري التسجيل...";

    try {
        // تجهيز البيانات لإرسالها لدالة apiAddVisit الموجودة في api.js
        const res = await apiAddVisit({
            membership: plate_numbers,
            plate_numbers,
            plate_letters,
            car_type,
            car_model,
            car_size: el("car_size").value,
            employee_in,
            branch,
            parking_slot,
            payment_status,
            payment_method: method,
            discount,
            tip,
            cash_amount: cash,
            card_amount: card,
            // إرسال الخدمات كمصفوفة نصية JSON ليقوم السيرفر بتوزيعها كصفوف
            services: JSON.stringify(selectedServices.map(s => ({
                name: s.name,
                price: s.price,
                points: s.points,
                commission: s.points // التأكد من قراءة العمولات صح
            })))
        });

        if (res.success) {
            showToast("✅ تم تسجيل الزيارة بنجاح", "success");
            resetForm();
            loadActiveVisits(); // تحديث القائمة فوراً
        } else {
            showToast("❌ فشل التسجيل: " + res.error, "error");
        }
    } catch (err) {
        showToast("❌ خطأ غير متوقع أثناء التسجيل", "error");
    } finally {
        btn.disabled = false;
        btn.textContent = "تسجيل الزيارة";
    }
}
/* ===========================================
   رغوة الهجين - إدارة الزيارات (الدفعة 3)
   منطق تحديث الدفع، الخصم، والعمليات النهائية
=========================================== */

// ===========================
// معالجة تحديث الدفع للبطاقات
// ===========================
async function handlePaymentUpdate(plate, method) {
    // جلب كافة صفوف هذه السيارة من الزيارات النشطة
    const rows = activeVisits.filter(v => v.data[1] === plate);
    if (!rows.length) return;

    const totalBefore = rows.reduce((sum, v) => sum + Number(v.data[7] || 0), 0);
    const discount = Number(rows[0].data[24] || 0); // الخصم المسجل مسبقاً
    const finalTotal = totalBefore - discount;

    let cash = 0, card = 0;

    if (method === "كاش") {
        cash = finalTotal;
    } else if (method === "شبكة") {
        card = finalTotal;
    } else if (method === "جزئي") {
        // فتح نافذة الدفع الجزئي (المودال)
        openPaymentModal(plate, finalTotal);
        return; 
    }

    if (!confirm(`تأكيد دفع مبلغ ${finalTotal} ريال للوحة ${plate}؟`)) return;

    await processFinalClose(rows, method, cash, card, discount);
}

// ===========================
// العملية النهائية: توزيع المبالغ وإغلاق الصفوف
// ===========================
async function processFinalClose(rows, method, cash, card, totalDiscount) {
    try {
        showToast("جاري معالجة الدفع...", "info");
        
        // حساب الخصم لكل خدمة (توزيع نسبي لضمان دقة العمولات)
        const totalBefore = rows.reduce((sum, v) => sum + Number(v.data[7] || 0), 0);
        
        for (let i = 0; i < rows.length; i++) {
            const v = rows[i];
            const rowNum = v.row;
            const servicePrice = Number(v.data[7] || 0);
            
            // توزيع الخصم بالتناسب مع سعر الخدمة
            const rowDiscount = totalBefore > 0 ? (servicePrice / totalBefore) * totalDiscount : 0;
            const rowNet = servicePrice - rowDiscount;

            // تحديد نصيب هذا الصف من الكاش والشبكة (لو كان الدفع مختلط)
            let rowCash = 0, rowCard = 0;
            if (totalDiscount + rowNet > 0) {
                 rowCash = (rowNet / (totalBefore - totalDiscount)) * cash || 0;
                 rowCard = (rowNet / (totalBefore - totalDiscount)) * card || 0;
            }

            // استدعاء دالة apiCloseVisit من ملف api.js الخاص بك
            await apiCloseVisit({
                row: rowNum,
                payment_status: "مدفوع",
                payment_method: method,
                cash_amount: rowCash.toFixed(2),
                card_amount: rowCard.toFixed(2),
                discount: rowDiscount.toFixed(2)
            });
        }

        showToast("✅ تم الدفع وإغلاق الزيارة بنجاح", "success");
        loadActiveVisits(); // تحديث القائمة
    } catch (err) {
        console.error(err);
        showToast("❌ حدث خطأ أثناء إغلاق الزيارة", "error");
    }
}

// ===========================
// إدارة المودالات (الفتح والإغلاق)
// ===========================
function openPaymentModal(plate, amount) {
    selectedPlate = plate;
    el("modal_total_amount").textContent = amount;
    el("paymentModal").style.display = "block";
}

function closePaymentModal() {
    el("paymentModal").style.display = "none";
    el("cash_amount_input").value = "";
    el("card_amount_input").value = "";
}

// ===========================
// تهيئة الأحداث (Events) عند تشغيل الصفحة
// ===========================
window.onload = async function() {
    // 1. تحميل البيانات الأساسية
    await initSystemData(); 
    
    // 2. تحميل الزيارات النشطة
    await loadActiveVisits();

    // 3. ربط أزرار الواجهة
    el("btnRefreshActive").onclick = loadActiveVisits;
    el("btnAddService").onclick = addServiceToList;
    el("btnSubmitVisit").onclick = submitVisit;
    
    // مراقبة تغيير حالة الدفع في نموذج التسجيل الجديد
    el("payment_status").onchange = function() {
        el("payment_method_wrapper").style.display = (this.value === "مدفوع") ? "block" : "none";
    };

    el("payment_method").onchange = function() {
        el("partial_payment_box").style.display = (this.value === "جزئي") ? "block" : "none";
    };

    // مراقبة النقر على أزرار "تحديث الدفع" في الكروت
    document.addEventListener("click", function(e) {
        // قائمة تعديل (النقاط الثلاث)
        if (e.target.classList.contains("edit-btn")) {
            e.target.nextElementSibling.classList.toggle("show");
        }
        
        // خيارات الدفع (كاش/شبكة/جزئي)
        if (e.target.dataset.method) {
            const plate = e.target.parentElement.dataset.plate;
            const method = e.target.dataset.method;
            handlePaymentUpdate(plate, method);
        }
    });
};

// دالة تفريغ النموذج بعد النجاح
function resetForm() {
    el("plate_numbers").value = "";
    el("plate_letters").value = "";
    el("car_model").value = "";
    el("parking_slot").value = "";
    el("discount").value = "0";
    el("tip").value = "0";
    selectedServices = [];
    renderServicesList();
    recalcTotal();
}
