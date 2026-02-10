// ======================= Helpers =========================
const $ = (id) => document.getElementById(id);

function setLoading(btn, state = true) {
  if (!btn) return;
  if (state) {
    btn.classList.add("loading");
    btn.disabled = true;
  } else {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

function formatDateOnly(d) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10);
}

// ======================= Theme ===========================
(function initTheme() {
  const saved = localStorage.getItem("sup_theme") || "dark";
  document.body.setAttribute("data-theme", saved);
  $("themeToggle").addEventListener("click", () => {
    const current = document.body.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.body.setAttribute("data-theme", next);
    localStorage.setItem("sup_theme", next);
  });
})();

// ======================= Tabs ============================
(function initTabs() {
  const sections = document.querySelectorAll(".section");
  const navButtons = document.querySelectorAll(".nav-btn");
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      sections.forEach((s) => s.classList.remove("active"));
      document.getElementById(target).classList.add("active");
      navButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
})();

// ======================= Date Pickers ====================
(function initDatePickers() {
  const options = { dateFormat: "Y-m-d", allowInput: true };
  flatpickr("#visitsFrom", options);
  flatpickr("#visitsTo", options);
  flatpickr("#bookingsDate", options);
  flatpickr("#reportsFrom", options);
  flatpickr("#reportsTo", options);
  flatpickr("#exportFrom", options);
  flatpickr("#exportTo", options);
})();

// ======================= Branches ========================
let currentBranch = null;
let branchesList = [];

async function loadBranches() {
  const res = await apiGet({ action: "getBranches" });
  branchesList = res.branches || [];

  const select = $("branchSelect");
  select.innerHTML = "";

  branchesList.forEach((b) => {
    const opt = document.createElement("option");
    // API: { name, city, manager }
    opt.value = b.name;
    opt.textContent = `${b.name} — ${b.city}`;
    select.appendChild(opt);
  });

  const saved = localStorage.getItem("supervisor_branch");
  if (saved && branchesList.find((b) => b.name === saved)) {
    currentBranch = saved;
    select.value = saved;
  } else {
    currentBranch = branchesList.length ? branchesList[0].name : null;
    select.value = currentBranch;
  }

  $("currentBranch").textContent = currentBranch || "—";

  select.addEventListener("change", () => {
    currentBranch = select.value;
    localStorage.setItem("supervisor_branch", currentBranch);
    $("currentBranch").textContent = currentBranch;
    loadDashboard();
    loadBookings();
  });
}

// ======================= Dashboard =======================
let visitsChart = null;
let servicesChart = null;

async function loadDashboard() {
  if (!currentBranch) return;

  const fromDate = "2000-01-01T00:00:00.000Z";
  const toDate = "2100-01-01T23:59:59.000Z";

  const res = await apiGet({
    action: "getVisitsByDate",
    from: fromDate,
    to: toDate,
  });

  const visits = (res.visits || []).filter((v) => v.branch === currentBranch);

  const totalAmount = visits.reduce((s, v) => s + Number(v.price || 0), 0);
  const totalVisits = visits.length;
  const customersSet = new Set(visits.map((v) => v.membership));
  const customers = customersSet.size;
  const avgSpend = customers ? (totalAmount / customers).toFixed(1) : 0;

  $("sAmount").textContent = totalAmount;
  $("sVisits").textContent = totalVisits;
  $("sCustomers").textContent = customers;
  $("sCars").textContent = customers;
  $("mAmount").textContent = totalAmount;
  $("mAvgSpend").textContent = avgSpend;

  const maxVisits = 200;
  const maxAmount = 50000;
  const maxCustomers = 200;

  $("barCustomers").style.width = Math.min(100, (customers / maxCustomers) * 100) + "%";
  $("barVisits").style.width = Math.min(100, (totalVisits / maxVisits) * 100) + "%";
  $("barAmount").style.width = Math.min(100, (totalAmount / maxAmount) * 100) + "%";

  renderVisitsChart(visits);
  renderServicesChart(visits);
}

