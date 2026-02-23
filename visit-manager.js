/* ===========================
أدوات مساعدة
=========================== */
const el = id => document.getElementById(id);

let activeVisits = [];
let selectedPlate = null;
let selectedServices = [];
let carTypesData = [];
let servicesData = [];
let employeesData = [];
let currentMembership = "";

/* ===========================
Toast
=========================== */
function showToast(msg, type = "info") {
  const container = el("toast-container");
  const div = document.createElement("div");
  div.className = "toast " + type;
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => div.classList.add("show"), 10);
  setTimeout(() => div.remove(), 3000);
}

/* ===========================
إغلاق المودالات
=========================== */
function closeModal() {
  el("modal").style.display = "none";
  el("cash_box").style.display = "none";
  el("card_box").style.display = "none";
  el("modal_cash").value = "";
  el("modal_card").value = "";
  el("modal_discount").value = "";
  el("modal_tip").value = "";
}

function closeEditModal() {
  el("modal_edit_container").style.display = "none";
  el("modal_edit").innerHTML = "";
}

/* ===========================
تحميل الزيارات النشطة
=========================== */
async function loadActiveVisits() {
  const list = el("activeVisitsList");
  list.innerHTML = "جارِ التحميل...";

  try {
    const res = await apiGetActiveVisits();
    const rows = res.visits || [];
    activeVisits = rows;
    list.innerHTML = "";

    if (!rows.length) {
      list.innerHTML = "<p>لا توجد زيارات حالياً.</p>";
      return;
    }

    const cars = {};

    rows.forEach(r => {
      const row = r.data;
      const plate = row[1];
      const serviceName = row[6];
      const price = Number(row[7] || 0);
      const checkIn = row[13];
      const parking = row[17];
      const employee = row[9] || "غير محدد";
      const tip = Number(row[24] || 0);
      const discount = Number(row[25] || 0);

      if (!cars[plate]) {
        cars[plate] = {
          plate,
          services: [],
          totalPrice: 0,
          checkIn,
          parking,
          employee,
          tip,
          discount
        };
      }

      cars[plate].services.push({ name: serviceName, price, rowIndex: r.row });
      cars[plate].totalPrice += price;
    });

    Object.values(cars).forEach(car => {
      const servicesHTML = car.services
        .map(s => `<li>${s.name} — ${s.price} ريال</li>`)
        .join("");

      const card = document.createElement("div");
      card.className = "car-card";
      card.innerHTML = `
        <h4>لوحة: ${car.plate}</h4>
        <p><b>الدخول:</b> ${car.checkIn}</p>
        <p><b>رقم الموقف:</b> ${car.parking}</p>
        <p><b>الموظف:</b> ${car.employee}</p>
        <p><b>الخصم:</b> ${car.discount || 0} ريال</p>
        <p><b>الإكرامية:</b> ${car.tip || 0} ريال</p>

        <button class="btn-secondary" data-edit="${car.plate}">تعديل / حذف</button>

        <p><b>الخدمات:</b></p>
        <ul>${servicesHTML}</ul>

        <p><b>الإجمالي قبل الخصم:</b> ${car.totalPrice} ريال</p>

        <div class="dropdown">
          <button class="btn-pay">تحديث الدفع ▼</button>
          <div class="dropdown-content">
            <a href="#" data-method="كاش" data-plate="${car.plate}">دفع كاش</a>
            <a href="#" data-method="شبكة" data-plate="${car.plate}">دفع شبكة</a>
            <a href="#" data-method="جزئي" data-plate="${car.plate}">دفع جزئي (كاش + شبكة)</a>
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

/* ===========================
Event Delegation
=========================== */
document.addEventListener("click", function (e) {
  if (e.target.matches(".dropdown-content a")) {
    e.preventDefault();
    const method = e.target.getAttribute("data-method");
    selectedPlate = e.target.getAttribute("data-plate");
    openPaymentModal(method);
  }

  if (e.target.matches("[data-edit]")) {
    const plate = e.target.getAttribute("data-edit");
    openEditVisitModal(plate);
  }
});

/* ===========================
مودال الدفع
=========================== */
function openPaymentModal(method) {
  el("modal").style.display = "block";
  el("modal_method").textContent = method;
  el("modal_cash").value = "";
  el("modal_card").value = "";
  el("modal_discount").value = "";
  el("modal_tip").value = "";

  const visitRows = activeVisits.filter(v => {
    const plateCell = String(v.data[1] || "");
    return plateCell.startsWith(String(selectedPlate));
  });

  const totalRequired = visitRows.reduce(
    (sum, v) => sum + Number(v.data[7] || 0),
    0
  );

  el("modal_total").textContent = totalRequired + " ريال";

  el("cash_box").style.display = "none";
  el("card_box").style.display = "none";

  if (method === "كاش") {
    el("cash_box").style.display = "block";
    el("modal_cash").value = totalRequired;
  } else if (method === "شبكة") {
    el("card_box").style.display = "block";
    el("modal_card").value = totalRequired;
  } else if (method === "جزئي") {
    el("cash_box").style.display = "block";
    el("card_box").style.display = "block";
  }

  el("modal_confirm").onclick = () => submitPayment(method);
}

/* ===========================
تحديث الدفع + الخصم + الإكرامية
=========================== */
async function submitPayment(method) {
  const cash = Number(el("modal_cash").value || 0);
  const card = Number(el("modal_card").value || 0);
  const discount = Number(el("modal_discount").value || 0);
  const tip = Number(el("modal_tip").value || 0);

  const confirmBtn = el("modal_confirm");
  confirmBtn.disabled = true;
  confirmBtn.textContent = "جاري التحديث...";

  try {
    const visitRows = activeVisits.filter(v => {
      const plateCell = String(v.data[1] || "");
      return plateCell.startsWith(String(selectedPlate));
    });

    const totalServices = visitRows.reduce(
      (sum, v) => sum + Number(v.data[7] || 0),
      0
    );

    const netAfterDiscount = Math.max(0, totalServices - discount);
    const totalRequired = netAfterDiscount + tip;

    const totalPaid = cash + card;

    if (totalPaid !== totalRequired) {
      showToast(`المبلغ المدفوع يجب أن يكون ${totalRequired} ريال`, "error");
      confirmBtn.disabled = false;
      confirmBtn.textContent = "تأكيد";
      return;
    }

    const paymentMethodLabel = method === "جزئي" ? "كاش + شبكة" : method;

    for (const v of visitRows) {
      const servicePrice = Number(v.data[7] || 0);
      const ratio = totalServices ? servicePrice / totalServices : 0;

      const cashForThis = cash * ratio;
      const cardForThis = card * ratio;

      await apiCloseVisit(v.row, {
        payment_status: "مدفوع",
        payment_method: paymentMethodLabel,
        CASH_AMOUNT: cashForThis,
        CARD_AMOUNT: cardForThis,
        TOTAL_PAID: servicePrice,
        discount: discount,
        tip: tip
      });
    }

    showToast("تم تحديث الدفع", "success");
    closeModal();
    setTimeout(loadActiveVisits, 20);
  } catch (err) {
    console.error(err);
    showToast("خطأ في تحديث الدفع", "error");
  }

  confirmBtn.disabled = false;
  confirmBtn.textContent = "تأكيد";
}

/* ===========================
مودال تعديل الزيارة (خدمات + موظف + خصم + إكرامية + حذف)
=========================== */
function openEditVisitModal(plate) {
  const visitRows = activeVisits.filter(v => {
    const plateCell = String(v.data[1] || "");
    return plateCell.startsWith(String(plate));
  });

  if (!visitRows.length) {
    showToast("لا توجد زيارات لهذه السيارة", "error");
    return;
  }

  const first = visitRows[0].data;
  const currentDiscount = Number(first[25] || 0);
  const currentTip = Number(first[24] || 0);
  const currentEmp = first[9] || "";

  let html = `
    <h3>تعديل الزيارة</h3>

    <label>الموظف</label>
    <select id="edit_employee">
      <option value="">— اختر الموظف —</option>
      ${employeesData
        .map(e => `<option value="${e[0]}" ${e[0] === currentEmp ? "selected" : ""}>${e[0]}</option>`)
        .join("")}
    </select>

    <div class="row" style="margin-top:10px;">
      <div>
        <label>الخصم</label>
        <input type="number" id="edit_discount" value="${currentDiscount}">
      </div>
      <div>
        <label>الإكرامية</label>
        <input type="number" id="edit_tip" value="${currentTip}">
      </div>
    </div>

    <hr style="margin:15px 0;">

    <h4>الخدمات</h4>
    <div id="serviceEditList">
  `;

  visitRows.forEach((v, i) => {
    const serviceName = v.data[6];
    const price = Number(v.data[7] || 0);

    html += `
      <div class="service-edit-item" data-row="${v.row}" style="border-bottom:1px dashed #e5e7eb;padding-bottom:8px;margin-bottom:8px;">
        <label>الخدمة ${i + 1}</label>
        <select class="edit_service_name" data-row="${v.row}">
          ${servicesData
            .map(s => `<option value="${s.service}" ${s.service === serviceName ? "selected" : ""}>${s.service}</option>`)
            .join("")}
        </select>
        <input type="number" class="edit_service_price" data-row="${v.row}" value="${price}">
        <button type="button" class="btn-secondary" style="background:#dc2626;margin-top:6px;" data-delete-row="${v.row}">حذف الخدمة</button>
      </div>
    `;
  });

  html += `
    </div>

    <button id="saveEditVisit" class="btn-primary" style="margin-top:10px;">حفظ التعديلات</button>
  `;

  el("modal_edit").innerHTML = html;
  el("modal_edit_container").style.display = "flex";

  // حذف خدمة
  el("serviceEditList").querySelectorAll("[data-delete-row]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const rowId = btn.getAttribute("data-delete-row");
      try {
        await apiDeleteRow("Visits", rowId);
        btn.closest(".service-edit-item").remove();
        showToast("تم حذف الخدمة", "success");
        setTimeout(loadActiveVisits, 20);
      } catch (err) {
        console.error(err);
        showToast("خطأ في حذف الخدمة", "error");
      }
    });
  });

  // تغيير الخدمة → تحديث السعر تلقائي
  el("serviceEditList").querySelectorAll(".edit_service_name").forEach(sel => {
    sel.addEventListener("change", () => {
      const rowId = sel.getAttribute("data-row");
      const priceInput = el("serviceEditList").querySelector(`.edit_service_price[data-row="${rowId}"]`);
      const serviceName = sel.value;
      const row = servicesData.find(s => s.service === serviceName);
      priceInput.value = row ? row.price : 0;
    });
  });

  // حفظ التعديلات
  el("saveEditVisit").onclick = async () => {
    const newEmp = el("edit_employee").value;
    const newDiscount = Number(el("edit_discount").value || 0);
    const newTip = Number(el("edit_tip").value || 0);

    try {
      const items = el("serviceEditList").querySelectorAll(".service-edit-item");

      for (const item of items) {
        const rowId = item.getAttribute("data-row");
        const sel = item.querySelector(".edit_service_name");
        const priceInput = item.querySelector(".edit_service_price");

        const serviceName = sel.value;
        const price = Number(priceInput.value || 0);
        const serviceRow = servicesData.find(s => s.service === serviceName);
        const commission = serviceRow ? serviceRow.commission : 0;

        await apiUpdateRow("Visits", rowId, {
          service_detail: serviceName,
          price: price,
          commission: commission,
          employee_in: newEmp || "",
          discount: newDiscount,
          tip: newTip
        });
      }

      showToast("تم حفظ التعديلات", "success");
      closeEditModal();
      setTimeout(loadActiveVisits, 20);
    } catch (err) {
      console.error(err);
      showToast("خطأ في حفظ التعديلات", "error");
    }
  };
}

/* ===========================
تحميل أنواع السيارات
=========================== */
async function loadCarTypes() {
  try {
    const res = await apiGetCarTypes();
    carTypesData = res.rows || [];

    const brandSelect = el("car_type");
    const modelSelect = el("car_model");
    const sizeInput = el("car_size");

    brandSelect.innerHTML = '<option value="">— اختر البراند —</option>';
    modelSelect.innerHTML = '<option value="">— اختر الموديل —</option>';
    sizeInput.value = "";

    const brands = [...new Set(carTypesData.map(r => r[0]))];

    brands.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b;
      opt.textContent = b;
      brandSelect.appendChild(opt);
    });

    brandSelect.addEventListener("change", () => {
      const brand = brandSelect.value;
      modelSelect.innerHTML = '<option value="">— اختر الموديل —</option>';
      sizeInput.value = "";
      if (!brand) return;

      const models = carTypesData.filter(r => r[0] === brand);
      const uniqueModels = [...new Set(models.map(r => r[1]))];

      uniqueModels.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        modelSelect.appendChild(opt);
      });
    });

    modelSelect.addEventListener("change", () => {
      const brand = brandSelect.value;
      const model = modelSelect.value;
      const row = carTypesData.find(r => r[0] === brand && r[1] === model);
      sizeInput.value = row ? row[2] : "";
    });
  } catch (err) {
    console.error(err);
    showToast("خطأ في تحميل أنواع السيارات", "error");
  }
}

/* ===========================
تحميل الخدمات
=========================== */
async function loadServices() {
  try {
    const res = await apiGetServices();
    servicesData = res.services || [];

    const typeSelect = el("service_type");
    const detailSelect = el("service_detail");

    typeSelect.innerHTML = '<option value="">— اختر نوع الخدمة —</option>';
    detailSelect.innerHTML = '<option value="">— اختر الخدمة —</option>';

    const categories = [...new Set(servicesData.map(s => s.Category || s.category))];

    categories.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      typeSelect.appendChild(opt);
    });

    typeSelect.addEventListener("change", () => {
      const cat = typeSelect.value;
      detailSelect.innerHTML = '<option value="">— اختر الخدمة —</option>';
      const filtered = servicesData.filter(s => (s.Category || s.category) === cat);
      filtered.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.service;
        opt.textContent = s.service;
        detailSelect.appendChild(opt);
      });
    });

    detailSelect.addEventListener("change", () => {
      const name = detailSelect.value;
      const row = servicesData.find(s => s.service === name);
      el("price").value = row ? row.price : 0;
      el("points").value = row ? row.commission : 0;
    });
  } catch (err) {
    console.error(err);
    showToast("خطأ في تحميل الخدمات", "error");
  }
}

/* ===========================
تحميل الموظفين
=========================== */
async function loadEmployees() {
  try {
    const res = await apiGetEmployees();
    employeesData = res.rows || [];

    const sel = el("employee_in");
    sel.innerHTML = '<option value="">— اختر الموظف —</option>';

    employeesData.forEach(e => {
      const opt = document.createElement("option");
      opt.value = e[0];
      opt.textContent = e[0];
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
    showToast("خطأ في تحميل الموظفين", "error");
  }
}

/* ===========================
إضافة خدمة
=========================== */
function addServiceToList() {
  const detail = el("service_detail").value;
  const price = Number(el("price").value || 0);
  const points = Number(el("points").value || 0);
  const category = el("service_type").value;

  if (!detail) {
    showToast("اختر خدمة", "error");
    return;
  }

  if (category === "غسيل") {
    const already = selectedServices.some(s => s.category === "غسيل");
    if (already) {
      showToast("لا يمكن إضافة أكثر من خدمة غسيل لنفس الزيارة", "error");
      return;
    }
  }

  selectedServices.push({
    name: detail,
    price,
    points,
    commission: points,
    category
  });

  renderServicesList();
  recalcTotal();
}

/* ===========================
عرض قائمة الخدمات
=========================== */
function renderServicesList() {
  const box = el("servicesList");
  box.innerHTML = "";

  if (!selectedServices.length) {
    box.textContent = "لا توجد خدمات مضافة بعد.";
    return;
  }

  selectedServices.forEach((s, i) => {
    const div = document.createElement("div");
    div.className = "service-item";
    div.innerHTML = `
      <span>${s.name} - ${s.price} ريال</span>
      <button class="btn-remove" data-i="${i}">حذف</button>
    `;
    box.appendChild(div);
  });

  box.querySelectorAll(".btn-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-i"));
      selectedServices.splice(i, 1);
      renderServicesList();
      recalcTotal();
    });
  });
}

/* ===========================
حساب الإجمالي
=========================== */
function recalcTotal() {
  const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const discount = Number(el("discount").value || 0);
  el("totalPrice").textContent = Math.max(0, total - discount);
}

/* ===========================
تنظيف النموذج
=========================== */
function resetForm() {
  selectedServices = [];
  el("servicesList").innerHTML = "";
  el("plate_numbers").value = "";
  el("plate_letters").value = "";
  el("car_type").value = "";
  el("car_model").value = "";
  el("car_size").value = "";
  el("employee_in").value = "";
  el("discount").value = "";
  el("tip").value = "";
  el("totalPrice").textContent = "0";
  el("payment_status").value = "";
  el("payment_method").value = "";
  el("cash_amount").value = "";
  el("card_amount").value = "";
  el("parking_slot").value = "";
  el("payment_method_wrapper").style.display = "none";
  el("partial_payment_box").style.display = "none";
}

/* ===========================
إرسال الزيارة
=========================== */
async function submitVisit() {
  const btn = el("btnSubmitVisit");
  btn.classList.add("btn-loading");
  btn.textContent = "جاري تسجيل الزيارة...";
  btn.disabled = true;

  const plate_numbers = el("plate_numbers").value.trim();
  const plate_letters = el("plate_letters").value.trim();
  const car_type = el("car_type").value;
  const car_model = el("car_model").value;
  const car_size = el("car_size").value;
  const employee_in = el("employee_in").value;
  const branch = el("branch").value;
  const parking_slot = el("parking_slot").value;
  const payment_status = el("payment_status").value.trim();
  const payment_method = el("payment_method").value.trim();
  const discount = Number(el("discount").value || 0);
  const tip = Number(el("tip").value || 0);

  if (!plate_numbers) {
    showToast("أدخل أرقام اللوحة", "error");
    resetSubmitButton(btn);
    return;
  }

  if (!car_type || !car_model) {
    showToast("اختر براند السيارة وموديلها", "error");
    resetSubmitButton(btn);
    return;
  }

  if (!employee_in) {
    showToast("اختر الموظف", "error");
    resetSubmitButton(btn);
    return;
  }

  if (!parking_slot) {
    showToast("اختر رقم الموقف", "error");
    resetSubmitButton(btn);
    return;
  }

  if (!payment_status) {
    showToast("اختر حالة الدفع", "error");
    resetSubmitButton(btn);
    return;
  }

  if (!selectedServices.length) {
    showToast("أضف خدمة واحدة على الأقل", "error");
    resetSubmitButton(btn);
    return;
  }

  const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const netAfterDiscount = Math.max(0, total - discount);
  const finalTotal = netAfterDiscount + tip;

  let cash_amount = 0;
  let card_amount = 0;

  if (payment_status === "مدفوع") {
    if (!payment_method) {
      showToast("اختر طريقة الدفع", "error");
      resetSubmitButton(btn);
      return;
    }

    if (payment_method === "جزئي") {
      cash_amount = Number(el("cash_amount").value || 0);
      card_amount = Number(el("card_amount").value || 0);
      if (cash_amount + card_amount !== finalTotal) {
        showToast(`المبلغ المدفوع يجب أن يكون ${finalTotal} ريال`, "error");
        resetSubmitButton(btn);
        return;
      }
    } else if (payment_method === "كاش") {
      cash_amount = finalTotal;
    } else if (payment_method === "شبكة") {
      card_amount = finalTotal;
    }
  }

  const rowsToAdd = selectedServices.map(s => ([
    currentMembership,          // 0 membership
    plate_numbers,              // 1 plate_numbers
    plate_letters,              // 2 plate_letters
    car_type,                   // 3 car_type
    car_model,                  // 4 car_model
    car_size,                   // 5 car_size
    s.name,                     // 6 service_detail
    s.price,                    // 7 price
    s.points,                   // 8 points
    employee_in,                // 9 employee_in
    "",                         // 10 employee_out
    branch,                     // 11 branch
    s.commission,               // 12 commission
    new Date().toISOString(),   // 13 check_in
    "",                         // 14 check_out
    payment_status,             // 15 payment_status
    payment_status === "مدفوع" ? payment_method : "", // 16 payment_method
    parking_slot,               // 17 parking_slot
    "",                         // 18 rating
    payment_status === "مدفوع" ? payment_method : "", // 19 payment_method_copy
    payment_status === "مدفوع" ? cash_amount : 0,     // 20 CASH_AMOUNT
    payment_status === "مدفوع" ? card_amount : 0,     // 21 CARD_AMOUNT
    payment_status === "مدفوع" ? s.price : 0,         // 22 TOTAL_PAID
    tip,                        // 23 tip
    discount                    // 24 discount
  ]));

  try {
    for (const row of rowsToAdd) {
      await apiAddVisit(row);
    }
    showToast("تم تسجيل الزيارة", "success");
    resetForm();
    setTimeout(loadActiveVisits, 20);
  } catch (err) {
    console.error(err);
    showToast("خطأ في تسجيل الزيارة", "error");
  } finally {
    resetSubmitButton(btn);
  }
}

function resetSubmitButton(btn) {
  btn.classList.remove("btn-loading");
  btn.textContent = "تسجيل الزيارة";
  btn.disabled = false;
}

/* ===========================
INIT
=========================== */
document.addEventListener("DOMContentLoaded", () => {
  loadActiveVisits();
  loadCarTypes();
  loadServices();
  loadEmployees();

  el("btnRefreshActive").addEventListener("click", loadActiveVisits);
  el("btnAddService").addEventListener("click", addServiceToList);
  el("discount").addEventListener("input", recalcTotal);
  el("btnSubmitVisit").addEventListener("click", submitVisit);

  el("modal_close").addEventListener("click", closeModal);
  el("modal_cancel").addEventListener("click", closeModal);

  el("modal_edit_close").addEventListener("click", closeEditModal);

  el("payment_status").addEventListener("change", () => {
    const val = el("payment_status").value;
    if (val === "مدفوع") {
      el("payment_method_wrapper").style.display = "block";
    } else {
      el("payment_method_wrapper").style.display = "none";
      el("partial_payment_box").style.display = "none";
    }
  });

  el("payment_method").addEventListener("change", () => {
    const val = el("payment_method").value;
    if (val === "جزئي") {
      el("partial_payment_box").style.display = "block";
    } else {
      el("partial_payment_box").style.display = "none";
    }
  });
});
