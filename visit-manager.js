/* ===========================================
   Hybrid Foam - Visit Manager JavaScript
=========================================== */

const el = id => document.getElementById(id);
let activeVisits = [];
let selectedPlate = null;
let selectedServices = [];
let carTypesData = [];
let servicesData = [];
let employeesData = [];

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

async function loadActiveVisits() {
    const list = el("activeVisitsList");
    list.innerHTML = '<div class="loading">Loading...</div>';
    try {
        const res = await apiGetActiveVisits();
        const rows = res.visits || [];
        activeVisits = rows;

        updateSummary(rows);

        if (!rows.length) {
            list.innerHTML = '<p style="text-align:center;color:#666;padding:40px;">No active visits.</p>';
            return;
        }

        const cars = {};
        for (const v of rows) {
            const r = v.data;
            if (!r || !Array.isArray(r) || r.length < 25) continue;

            const plate = r[1];
            const brand = r[3] || "";
            const service = r[6];
            const price = Number(r[7] || 0);
            const emp = r[9] || "Not set";
            const parking = r[17];
            const discount = Number(r[24] || 0);

            if (!cars[plate]) {
                cars[plate] = { plate, brand, employee: emp, parking, services: [], total: 0, discount };
            }
            cars[plate].services.push({ name: service, price });
            cars[plate].total += price;
        }

        Object.values(cars).forEach(car => {
            car.totalAfterDiscount = car.total - car.discount;
        });

        const fragment = document.createDocumentFragment();

        for (const car of Object.values(cars)) {
            const card = document.createElement("div");
            card.className = "car-card";

            const servicesHTML = car.services.map(s => `<li><span>${s.name}</span><span>${s.price} ريال</span></li>`).join("");

            card.innerHTML = `
                <div class="card-header">
                    <div>
                        <h4>🚗 Plate: ${car.plate} — ${car.brand}</h4>
                        <p>👤 Employee: ${car.employee} | 🅿️ Parking: ${car.parking || "-"}</p>
                    </div>
                    <div class="dropdown">
                        <button class="edit-btn" type="button">⋮ Edit ▼</button>
                        <div class="dropdown-content edit-menu" data-plate="${car.plate}">
                            <button data-action="swap" type="button">🔄 Swap Service</button>
                            <button data-action="delete" type="button">🗑️ Delete Service</button>
                            <button data-action="add" type="button">➕ Add Service</button>
                            <button data-action="emp" type="button">👤 Change Employee</button>
                            <button data-action="disc" type="button">💰 Change Discount</button>
                            <button data-action="tip" type="button">🎁 Change Tip</button>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <ul>${servicesHTML}</ul>
                    <p><b>Total Before Discount:</b> <span>${car.total} ريال</span></p>
                    <p><b>Discount:</b> <span>${car.discount} ريال</span></p>
                    <p><b>Total After Discount:</b> <span>${car.totalAfterDiscount} ريال</span></p>
                </div>
                <div class="card-footer">
                    <div class="dropdown">
                        <button class="btn-pay" type="button">💳 Update Payment ▼</button>
                        <div class="dropdown-content pay-menu" data-plate="${car.plate}">
                            <button data-method="كاش" type="button">💵 Cash Payment</button>
                            <button data-method="شبكة" type="button">💳 Card Payment</button>
                            <button data-method="جزئي" type="button">💰 Partial Payment</button>
                        </div>
                    </div>
                </div>`;

            fragment.appendChild(card);
        }

        list.innerHTML = "";
        list.appendChild(fragment);

    } catch (err) {
        console.error(err);
        showToast("Error loading visits", "error");
    }
}

function updateSummary(rows) {
    const uniquePlates = new Set(rows.map(v => v.data[1])).size;
    const totalAmount = rows.reduce((sum, v) => sum + Number(v.data[7] || 0), 0);

    el("summaryActive").textContent = rows.length;
    el("summaryCars").textContent = uniquePlates;
    el("summaryTotal").textContent = totalAmount + " ريال";
}