function renderVisitsChart(visits) {
  const ctx = $("visitsPerDayChart").getContext("2d");
  const map = {};

  visits.forEach((v) => {
    const d = v.date; // already formatted in API
    map[d] = (map[d] || 0) + 1;
  });

  const labels = Object.keys(map).sort();
  const data = labels.map((l) => map[l]);

  if (visitsChart) visitsChart.destroy();

  visitsChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "عدد الزيارات",
          data,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.2)",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { autoSkip: true, maxTicksLimit: 7 } },
      },
    },
  });
}

function renderServicesChart(visits) {
  const ctx = $("topServicesChart").getContext("2d");
  const map = {};

  visits.forEach((v) => {
    const s = v.service || "غير محدد";
    map[s] = (map[s] || 0) + 1;
  });

  const sorted = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const labels = sorted.map((s) => s[0]);
  const data = sorted.map((s) => s[1]);

  if (servicesChart) servicesChart.destroy();

  servicesChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "عدد الزيارات",
          data,
          backgroundColor: "#f59e0b",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
    },
  });
}

// ======================= Smart Customer Search ===========
async function smartSearchCustomer(query) {
  // جوال
  if (query.startsWith("05") && query.length === 10) {
    const res = await apiGet({ action: "getByPhone", phone: query });
    if (!res.success) return null;
    return { customers: [res.customer], cars: res.cars || [] };
  }

  // عضوية
  if (/^\d+$/.test(query)) {
    const res = await apiGet({ action: "getByMembership", membership: query });
    if (!res.success) return null;
    const cars = [];
    if (res.car) cars.push(res.car);
    return { customers: res.customer ? [res.customer] : [], cars };
  }

  return null;
}

// ======================= Customers =======================
async function handleCustomerSearch() {
  const btn = $("searchBtn");
  const query = $("searchPhone").value.trim();
  if (!query) return alert("أدخل رقم الجوال أو العضوية");

  setLoading(btn, true);
  const data = await smartSearchCustomer(query);
  setLoading(btn, false);

  const box = $("searchResult");
  box.innerHTML = "";

  if (!data || !data.customers.length) {
    box.innerHTML = "<p>لا يوجد نتائج</p>";
    return;
  }

  const c = data.customers[0];

  box.innerHTML = `
    <div class="card">
      الاسم: ${c.name}<br>
      الجوال: ${c.phone}<br>
      العضوية: ${c.membership}<br>
      النقاط: ${c.points}<br>
      المستوى: ${c.level}<br>
      آخر زيارة: ${c.last_visit || "—"}<br>
      عدد الزيارات: ${c.visit_count}
    </div>
  `;
}

// ======================= Visits ==========================
async function handleLoadVisits() {
  if (!currentBranch) return alert("اختر الفرع أولاً");

  const btn = $("visitsBtn");
  const from = $("visitsFrom").value.trim();
  const to = $("visitsTo").value.trim();

  setLoading(btn, true);

  let fromDate, toDate;
  if (!from && !to) {
    fromDate = "2000-01-01T00:00:00.000Z";
    toDate = "2100-01-01T23:59:59.000Z";
  } else {
    const f = from || to;
    const t = to || from;
    fromDate = new Date(f + "T00:00:00").toISOString();
    toDate = new Date(t + "T23:59:59").toISOString();
  }

  const res = await apiGet({
    action: "getVisitsByDate",
    from: fromDate,
    to: toDate,
  });

  setLoading(btn, false);

  const list = $("visitsList");
  list.innerHTML = "";

  const visits = (res.visits || []).filter((v) => v.branch === currentBranch);

  if (!visits.length) {
    list.innerHTML = "<p>لا توجد زيارات</p>";
    return;
  }

  visits.forEach((v) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      رقم العضوية: ${v.membership}<br>
      نوع الخدمة: ${v.service}<br>
      المبلغ: ${v.price}<br>
      العمولة: ${v.commission}<br>
      النقاط: ${v.points}<br>
      الموظف: ${v.employee || "—"}<br>
      الفرع: ${v.branch || "—"}<br>
      التاريخ: ${v.date}
    `;
    list.appendChild(div);
  });
}

// ======================= Cars ============================
async function handleLoadCars() {
  const btn = $("carsBtn");
  const phone = $("carsPhone").value.trim();
  if (!phone) return alert("أدخل رقم الجوال");

  setLoading(btn, true);
  const res = await apiGet({ action: "getCarsByPhone", phone });
  setLoading(btn, false);

  const list = $("carsList");
  list.innerHTML = "";

  if (!res.cars || !res.cars.length) {
    list.innerHTML = "<p>لا توجد سيارات</p>";
    return;
  }

  res.cars.forEach((c) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      السيارة: ${c.car} — ${c.plate_letters} ${c.plate_numbers}<br>
      الحجم: ${c.size}<br>
      المدينة: ${c.city}<br>
      رقم العضوية: ${c.membership}
    `;
    list.appendChild(div);
  });
}

