/* ===========================
   Helpers
=========================== */

const el = id => document.getElementById(id);

let activeVisits = [];
let selectedServices = [];
let selectedPlate = null;

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
   Date format (MM/DD/YYYY HH:MM)
=========================== */

function formatNow() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
}

/* ===========================
   Load car types
=========================== */

let carTypesData = [];

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

/* ===========================
   Load services
=========================== */

let servicesData = [];

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

/* ===========================
   Load employees
=========================== */

let employeesData = [];

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
   Load branches
=========================== */

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

/* ===========================
   Add service to visit
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

  selectedServices.push({ name: detail, price, points, category });
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

/* ===========================
   Submit visit
=========================== */

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

  if (!plate_numbers) {
    showToast("أدخل أرقام اللوحة", "error");
    return;
  }
  if (!employee_in) {
    showToast("اختر الموظف", "error");
    return;
  }
  if (!selectedServices.length) {
    showToast("أضف خدمة واحدة على الأقل", "error");
    return;
  }

  const total = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const finalTotal = Math.max(0, total - discount);

  let cash_amount = 0;
  let card_amount = 0;
  let pm = "";
  let pm_copy = "";

  if (payment_status === "مدفوع") {
    if (!payment_method) {
      showToast("اختر طريقة الدفع", "error");
      return;
    }
    if (payment_method === "جزئي") {
      cash_amount = Number(el("cash_amount").value || 0);
      card_amount = Number(el("card_amount").value || 0);
      if (cash_amount + card_amount !== finalTotal) {
        showToast(`المبلغ المدفوع يجب أن يكون ${finalTotal} ريال`, "error");
        return;
      }
      pm = "جزئي";
      pm_copy = "كاش + شبكة";
    } else if (payment_method === "كاش") {
      cash_amount = finalTotal;
      pm = "كاش";
      pm_copy = "كاش";
    } else if (payment_method === "شبكة") {
      card_amount = finalTotal;
      pm = "شبكة";
      pm_copy = "شبكة";
    }
  } else {
    // غير مدفوع
    pm = "";
    pm_copy = "";
    cash_amount = 0;
    card_amount = 0;
  }

  const check_in = formatNow();
  const membership = ""; // تربط لاحقاً
  const employee_out = employee_in; // حالياً نفس الموظف

  try {
    for (const s of selectedServices) {
      await apiAddVisit({
        membership,
        plate_numbers,
        plate_letters,
        car_type,
        car_model,
        car_size,
        service_detail: s.name,
        price: s.price,
        points: s.points,
        employee_in,
        employee_out,
        branch,
        commission: s.points,
        check_in,
        check_out: "",
        payment_status,
        payment_method: pm,
        parking_slot,
        rating: "",
        payment_method_copy: pm_copy,
        CASH_AMOUNT: cash_amount,
        CARD_AMOUNT: card_amount,
        TOTAL_PAID: payment_status === "مدفوع" ? s.price : 0,
        tip,
        discount
      });
    }

    showToast("تم تسجيل الزيارة", "success");
    selectedServices = [];
    renderServicesList();
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
    recalcTotal();
    await loadActiveVisits();
    await loadSummary();
  } catch (err) {
    console.error(err);
    showToast("خطأ في تسجيل الزيارة", "error");
  }
}

/* ===========================
   Load active (unpaid) visits
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

/* ===========================
   Payment modal
=========================== */

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

/* ===========================
   Submit payment (update visit)
=========================== */

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

  const check_out = formatNow();
  let pm = "";
  let pm_copy = "";

  if (method === "جزئي") {
    pm = "جزئي";
    pm_copy = "كاش + شبكة";
  } else if (method === "كاش") {
    pm = "كاش";
    pm_copy = "كاش";
  } else if (method === "شبكة") {
    pm = "شبكة";
    pm_copy = "شبكة";
  }

  try {
    for (const v of visitRows) {
      const servicePrice = Number(v.data[7] || 0);
      const ratio = servicePrice / totalRequired;
      const cashForThis = cash * ratio;
      const cardForThis = card * ratio;

      await apiCloseVisit(v.row, {
        payment_status: "مدفوع",
        payment_method: pm,
        payment_method_copy: pm_copy,
        CASH_AMOUNT: cashForThis,
        CARD_AMOUNT: cardForThis,
        TOTAL_PAID: servicePrice,
        check_out
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

/* ===========================
   Summary (today completed + inside)
=========================== */

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

    let summaryBar = document.getElementById("summaryBar");
    if (!summaryBar) {
      summaryBar = document.createElement("div");
      summaryBar.id = "summaryBar";
      summaryBar.style.margin = "10px 16px";
      summaryBar.style.padding = "8px 12px";
      summaryBar.style.background = "#f3f4f6";
      summaryBar.style.borderRadius = "8px";
      summaryBar.style.fontSize = "14px";
      const pageTitle = document.querySelector(".page-title");
      if (pageTitle && pageTitle.parentNode) {
        pageTitle.parentNode.insertBefore(summaryBar, pageTitle.nextSibling);
      }
    }
    summaryBar.textContent =
      `اليوم اكتملت ${todayPaid.length} سيارة — داخل المغسلة الآن ${insideCount} سيارة غير مدفوعة`;
  } catch (err) {
    console.error(err);
  }
}

/* ===========================
   Events
=========================== */

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
    if (e.target.matches(".dropdown-content a")) {
      e.preventDefault();
      selectedPlate = e.target.getAttribute("data-plate");
      const method = e.target.getAttribute("data-method");
      openPaymentModal(method);
    }
  });
});