function openPaymentModal(plate) {
    selectedPlate = plate;

    const rows = activeVisits.filter(
        v => v && v.data && Array.isArray(v.data) && v.data.length > 1 && v.data[1] === plate
    );

    if (!rows.length) {
        closePaymentModal();
        return;
    }

    const prices = rows.map(v => Number(v.data[7] || 0));
    const totalBeforeDiscount = prices.reduce((a, b) => a + b, 0);
    const discount = rows[0].data[24] !== undefined ? Number(rows[0].data[24]) : 0;
    const tip = rows[0].data[23] !== undefined ? Number(rows[0].data[23]) : 0;
    const totalAfterDiscount = totalBeforeDiscount - discount;

    el("modal_total_before").textContent = totalBeforeDiscount + " ريال";
    el("modal_discount").textContent = discount + " ريال";
    el("modal_total_after").textContent = totalAfterDiscount + " ريال";
    el("modal_tip").textContent = tip + " ريال";

    el("cash_box").style.display = "none";
    el("card_box").style.display = "none";
    el("modal_cash").value = "";
    el("modal_card").value = "";

    el("paymentModal").classList.add("show");

    const modalConfirm = el("modal_confirm");
    modalConfirm.onclick = () => {
        const method = el("modal_method_select").value;
        if (method === "جزئي") {
            el("cash_box").style.display = "block";
            el("card_box").style.display = "block";
            modalConfirm.onclick = () => submitPayment(method, totalAfterDiscount);
        } else {
            submitPayment(method, totalAfterDiscount);
        }
    };
}

function closePaymentModal() {
    el("paymentModal").classList.remove("show");
}
// Submit payment and update payment status
async function submitPayment(method, total) {
  const btn = el("modal_confirm");
  btn.disabled = true;
  btn.textContent = "Processing...";

  let cash = 0,
    card = 0;
  if (method === "كاش") cash = total;
  else if (method === "شبكة") card = total;
  else if (method === "جزئي") {
    cash = Number(el("modal_cash").value || 0);
    card = Number(el("modal_card").value || 0);
    if (cash + card !== total) {
      showToast(`Amount must be ${total} ريال`, "error");
      btn.disabled = false;
      btn.textContent = "Confirm";
      return;
    }
  }

  const rows = activeVisits.filter(
    v => v && v.data && Array.isArray(v.data) && v.data.length > 1 && v.data[1] === selectedPlate
  );

  if (!rows.length) {
    showToast("Error: No visit data found", "error");
    btn.disabled = false;
    btn.textContent = "Confirm";
    closePaymentModal();
    return;
  }

  const prices = rows.map(v => Number(v.data[7] || 0));
  const totalBeforeDiscount = prices.reduce((a, b) => a + b, 0);
  const discount = rows[0].data[24] !== undefined ? Number(rows[0].data[24]) : 0;
  const tip = rows[0].data[23] !== undefined ? Number(rows[0].data[23]) : 0;

  const distributedDiscount = prices.map(price => {
    const ratio = totalBeforeDiscount ? price / totalBeforeDiscount : 0;
    return Math.round(ratio * discount);
  });

  const distributedPaid = prices.map((price, i) => price - (distributedDiscount[i] || 0));

  for (let i = 0; i < rows.length; i++) {
    const v = rows[i];
    await apiCloseVisit(v.row, {
      payment_status: "مدفوع",
      payment_method: method,
      cash_amount: method === "كاش" ? distributedPaid[i] : method === "جزئي" ? cash : 0,
      card_amount: method === "شبكة" ? distributedPaid[i] : method === "جزئي" ? card : 0,
      total_paid: distributedPaid[i],
      discount: distributedDiscount[i],
      tip: i === 0 ? tip : 0,
    });
  }

  showToast("✅ Payment updated successfully", "success");
  closePaymentModal();
  loadActiveVisits();

  btn.disabled = false;
  btn.textContent = "Confirm";
}

// Open edit modal and load tabs content
function openEditModal(action) {
  el("editModal").classList.add("show");
  loadSwapTab();
  loadDeleteTab();
  loadAddTab();
  loadEmpTab();
}

function closeEditModal() {
  el("editModal").classList.remove("show");
}

// Tabs navigation
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

    btn.classList.add("active");
    el(btn.dataset.tab).classList.add("active");
  };
});

