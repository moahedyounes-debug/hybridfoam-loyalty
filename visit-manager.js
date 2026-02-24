const el = id => document.getElementById(id);

let activeVisits = [];
let selectedServices = [];
let selectedPlate = null;

function showToast(msg, type = "info") {
  const container = el("toast-container");
  const div = document.createElement("div");
  div.className = "toast " + type;
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => div.classList.add("show"), 10);
  setTimeout(() => div.remove(), 3000);
}

let carTypesData = [];
let servicesData = [];
let employeesData = [];

async function loadCarTypes() {
  try {
    const res = await apiGetCarTypes();
    carTypesData = res.rows || [];

    const brandSelect = el("car_type");
    const modelSelect = el("car_model");

    brandSelect.innerHTML = '<option value="">— اختر البراند —</option>';
    modelSelect.innerHTML = '<option value="">— اختر الموديل —</option>';
    el("car_size").value = "";

    const brands = [...new Set(carTypesData.map(r => r[0]))];
    brands.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b;
      opt.textContent = b;
      brandSelect.appendChild(opt);
    });

    brandSelect.onchange = () => {
      const brand = brandSelect.value;
      modelSelect.innerHTML = '<option value="">— اختر الموديل —</option>';
      el("car_size").value = "";
      if (!brand) return;
      const models = carTypesData.filter(r => r[0] === brand);
      const uniqueModels = [...new Set(models.map(r => r[1]))];
      uniqueModels.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        modelSelect.appendChild(opt);
      });
    };

    modelSelect.onchange = () => {
      const brand = brandSelect.value;
      const model = modelSelect.value;
      const row = carTypesData.find(r => r[0] === brand && r[1] === model);
      el("car_size").value = row ? row[2] : "";
    };
  } catch (err) {
    console.error(err);
    showToast("خطأ في تحميل أنواع السيارات", "error");
  }
}

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

    typeSelect.onchange = () => {
      const cat = typeSelect.value;
      detailSelect.innerHTML = '<option value="">— اختر الخدمة —</option>';
      const filtered = servicesData.filter(s => (s.Category || s.category) === cat);
      filtered.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.service;
        opt.textContent = s.service;
        detailSelect.appendChild(opt);
      });
    };

    detailSelect.onchange = () => {
      const name = detailSelect.value;
      const row = servicesData.find(s => s.service === name);
      el("price").value = row ? row.price : 0;
      el("points").value = row ? row.commission : 0;
    };
  } catch (err) {
    console.error(err);
    showToast("خطأ في تحميل الخدمات", "error");
  }
}

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