// ======================= Add Visit =======================
let selectedMembership = null;
let selectedCar = null;
let servicesMap = {};

async function loadServicesForVisit() {
  const res = await apiGet({ action: "getCommissions" });
  const select = $("vService");
  select.innerHTML = "";
  servicesMap = {};

  res.commissions.forEach((s) => {
    // API: detail, commission, price, duration, type
    servicesMap[s.detail] = Number(s.price) || 0;
    const opt = document.createElement("option");
    opt.value = s.detail;
    opt.textContent = s.detail;
    select.appendChild(opt);
  });

  updateVisitPrice();
}

function updateVisitPrice() {
  const s = $("vService").value;
  $("vPrice").value = servicesMap[s] || 0;
  updateVisitPoints();
}

function updateVisitPoints() {
  const price = Number($("vPrice").value);
  $("vPoints").value = Math.floor(price / 5);
}

async function handleVisitSearch() {
  const btn = $("visitSearchBtn");
  const query = $("visitSearch").value.trim();
  if (!query) return alert("أدخل رقم الجوال أو العضوية");

  setLoading(btn, true);
  const data = await smartSearchCustomer(query);
  setLoading(btn, false);

  const box = $("visitCarsBox");
  const list = $("visitCarsList");
  list.innerHTML = "";

  if (!data || !data.cars.length) {
    alert("لا توجد سيارات مرتبطة بهذا العميل");
    box.style.display = "none";
    $("visitForm").style.display = "none";
    return;
  }

  box.style.display = "block";

  data.cars.forEach((c) => {
    const div = document.createElement("div");
    div.className = "card";
    div.style.cursor = "pointer";
    div.innerHTML = `
      ${c.car} — ${c.plate_letters} ${c.plate_numbers}<br>
      رقم العضوية: ${c.membership}<br>
      المدينة: ${c.city}
    `;
    div.onclick = () => selectVisitCar(c);
    list.appendChild(div);
  });
}

function selectVisitCar(c) {
  selectedMembership = c.membership;
  selectedCar = c;
  $("visitSelectedInfo").textContent =
    `رقم العضوية: ${c.membership} — السيارة: ${c.car} — اللوحة: ${c.plate_letters} ${c.plate_numbers}`;
  $("visitForm").style.display = "block";
}

async function handleAddVisit() {
  if (!currentBranch) return alert("اختر الفرع أولاً");
  if (!selectedMembership) return alert("اختر السيارة أولاً");

  const btn = $("addVisitBtn");
  setLoading(btn, true);

  const service = $("vService").value;
  const price = Number($("vPrice").value);
  const points = Number($("vPoints").value);

  const res = await apiPost({
    action: "addVisit",
    membership: selectedMembership,
    service_type: "",          // غير مستخدم في الـ API لكن موجود
    service_detail: service,   // مهم لحساب العمولة
    price,
    points,
    employee: "",
    branch: currentBranch,
    rating: "",
    payment_status: "Paid",
    parking_slot: ""
  });

  setLoading(btn, false);

  if (res.success) {
    $("addVisitStatus").textContent = "✔ تم تسجيل الزيارة بنجاح";
    loadDashboard();
  } else {
    $("addVisitStatus").textContent = "❌ حدث خطأ أثناء التسجيل";
  }
}