// Swap Service Tab
function loadSwapTab() {
  const sel = el("swapServiceSelect");
  sel.innerHTML = "";

  servicesData.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.service;
    opt.textContent = `${s.service} — ${s.price} ريال`;
    opt.dataset.price = s.price;
    sel.appendChild(opt);
  });

  el("swapConfirm").onclick = async () => {
    const rows = activeVisits.filter(v => v.data[1] === selectedPlate);
    if (!rows.length) return showToast("Visit not found", "error");
    const row = rows[0];

    await apiUpdateRow("Visits", row.row, JSON.stringify({
      service_detail: sel.value,
      price: Number(sel.selectedOptions[0].dataset.price),
    }));

    showToast("✅ Service swapped successfully", "success");
    loadActiveVisits();
    closeEditModal();
  };
}

// Delete Service Tab
function loadDeleteTab() {
  const sel = el("deleteServiceSelect");
  sel.innerHTML = "";

  const rows = activeVisits.filter(v => v.data[1] === selectedPlate);

  rows.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v.row;
    opt.textContent = `${v.data[6]} — ${Number(v.data[7] || 0)} ريال`;
    sel.appendChild(opt);
  });

  el("deleteConfirm").onclick = async () => {
    el("deleteConfirm").disabled = true;
    el("deleteConfirm").textContent = "Deleting...";

    await apiDeleteRow("Visits", sel.value);

    el("deleteConfirm").disabled = false;
    el("deleteConfirm").textContent = "Delete Service";

    showToast("✅ Service deleted successfully", "success");
    loadActiveVisits();
    closeEditModal();
  };
}
// Add Service Tab
function loadAddTab() {
  const sel = el("addServiceSelect");
  sel.innerHTML = "";

  servicesData.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.service;
    opt.textContent = `${s.service} — ${s.price} ريال`;
    opt.dataset.price = s.price;
    opt.dataset.points = s.commission;
    sel.appendChild(opt);
  });

  el("addConfirm").onclick = async () => {
    const service = sel.value;
    if (!service) return showToast("⚠️ يرجى اختيار خدمة", "warning");
    const price = Number(sel.selectedOptions[0].dataset.price);
    const points = Number(sel.selectedOptions[0].dataset.points);

    const exists = activeVisits.some(v =>
      v.data[1] === selectedPlate && v.data[6] === service
    );

    if (exists) {
      showToast("⚠️ الخدمة مضافة مسبقاً", "warning");
      return;
    }

    await apiAddVisit({
      services: [{ name: service, price, points }],
      plate_numbers: selectedPlate,
      plate_letters: "",
      car_type: "",
      car_model: "",
      car_size: "",
      employee_in: "",
      branch: "",
      parking_slot: "",
      payment_status: "غير مدفوع",
      payment_method: ""
    });

    showToast("✅ Service added successfully", "success");
    loadActiveVisits();
    closeEditModal();
  };
}

// Employee Tab
function loadEmpTab() {
  const sel = el("empSelect");
  sel.innerHTML = "";

  employeesData.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e[0];
    opt.textContent = e[0];
    sel.appendChild(opt);
  });

  el("empConfirm").onclick = async () => {
    const rows = activeVisits.filter(v => v.data[1] === selectedPlate);

    for (const v of rows) {
      await apiUpdateRow("Visits", v.row, JSON.stringify({ employee_in: sel.value }));
    }

    showToast("✅ Employee updated successfully", "success");
    loadActiveVisits();
    closeEditModal();
  };
}

// Discount Tab
el("discConfirm").onclick = async () => {
  const val = Number(el("discInput").value || 0);
  const rows = activeVisits.filter(v => v.data[1] === selectedPlate);

  for (const v of rows) {
    await apiUpdateRow("Visits", v.row, JSON.stringify({ discount: val }));
  }

  showToast("✅ Discount updated successfully", "success");
  loadActiveVisits();
  closeEditModal();
};

// Tip Tab
el("tipConfirm").onclick = async () => {
  const val = Number(el("tipInput").value || 0);
  const rows = activeVisits.filter(v => v.data[1] === selectedPlate);

  for (const v of rows) {
    await apiUpdateRow("Visits", v.row, JSON.stringify({ tip: val }));
  }

  showToast("✅ Tip updated successfully", "success");
  loadActiveVisits();
  closeEditModal();
};