async function loadBranches() {
  try {
    const res = await apiGetBranches();
    const rows = res.rows || [];
    const sel = el("branch");
    sel.innerHTML = '<option value="">— اختر الفرع —</option>';
    rows.forEach(r => {
      const name = r[0];
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
    showToast("خطأ في تحميل الفروع", "error");
  }
}

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

  selectedServices.push({ name: detail, price, points, category, commission: points });
  renderServicesList();
  recalcTotal();
}

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

function recalcTotal() {
  const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const discount = Number(el("discount").value || 0);
  el("totalPrice").textContent = Math.max(0, total - discount);
}

async function submitVisit() {
  const plate_numbers = el("plate_numbers").value.trim();
  const plate_letters = el("plate_letters").value.trim();
  const car_type = el("car_type").value;
  const car_model = el("car_model").value;
  const car_size = el("car_size").value;
  const employee_in = el("employee_in").value;
  const branch = el("branch").value;
  const parking_slot = el("parking_slot").value;
  const payment_status = el("payment_status").value;
  const payment_method = el("payment_method").value;
  const tip = Number(el("tip").value || 0);
  const discount = Number(el("discount").value || 0);

  if (!plate_numbers) return showToast("أدخل أرقام اللوحة", "error");
  if (!employee_in) return showToast("اختر الموظف", "error");
  if (!selectedServices.length) return showToast("أضف خدمة واحدة على الأقل", "error");
  if (!payment_status) return showToast("اختر حالة الدفع", "error");

  const hasWash = selectedServices.some(s => s.category === "غسيل");
  if (hasWash && !parking_slot) {
    return showToast("رقم الموقف مطلوب لخدمة الغسيل", "error");
  }

  const washCount = selectedServices.filter(s => s.category === "غسيل").length;
  if (washCount > 1) {
    return showToast("لا يمكن إضافة أكثر من خدمة غسيل", "error");
  }

  const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const finalTotal = Math.max(0, total - discount);

  let cash_amount = 0;
  let card_amount = 0;

  if (payment_status === "مدفوع") {
    if (!payment_method) return showToast("اختر طريقة الدفع", "error");

    if (payment_method === "جزئي") {
      cash_amount = Number(el("cash_amount").value || 0);
      card_amount = Number(el("card_amount").value || 0);
      if (cash_amount + card_amount !== finalTotal) {
        return showToast(`المبلغ المدفوع يجب أن يكون ${finalTotal} ريال`, "error");
      }
    } else if (payment_method === "كاش") {
      cash_amount = finalTotal;
    } else if (payment_method === "شبكة") {
      card_amount = finalTotal;
    }
  }

  const employee_out = employee_in;
  const membership = "";
  const rating = "";

  const servicesArray = selectedServices.map(s => ({
    name: s.name,
    price: s.price,
    points: s.points,
    commission: s.commission
  }));

  const payload = {
    membership,
    plate_numbers,
    plate_letters,
    car_type,
    car_model,
    car_size,
    employee_in,
    employee_out,
    branch,
    parking_slot,
    payment_status,
    payment_method,
    rating,
    services: servicesArray,
    cash_amount,
    card_amount,
    tip,
    discount
  };

  const btn = el("btnSubmitVisit");
  btn.disabled = true;
  btn.textContent = "جاري التسجيل...";

  try {
    await apiAddVisit(payload);
    showToast("تم تسجيل الزيارة", "success");

    selectedServices = [];
    renderServicesList();
    recalcTotal();

    el("plate_numbers").value = "";
    el("plate_letters").value = "";
    el("car_type").value = "";
    el("car_model").innerHTML = '<option value="">— اختر الموديل —</option>';
    el("car_size").value = "";
    el("service_type").value = "";
    el("service_detail").innerHTML = '<option value="">— اختر الخدمة —</option>';
    el("price").value = "";
    el("points").value = "";
    el("discount").value = "";
    el("tip").value = "";
    el("payment_status").value = "";
    el("payment_method").value = "";
    el("cash_amount").value = "";
    el("card_amount").value = "";
    el("payment_method_wrapper").style.display = "none";
    el("partial_payment_box").style.display = "none";

    await loadActiveVisits();
    await loadSummary();
  } catch (err) {
    console.error(err);
    showToast("خطأ في تسجيل الزيارة", "error");
  }

  btn.disabled = false;
  btn.textContent = "تسجيل الزيارة";
}

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
      const model = row[4] || "";
      const serviceName = row[6];
      const price = Number(row[7] || 0);
      const parking = row[17] || "";
      const employee = row[9] || "غير محدد";

      if (!cars[plate]) {
        cars[plate] = {
          plate,
          model,
          services: [],
          totalPrice: 0,
          parking,
          employee
        };
      }

      cars[plate].services.push({ name: serviceName, price });
      cars[plate].totalPrice += price;
    });

    Object.values(cars).forEach(car => {
      const servicesHTML = car.services
        .map(s => `<li>${s.name} — ${s.price} ريال</li>`)
        .join("");

      const card = document.createElement("div");
      card.className = "car-card";
      card.innerHTML = `
        <div class="car-card-header">
          <h4>لوحة: ${car.plate}</h4>
          <p>${car.model}</p>
        </div>
        <p><b>الموقف:</b> ${car.parking || "—"}</p>
        <p><b>الموظف:</b> ${car.employee}</p>
        <p><b>الخدمات:</b></p>
        <ul>${servicesHTML}</ul>
        <p><b>الإجمالي:</b> ${car.totalPrice} ريال</p>
        <div class="card-actions">

          <div class="dropdown">
            <button class="btn-secondary btn-small">تعديل ▼</button>
            <div class="dropdown-content">
              <a href="#" class="edit-services" data-plate="${car.plate}">تعديل الخدمات</a>
              <a href="#" class="edit-employee" data-plate="${car.plate}">تعديل الموظف</a>
              <a href="#" class="edit-parking" data-plate="${car.plate}">تعديل الموقف</a>
              <a href="#" class="edit-tip" data-plate="${car.plate}">إضافة إكرامية</a>
            </div>
          </div>

          <div class="dropdown">
            <button class="btn-secondary btn-small">تحديث الدفع ▼</button>
            <div class="dropdown-content">
              <a href="#" data-method="كاش" data-plate="${car.plate}">دفع كاش (${car.totalPrice} ريال)</a>
              <a href="#" data-method="شبكة" data-plate="${car.plate}">دفع شبكة (${car.totalPrice} ريال)</a>
              <a href="#" data-method="جزئي" data-plate="${car.plate}">دفع جزئي</a>
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

function openPaymentModal(method) {
  el("modal").style.display = "block";
  el("modal_method").textContent = method;

  const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);
  const totalRequired = visitRows.reduce(
    (sum, v) => sum + Number(v.data[7] || 0),
    0
  );

  el("modal_total").textContent = totalRequired + " ريال";
  el("modal_cash").value = "";
  el("modal_card").value = "";

  el("cash_box").style.display = (method === "كاش" || method === "جزئي") ? "block" : "none";
  el("card_box").style.display = (method === "شبكة" || method === "جزئي") ? "block" : "none";

  if (method === "كاش") el("modal_cash").value = totalRequired;
  if (method === "شبكة") el("modal_card").value = totalRequired;

  el("modal_confirm").onclick = () => submitPayment(method);
}

function closeModal() {
  el("modal").style.display = "none";
}

async function submitPayment(method) {
  const cash = Number(el("modal_cash").value || 0);
  const card = Number(el("modal_card").value || 0);

  const visitRows = activeVisits.filter(v => v.data[1] === selectedPlate);
  const totalRequired = visitRows.reduce(
    (sum, v) => sum + Number(v.data[7] || 0),
    0
  );

  if (cash + card !== totalRequired) {
    showToast(`المبلغ المدفوع يجب أن يكون ${totalRequired} ريال`, "error");
    return;
  }

  let pm = "";
  if (method === "جزئي") pm = "جزئي";
  else if (method === "كاش") pm = "كاش";
  else if (method === "شبكة") pm = "شبكة";

  try {
    for (const v of visitRows) {
      const servicePrice = Number(v.data[7] || 0);
      const ratio = servicePrice / totalRequired;
      const cashForThis = cash * ratio;
      const cardForThis = card * ratio;

      await apiCloseVisit(v.row, {
        payment_status: "مدفوع",
        payment_method: pm,
        cash_amount: cashForThis,
        card_amount: cardForThis
      });
    }

    showToast("تم تحديث الدفع", "success");
    closeModal();
    await loadActiveVisits();
    await loadSummary();
  } catch (err) {
    console.error(err);
    showToast("خطأ في تحديث الدفع", "error");
  }
}

async function loadSummary() {
  try {
    const activeRes = await apiGetActiveVisits();
    const activeRows = activeRes.visits || [];
    const insideCount = activeRows.length;

    const allRes = await apiGetAll("Visits");
    const rows = allRes.rows || [];
    const todayStr = new Date().toDateString();

    const todayPaid = rows.filter(r => {
      const status = r[15] || "";
      const checkIn = r[13] || "";
      if (status !== "مدفوع" || !checkIn) return false;
      const d = new Date(checkIn);
      return d.toDateString() === todayStr;
    });

    const sectionTitle = document.querySelector(".section .section-title");
    if (sectionTitle) {
      sectionTitle.textContent = `🚗 سيارات داخل المغسلة (غير مدفوعة) — ${insideCount}`;
    }

    const summaryBar = el("summaryBar");
    if (summaryBar) {
      summaryBar.textContent =
        `اليوم اكتملت ${todayPaid.length} سيارة — داخل المغسلة الآن ${insideCount} سيارة غير مدفوعة`;
    }
  } catch (err) {
    console.error(err);
  }
}

/* ====== تعديل من الكرت (C) ====== */

function openEditServices(plate) {
  const visitRows = activeVisits.filter(v => v.data[1] === plate);

  if (!visitRows.length) {
    showToast("لا توجد خدمات لهذه السيارة", "error");
    return;
  }

  let html = "";
  visitRows.forEach((v, i) => {
    html += `
      <div class="service-edit-item">
        <label>الخدمة ${i + 1}</label>
        <input type="text" id="edit_name_${i}" value="${v.data[6]}">
        <input type="number" id="edit_price_${i}" value="${v.data[7]}">
        <button class="btn-remove-service" data-row="${v.row}">حذف</button>
      </div>
    `;
  });

  el("modal_edit_title").textContent = "تعديل الخدمات";
  el("modal_edit").innerHTML = html;
  el("modal_edit_container").style.display = "block";

  el("modal_edit_save").onclick = () => saveEditServices(plate, visitRows);
}

async function saveEditServices(plate, visitRows) {
  try {
    for (let i = 0; i < visitRows.length; i++) {
      const row = visitRows[i].row;
      const name = el(`edit_name_${i}`).value;
      const price = Number(el(`edit_price_${i}`).value);

      await apiCloseVisit(row, {
        service_detail: name,
        price: price
      });
    }

    showToast("تم حفظ التعديلات", "success");
    el("modal_edit_container").style.display = "none";
    await loadActiveVisits();
  } catch (err) {
    console.error(err);
    showToast("خطأ في تعديل الخدمات", "error");
  }
}

function openEditEmployee(plate) {
  const visit = activeVisits.find(v => v.data[1] === plate).data;

  const html = `
    <label>اختر الموظف</label>
    <select id="edit_employee_select">
      ${employeesData.map(e => `
        <option value="${e[0]}" ${e[0] === visit[9] ? "selected" : ""}>${e[0]}</option>
      `).join("")}
    </select>
  `;

  el("modal_edit_title").textContent = "تعديل الموظف";
  el("modal_edit").innerHTML = html;
  el("modal_edit_container").style.display = "block";

  el("modal_edit_save").onclick = () => saveEditEmployee(plate);
}

async function saveEditEmployee(plate) {
  const newEmp = el("edit_employee_select").value;
  const visitRows = activeVisits.filter(v => v.data[1] === plate);

  try {
    for (const v of visitRows) {
      await apiCloseVisit(v.row, {
        employee_in: newEmp,
        employee_out: newEmp
      });
    }

    showToast("تم تعديل الموظف", "success");
    el("modal_edit_container").style.display = "none";
    await loadActiveVisits();
  } catch (err) {
    console.error(err);
    showToast("خطأ في تعديل الموظف", "error");
  }
}

function openEditParking(plate) {
  const visit = activeVisits.find(v => v.data[1] === plate).data;

  const html = `
    <label>رقم الموقف</label>
    <input type="number" id="edit_parking_input" value="${visit[17]}">
  `;

  el("modal_edit_title").textContent = "تعديل رقم الموقف";
  el("modal_edit").innerHTML = html;
  el("modal_edit_container").style.display = "block";

  el("modal_edit_save").onclick = () => saveEditParking(plate);
}

async function saveEditParking(plate) {
  const newParking = el("edit_parking_input").value;
  const visitRows = activeVisits.filter(v => v.data[1] === plate);

  try {
    for (const v of visitRows) {
      await apiCloseVisit(v.row, {
        parking_slot: newParking
      });
    }

    showToast("تم تعديل رقم الموقف", "success");
    el("modal_edit_container").style.display = "none";
    await loadActiveVisits();
  } catch (err) {
    console.error(err);
    showToast("خطأ في تعديل رقم الموقف", "error");
  }
}

function openEditTip(plate) {
  const visitRows = activeVisits.filter(v => v.data[1] === plate);
  const last = visitRows[visitRows.length - 1].data;

  const html = `
    <label>الإكرامية</label>
    <input type="number" id="edit_tip_input" value="${last[23] || 0}">
  `;

  el("modal_edit_title").textContent = "إضافة إكرامية";
  el("modal_edit").innerHTML = html;
  el("modal_edit_container").style.display = "block";

  el("modal_edit_save").onclick = () => saveEditTip(plate);
}

async function saveEditTip(plate) {
  const newTip = Number(el("edit_tip_input").value);
  const visitRows = activeVisits.filter(v => v.data[1] === plate);
  const last = visitRows[visitRows.length - 1];

  try {
    await apiCloseVisit(last.row, {
      tip: newTip
    });

    showToast("تم تعديل الإكرامية", "success");
    el("modal_edit_container").style.display = "none";
    await loadActiveVisits();
  } catch (err) {
    console.error(err);
    showToast("خطأ في تعديل الإكرامية", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadCarTypes();
  loadServices();
  loadEmployees();
  loadBranches();
  loadActiveVisits();
  loadSummary();

  el("btnRefreshActive").addEventListener("click", () => {
    loadActiveVisits();
    loadSummary();
  });

  el("btnAddService").addEventListener("click", addServiceToList);
  el("discount").addEventListener("input", recalcTotal);
  el("btnSubmitVisit").addEventListener("click", submitVisit);

  el("modal_close").addEventListener("click", closeModal);

  el("payment_status").addEventListener("change", () => {
    const val = el("payment_status").value;
    if (val === "مدفوع") {
      el("payment_method_wrapper").style.display = "block";
    } else {
      el("payment_method_wrapper").style.display = "none";
      el("partial_payment_box").style.display = "none";
      el("cash_amount").value = "";
      el("card_amount").value = "";
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

  document.addEventListener("click", e => {
    if (e.target.matches(".dropdown-content a[data-method]")) {
      e.preventDefault();
      selectedPlate = e.target.getAttribute("data-plate");
      const method = e.target.getAttribute("data-method");
      openPaymentModal(method);
    }

    if (e.target.matches(".edit-services")) {
      e.preventDefault();
      openEditServices(e.target.dataset.plate);
    }

    if (e.target.matches(".edit-employee")) {
      e.preventDefault();
      openEditEmployee(e.target.dataset.plate);
    }

    if (e.target.matches(".edit-parking")) {
      e.preventDefault();
      openEditParking(e.target.dataset.plate);
    }

    if (e.target.matches(".edit-tip")) {
      e.preventDefault();
      openEditTip(e.target.dataset.plate);
    }
  });

  el("modal_edit_close") && (el("modal_edit_close").onclick = () => {
    el("modal_edit_container").style.display = "none";
  });
});