// ======================= Bookings ========================
async function loadBookings() {
  const date = $("bookingsDate").value.trim();
  const res = await apiGet({ action: "getBookings", date });

  const list = $("bookingsList");
  list.innerHTML = "";

  if (!res.bookings || !res.bookings.length) {
    list.innerHTML = "<p>لا توجد حجوزات</p>";
    return;
  }

  res.bookings.forEach((b) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      رقم الجوال: ${b.phone}<br>
      رقم العضوية: ${b.membership}<br>
      نوع الخدمة: ${b.service}<br>
      التاريخ: ${b.date} ${b.time}<br>
      الحالة الحالية: <b>${b.status}</b><br><br>
      <button class="btn-sm btn-secondary" onclick="confirmBooking(${b.row})">تأكيد</button>
      <button class="btn-sm btn-danger" onclick="cancelBooking(${b.row})">إلغاء</button>
    `;
    list.appendChild(div);
  });
}

async function confirmBooking(row) {
  await apiPost({ action: "updateBookingStatus", row, status: "Approved" });
  loadBookings();
}

async function cancelBooking(row) {
  await apiPost({ action: "updateBookingStatus", row, status: "Cancelled" });
  loadBookings();
}

// ======================= Reports =========================
async function loadReports() {
  if (!currentBranch) return alert("اختر الفرع أولاً");

  const btn = $("reportsBtn");
  const from = $("reportsFrom").value.trim();
  const to = $("reportsTo").value.trim();

  if (!from || !to) return alert("اختر من وإلى تاريخ");

  setLoading(btn, true);

  const fromDate = new Date(from + "T00:00:00").toISOString();
  const toDate = new Date(to + "T23:59:59").toISOString();

  const res = await apiGet({
    action: "getVisitsByDate",
    from: fromDate,
    to: toDate,
  });

  setLoading(btn, false);

  const list = $("reportsList");
  list.innerHTML = "";

  const visits = (res.visits || []).filter((v) => v.branch === currentBranch);

  if (!visits.length) {
    list.innerHTML = "<p>لا توجد زيارات في هذه الفترة</p>";
    return;
  }

  visits.forEach((v) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      رقم العضوية: ${v.membership}<br>
      الخدمة: ${v.service}<br>
      المبلغ: ${v.price}<br>
      العمولة: ${v.commission}<br>
      النقاط: ${v.points}<br>
      الموظف: ${v.employee || "—"}<br>
      الفرع: ${v.branch || "—"}<br>
      التاريخ: ${v.date}
    `;
    list.appendChild(div);
  });
}

// ======================= Export Excel ====================
async function handleExport() {
  if (!currentBranch) return alert("اختر الفرع أولاً");

  const from = $("exportFrom").value.trim();
  const to = $("exportTo").value.trim();
  if (!from || !to) return alert("اختر من وإلى تاريخ");

  const fromDate = new Date(from + "T00:00:00").toISOString();
  const toDate = new Date(to + "T23:59:59").toISOString();

  const res = await apiGet({
    action: "getVisitsByDate",
    from: fromDate,
    to: toDate,
  });

  const visits = (res.visits || []).filter((v) => v.branch === currentBranch);

  if (!visits.length) {
    alert("لا توجد بيانات للتصدير");
    return;
  }

  // نحتاج بيانات العميل/السيارة من Sheets أخرى؟ هنا نكتفي بما هو متاح
  const rows = visits.map((v) => ({
    membership: v.membership,
    service: v.service,
    price: v.price,
    commission: v.commission,
    points: v.points,
    employee: v.employee || "",
    branch: v.branch || "",
    date: v.date,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Visits");
  XLSX.writeFile(wb, `report_${currentBranch}_${from}_to_${to}.xlsx`);
}

// ======================= Init ============================
function initEvents() {
  $("searchBtn").onclick = handleCustomerSearch;
  $("visitsBtn").onclick = handleLoadVisits;
  $("carsBtn").onclick = handleLoadCars;
  $("visitSearchBtn").onclick = handleVisitSearch;
  $("vService").onchange = updateVisitPrice;
  $("vPrice").oninput = updateVisitPoints;
  $("addVisitBtn").onclick = handleAddVisit;
  $("bookingsDate").onchange = loadBookings;
  $("reportsBtn").onclick = loadReports;
  $("exportBtn").onclick = handleExport;
}

async function initSupervisor() {
  // لو حاب تحط حماية للمشرف:
  // if (!localStorage.getItem("supervisor_username")) {
  //   window.location.href = "supervisor-login.html";
  //   return;
  // }

  initEvents();
  await loadBranches();
  await loadServicesForVisit();
  await loadDashboard();
  await loadBookings();
}

initSupervisor();