// ===========================
// Initialization on window load
// ===========================
window.onload = async function () {
  console.log("Page script loaded and running");
  try {
    await Promise.all([loadCarTypes(), loadServices(), loadEmployees(), loadBranches()]);
    await loadActiveVisits();

    el("btnAddService").onclick = addServiceToList;
    el("btnSubmitVisit").onclick = submitVisit;
    el("btnRefreshActive").onclick = loadActiveVisits;

    el("payment_status").onchange = function () {
      el("payment_method_wrapper").style.display = this.value === "مدفوع" ? "block" : "none";
    };

    el("payment_method").onchange = function () {
      el("partial_payment_box").style.display = this.value === "جزئي" ? "block" : "none";
    };

    el("closePaymentModal").onclick = closePaymentModal;
    el("modal_close").onclick = closePaymentModal;
    el("editClose").onclick = closeEditModal;

    el("discount").oninput = recalcTotal;

    showToast("✅ النظام جاهز الآن", "success");
  } catch (error) {
    console.error(error);
    showToast("❌ فشل في تحميل البيانات", "error");
  }
};
// ===========================
// تحميل أنواع السيارات
// ===========================
async function loadCarTypes() {
  try {
    const res = await apiGetCarTypes();
    carTypesData = res.rows || [];

    const brandSel = el("car_type");
    const modelSel = el("car_model");
    const sizeInput = el("car_size");

    brandSel.innerHTML = '<option value="">— اختر البراند —</option>';
    modelSel.innerHTML = '<option value="">— اختر الموديل —</option>';
    sizeInput.value = "";

    const brands = [...new Set(carTypesData.map(r => r[0]))];

    brands.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b;
      opt.textContent = b;
      brandSel.appendChild(opt);
    });

    brandSel.onchange = () => {
      const brand = brandSel.value;
      modelSel.innerHTML = '<option value="">— اختر الموديل —</option>';

      const models = carTypesData.filter(r => r[0] === brand);
      const uniqueModels = [...new Set(models.map(r => r[1]))];

      uniqueModels.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        modelSel.appendChild(opt);
      });
    };

    modelSel.onchange = () => {
      const brand = brandSel.value;
      const model = modelSel.value;
      const row = carTypesData.find(r => r[0] === brand && r[1] === model);
      sizeInput.value = row ? row[2] : "";
    };
  } catch (err) {
    console.error(err);
    showToast("خطأ في تحميل أنواع السيارات", "error");
  }
}

// ===========================
// تحميل الخدمات
// ===========================
async function loadServices() {
  try {
    const res = await apiGetServices();
    servicesData = res.services || [];

    const typeSel = el("service_type");
    const detailSel = el("service_detail");

    typeSel.innerHTML = '<option value="">— اختر النوع —</option>';
    detailSel.innerHTML = '<option value="">— اختر الخدمة —</option>';

    const cats = [...new Set(servicesData.map(s => s.category))];

    cats.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      typeSel.appendChild(opt);
    });

    typeSel.onchange = () => {
      const cat = typeSel.value;
      detailSel.innerHTML = '<option value="">— اختر الخدمة —</option>';

      const filtered = servicesData.filter(s => s.category === cat);

      filtered.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.service;
        opt.textContent = s.service;
        opt.dataset.price = s.price;
        opt.dataset.points = s.commission;
        detailSel.appendChild(opt);
      });
    };

    detailSel.onchange = () => {
      const opt = detailSel.selectedOptions[0];
      if (opt) {
        el("price").value = opt.dataset.price || "";
        el("points").value = opt.dataset.points || "";
      }
    };
  } catch (err) {
    console.error(err);
    showToast("خطأ في تحميل الخدمات", "error");
  }
}

// ===========================
// تحميل الفروع مع تعيين القيمة الافتراضية "مكة"
// ===========================
async function loadBranches() {
  try {
    const res = await apiGetBranches();
    const rows = res.rows || [];
    const sel = el("branch");

    sel.innerHTML = '<option value="">— اختر الفرع —</option>';

    rows.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r[0];
      opt.textContent = r[0];
      sel.appendChild(opt);
    });

    const defaultValue = "مكة";
    if ([...sel.options].some(opt => opt.value === defaultValue)) {
      sel.value = defaultValue;
    }
  } catch (err) {
    console.error(err);
    showToast("خطأ في تحميل الفروع", "error");
  }
}

// ===========================
// تحميل الموظفين
// ===========================
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
