// owner.js

// ===========================
// GLOBAL DATA + CONSTANTS
// ===========================
let allVisits = [];
let allCustomers = [];
let allServices = [];
let allEmployees = [];
let allBookings = [];
let allCosts = [];
let commissionMap = {};
let charts = {};

// مطابق لـ API
const VISIT_COL = {
  MEMBERSHIP: 0,
  PLATE_NUMBERS: 1,
  PLATE_LETTERS: 2,
  CAR_TYPE: 3,
  CAR_MODEL: 4,
  CAR_SIZE: 5,
  SERVICE: 6,
  PRICE: 7,
  POINTS: 8,
  EMP_IN: 9,
  EMP_OUT: 10,
  BRANCH: 11,
  COMMISSION: 12,
  CHECK_IN: 13,
  CHECK_OUT: 14,
  PAY_STATUS: 15,
  PAY_METHOD: 16,
  PARKING: 17,
  RATING: 18,
  PAY_METHOD_COPY: 19,
  CASH_AMOUNT: 20,
  CARD_AMOUNT: 21,
  TOTAL_PAID: 22
};

const CUST_COL = {
  NAME: 0,
  PHONE: 1,
  CAR: 2,
  SIZE: 3,
  CITY: 4,
  PLATE_NUMBERS: 5,
  PLATE_LETTERS: 6,
  SUBSCRIPTION: 7,
  MEMBERSHIP: 8,
  LAST_VISIT: 9,
  VISIT_COUNT: 10,
  POINTS: 11,
  LEVEL: 12,
  FREE_WASH: 13
};

const BOOK_COL = {
  PHONE: 0,
  MEMBERSHIP: 1,
  SERVICE: 2,
  DATE: 3,
  TIME: 4,
  STATUS: 5,
  CREATED_AT: 6
};

const COST_COL = {
  DETAILS: 0,
  AMOUNT: 1,
  TYPE: 2
};

const COMM_COL = {
  SERVICE: 0,
  COMMISSION: 1,
  PRICE: 2,
  DURATION: 3,
  CATEGORY: 4
};

const EMP_COL = {
  EMPLOYEE: 0
};

// ===========================
// INIT
// ===========================
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initData();
});

// ===========================
// TABS
// ===========================
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));

      btn.classList.add("active");
      const id = btn.getAttribute("data-tab");
      document.getElementById(id).classList.add("active");

      if (id === "dashboard") loadDashboard();
      if (id === "daily") initPeriodTab();
      if (id === "payroll") {/* يدوي */ }
      if (id === "decision") loadDecisionReports();
      if (id === "customers") loadCustomers();
      if (id === "bookings") loadBookings();
      if (id === "costs") loadCosts();
    });
  });
}

// ===========================
// LOAD ALL DATA (NEW VERSION)
// ===========================
let dailyIncome = []; // جدول الدخل اليومي

async function initData() {

  const [
    vRes,      // Visits
    cRes,      // Customers
    sRes,      // Commissions
    eRes,      // Employees
    bRes,      // Bookings
    costRes,   // Cost
    dailyRes   // Daily Income ← الجديد
  ] = await Promise.all([
    apiGetAll("Visits"),
    apiGetAll("Customers"),
    apiGetAll("Commissions"),
    apiGetAll("Employees"),
    apiGetAll("Bookings"),
    apiGetAll("Cost"),
    apiGetAll("Daily Income")   // ← جدول الدخل اليومي
  ]);

  // تخزين البيانات
  if (vRes.success)    allVisits    = vRes.rows || [];
  if (cRes.success)    allCustomers = cRes.rows || [];
  if (sRes.success)    allServices  = sRes.rows || [];
  if (eRes.success)    allEmployees = eRes.rows || [];
  if (bRes.success)    allBookings  = bRes.rows || [];
  if (costRes.success) allCosts     = costRes.rows || [];
  if (dailyRes.success) dailyIncome = dailyRes.rows || [];

  // تجهيز خريطة العمولات
  commissionMap = {};
  allServices.forEach(r => {
    const service = r[COMM_COL.SERVICE];
    const comm    = Number(r[COMM_COL.COMMISSION] || 0);
    commissionMap[service] = comm;
  });

  // تشغيل الصفحة
  loadDashboard();        // ← الآن يقرأ من Daily Income
  loadDecisionReports();  // ← ما زال يعتمد على Visits
  loadCosts();            // ← يعتمد على Cost
}

// ===========================
// HELPERS
// ===========================
function parseDateFromVisit(v) {
  const raw = String(v[VISIT_COL.CHECK_IN] || "");
  if (!raw) return null;
  return raw.split(" ")[0] || null;
}

function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

function formatCurrency(v) {
  return Number(v || 0).toLocaleString("ar-SA") + " ريال";
}

function clearChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    charts[id] = null;
  }
}

// ===========================
// COST ESTIMATION PER DAY
// ===========================
function getCostForDate(_dateStr) {
  let total = 0;
  allCosts.forEach(r => {
    const amount = Number(r[COST_COL.AMOUNT] || 0);
    const type = String(r[COST_COL.TYPE] || "").toLowerCase();
    if (!amount) return;

    if (type === "daily") total += amount;
    else if (type === "weekly") total += amount / 7;
    else if (type === "monthly") total += amount / 30;
    else if (type === "yearly") total += amount / 365;
    else total += amount;
  });
  return total;
}

// ===========================
// DASHBOARD
// ===========================
function resetDashboardDates() {
  document.getElementById("dashFrom").value = "";
  document.getElementById("dashTo").value = "";
  loadDashboard();
}

function loadDashboard() {
  const from = document.getElementById("dashFrom").value || null;
  const to   = document.getElementById("dashTo").value   || null;

  // Daily Income columns:
  // 0 Month
  // 1 Week
  // 2 Day Name
  // 3 Day (yyyy-mm-dd)
  // 4 Amount - المبيعات
  // 5 Commission - العمولات
  // 6 Net Profit

  let rows = dailyIncome.slice();

  if (from || to) {
    rows = rows.filter(r => {
      const d = String(r[3] || "");
      if (!d) return false;
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      return true;
    });
  }

  // تجميع القيم
  const labels = rows.map(r => r[3]);
  const revenueData = rows.map(r => Number(r[4] || 0));
  const commissionData = rows.map(r => Number(r[5] || 0));
  const profitData = rows.map(r => Number(r[6] || 0));

  const totalRevenue = revenueData.reduce((a,b)=>a+b,0);
  const totalCommission = commissionData.reduce((a,b)=>a+b,0);
  const totalProfit = profitData.reduce((a,b)=>a+b,0);

  // عرض الـ KPIs
  document.getElementById("dashboardKpis").innerHTML = `
    <div class="grid">
      <div class="kpi">
        <div class="kpi-title">💰 إجمالي الدخل</div>
        <div class="kpi-value">${formatCurrency(totalRevenue)}</div>
      </div>

      <div class="kpi">
        <div class="kpi-title">💼 إجمالي العمولات</div>
        <div class="kpi-value">${formatCurrency(totalCommission)}</div>
      </div>

      <div class="kpi">
        <div class="kpi-title">📈 صافي الربح</div>
        <div class="kpi-value">${formatCurrency(totalProfit)}</div>
      </div>

      <div class="kpi">
        <div class="kpi-title">📅 عدد الأيام</div>
        <div class="kpi-value">${rows.length}</div>
      </div>
    </div>
  `;

  // رسم الشارتات
  clearChart("chartRevenueDaily");
  clearChart("chartProfitDaily");
  clearChart("chartCommissionEmployees");

  charts["chartRevenueDaily"] = new Chart(document.getElementById("chartRevenueDaily"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "الدخل اليومي",
        data: revenueData,
        backgroundColor: "#0D47A1"
      }]
    }
  });

  charts["chartProfitDaily"] = new Chart(document.getElementById("chartProfitDaily"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "صافي الربح اليومي",
        data: profitData,
        borderColor: "#FF8F00",
        backgroundColor: "rgba(255,143,0,0.2)",
        fill: true,
        tension: 0.3
      }]
    }
  });

  charts["chartCommissionEmployees"] = new Chart(document.getElementById("chartCommissionEmployees"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "عمولات الموظفين اليومية",
        data: commissionData,
        backgroundColor: "#00897B"
      }]
    }
  });
}

// ===========================
// PERIOD REPORTS
// ===========================
function initPeriodTab() {
  const sel = document.getElementById("reportType");
  if (!sel._bound) {
    sel.addEventListener("change", onReportTypeChange);
    sel._bound = true;
  }
}

function onReportTypeChange() {
  const type = document.getElementById("reportType").value;
  document.getElementById("dailyFilter").style.display = (type === "daily") ? "block" : "none";
  document.getElementById("weeklyFilter").style.display = (type === "weekly") ? "block" : "none";
  document.getElementById("monthlyFilter").style.display = (type === "monthly") ? "block" : "none";
  document.getElementById("yearlyFilter").style.display = (type === "yearly") ? "block" : "none";
}

function getWeekRangeFromDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  let day = d.getDay(); // 0-6
  const diffToWed = (day - 3 + 7) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - diffToWed);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const fmt = x => x.toISOString().slice(0, 10);
  return { from: fmt(start), to: fmt(end) };
}

function loadPeriodReport() {
  const type = document.getElementById("reportType").value;
  let from = null, to = null, label = "";

  if (type === "daily") {
    const d = document.getElementById("dailyDate").value;
    if (!d) { alert("اختر تاريخ اليوم"); return; }
    from = d; to = d;
    label = "تقرير يومي لـ " + d;
  } else if (type === "weekly") {
    const d = document.getElementById("weeklyAnyDate").value;
    if (!d) { alert("اختر أي تاريخ داخل الأسبوع"); return; }
    const range = getWeekRangeFromDate(d);
    from = range.from;
    to = range.to;
    label = `تقرير أسبوعي من ${from} إلى ${to}`;
  } else if (type === "monthly") {
    const y = document.getElementById("monthlyYear").value;
    const m = document.getElementById("monthlyMonth").value;
    if (!y || !m) { alert("أدخل السنة والشهر"); return; }
    const mm = String(m).padStart(2, "0");
    from = `${y}-${mm}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    to = `${y}-${mm}-${String(lastDay).padStart(2, "0")}`;
    label = `تقرير شهري لـ ${y}-${mm}`;
  } else if (type === "yearly") {
    const y = document.getElementById("yearlyYear").value;
    if (!y) { alert("أدخل السنة"); return; }
    from = `${y}-01-01`;
    to = `${y}-12-31`;
    label = `تقرير سنوي لـ ${y}`;
  }

  let visits = allVisits.filter(v => inRange(parseDateFromVisit(v), from, to));

  let totalRevenue = 0;
  let totalCommission = 0;
  let totalCost = 0;
  let revenueByDay = {};
  let profitByDay = {};
  let serviceCount = {};
  let employeeCount = {};

  visits.forEach(v => {
    const price = Number(v[VISIT_COL.PRICE] || 0);
    const service = v[VISIT_COL.SERVICE];
    const employee = v[VISIT_COL.EMP_IN];
    const date = parseDateFromVisit(v);

    totalRevenue += price;
    const comm = commissionMap[service] || 0;
    totalCommission += comm;

    if (service) serviceCount[service] = (serviceCount[service] || 0) + 1;
    if (employee) employeeCount[employee] = (employeeCount[employee] || 0) + 1;
    if (date) {
      revenueByDay[date] = (revenueByDay[date] || 0) + price;
    }
  });

  const daysSet = new Set(Object.keys(revenueByDay));
  daysSet.forEach(d => {
    totalCost += getCostForDate(d);
  });

  const totalProfit = totalRevenue - (totalCost + totalCommission);

  function getMaxKey(obj) {
    let maxK = "-";
    let maxV = 0;
    Object.keys(obj).forEach(k => {
      if (obj[k] > maxV) {
        maxV = obj[k];
        maxK = k;
      }
    });
    return maxK;
  }

  const bestService = getMaxKey(serviceCount);
  const bestEmployee = getMaxKey(employeeCount);

  Object.keys(revenueByDay).forEach(d => {
    const rev = revenueByDay[d];
    const cost = getCostForDate(d);
    const share = rev / (totalRevenue || 1);
    const comm = totalCommission * share;
    profitByDay[d] = rev - (cost + comm);
  });

  document.getElementById("periodSummary").innerHTML = `
    <div style="margin-bottom:8px;font-weight:600;">${label}</div>
    <div class="grid">
      <div class="kpi">
        <div class="kpi-title">💰 إجمالي الدخل</div>
        <div class="kpi-value">${formatCurrency(totalRevenue)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-title">💸 إجمالي المصاريف التقديرية</div>
        <div class="kpi-value">${formatCurrency(totalCost)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-title">💼 إجمالي العمولات</div>
        <div class="kpi-value">${formatCurrency(totalCommission)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-title">📈 صافي الربح التقديري</div>
        <div class="kpi-value">${formatCurrency(totalProfit)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-title">🧽 عدد الزيارات</div>
        <div class="kpi-value">${visits.length}</div>
      </div>
      <div class="kpi">
        <div class="kpi-title">🧴 أكثر خدمة طلباً</div>
        <div class="kpi-value">${bestService}</div>
      </div>
      <div class="kpi">
        <div class="kpi-title">🏅 أكثر موظف نشاطاً</div>
        <div class="kpi-value">${bestEmployee}</div>
      </div>
    </div>
  `;

  const labels = Object.keys(revenueByDay).sort();
  const revData = labels.map(d => revenueByDay[d]);
  const profitData = labels.map(d => profitByDay[d] || 0);

  clearChart("chartPeriodRevenue");
  charts["chartPeriodRevenue"] = new Chart(document.getElementById("chartPeriodRevenue"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "الدخل",
          data: revData,
          backgroundColor: "#0D47A1"
        },
        {
          label: "صافي الربح",
          data: profitData,
          backgroundColor: "#FF8F00"
        }
      ]
    }
  });
}

// ===========================
// PAYROLL
// ===========================
function setDefaultPayrollWeek() {
  const today = new Date();
  const range = getWeekRangeFromDate(today.toISOString().slice(0, 10));
  document.getElementById("payFrom").value = range.from;
  document.getElementById("payTo").value = range.to;
}

function loadPayroll() {
  const from = document.getElementById("payFrom").value;
  const to = document.getElementById("payTo").value;
  if (!from || !to) {
    alert("اختر من تاريخ وإلى تاريخ");
    return;
  }

  let visits = allVisits.filter(v => inRange(parseDateFromVisit(v), from, to));
  let payroll = {};

  allEmployees.forEach(e => {
    const name = e[EMP_COL.EMPLOYEE];
    payroll[name] = { visits: 0, commission: 0, revenue: 0 };
  });

  visits.forEach(v => {
    const employee = v[VISIT_COL.EMP_IN];
    const service = v[VISIT_COL.SERVICE];
    const price = Number(v[VISIT_COL.PRICE] || 0);
    const comm = commissionMap[service] || 0;

    if (!payroll[employee]) {
      payroll[employee] = { visits: 0, commission: 0, revenue: 0 };
    }

    payroll[employee].visits += 1;
    payroll[employee].commission += comm;
    payroll[employee].revenue += price;
  });

  const rows = Object.keys(payroll)
    .map(name => ({ name, ...payroll[name] }))
    .filter(r => r.visits > 0);

  if (!rows.length) {
    document.getElementById("payrollTable").innerHTML =
      `<div style="text-align:center;color:#9CA3AF;font-size:14px;">لا توجد زيارات في هذه الفترة.</div>`;
    return;
  }

  document.getElementById("payrollTable").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>الموظف</th>
          <th>عدد الزيارات</th>
          <th>إجمالي الدخل الذي اشتغل عليه</th>
          <th>إجمالي العمولة المستحقة</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.name}</td>
            <td>${r.visits}</td>
            <td>${formatCurrency(r.revenue)}</td>
            <td>${formatCurrency(r.commission)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// ===========================
// DECISION REPORTS
// ===========================
function loadDecisionReports() {
  if (!allVisits.length) {
    document.getElementById("decisionContent").innerHTML = "جاري التحميل...";
    return;
  }

  let serviceCount = {};
  let serviceRevenue = {};
  let hourCount = {};
  let branchRevenue = {};
  let customerVisits = {};
  let customerRevenue = {};

  allVisits.forEach(v => {
    const service = v[VISIT_COL.SERVICE];
    const price = Number(v[VISIT_COL.PRICE] || 0);
    const branch = v[VISIT_COL.BRANCH];
    const membership = v[VISIT_COL.MEMBERSHIP];
    const checkIn = String(v[VISIT_COL.CHECK_IN] || "");
    const hour = checkIn.split(" ")[1] ? checkIn.split(" ")[1].slice(0, 2) : null;

    if (service) {
      serviceCount[service] = (serviceCount[service] || 0) + 1;
      serviceRevenue[service] = (serviceRevenue[service] || 0) + price;
    }
    if (branch) {
      branchRevenue[branch] = (branchRevenue[branch] || 0) + price;
    }
    if (membership) {
      customerVisits[membership] = (customerVisits[membership] || 0) + 1;
      customerRevenue[membership] = (customerRevenue[membership] || 0) + price;
    }
    if (hour) {
      hourCount[hour] = (hourCount[hour] || 0) + 1;
    }
  });

  function topN(obj, n = 5) {
    return Object.keys(obj)
      .map(k => ({ key: k, value: obj[k] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, n);
  }

  const topServices = topN(serviceCount);
  const lowServices = topN(serviceCount).reverse();
  const topBranches = topN(branchRevenue);
  const topHours = topN(hourCount);
  const topCustomersVisits = topN(customerVisits);
  const topCustomersRevenue = topN(customerRevenue);

  document.getElementById("decisionContent").innerHTML = `
    <div class="grid">
      <div>
        <h4>🧴 أكثر الخدمات طلباً</h4>
        <table>
          <thead><tr><th>الخدمة</th><th>عدد الزيارات</th></tr></thead>
          <tbody>
            ${topServices.map(r => `
              <tr><td>${r.key}</td><td>${r.value}</td></tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div>
        <h4>🧴 أقل الخدمات طلباً</h4>
        <table>
          <thead><tr><th>الخدمة</th><th>عدد الزيارات</th></tr></thead>
          <tbody>
            ${lowServices.map(r => `
              <tr><td>${r.key}</td><td>${r.value}</td></tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div>
        <h4>🏢 الفروع الأعلى دخلاً</h4>
        <table>
          <thead><tr><th>الفرع</th><th>الدخل</th></tr></thead>
          <tbody>
            ${topBranches.map(r => `
              <tr><td>${r.key}</td><td>${formatCurrency(r.value)}</td></tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div>
        <h4>⏰ أوقات الذروة</h4>
        <table>
          <thead><tr><th>الساعة</th><th>عدد الزيارات</th></tr></thead>
          <tbody>
            ${topHours.map(r => `
              <tr><td>${r.key}:00</td><td>${r.value}</td></tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div>
        <h4>👥 العملاء الأكثر زيارة</h4>
        <table>
          <thead><tr><th>العضوية</th><th>عدد الزيارات</th></tr></thead>
          <tbody>
            ${topCustomersVisits.map(r => `
              <tr><td>${r.key}</td><td>${r.value}</td></tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div>
        <h4>👑 العملاء الأعلى إنفاقاً</h4>
        <table>
          <thead><tr><th>العضوية</th><th>إجمالي الإنفاق</th></tr></thead>
          <tbody>
            ${topCustomersRevenue.map(r => `
              <tr><td>${r.key}</td><td>${formatCurrency(r.value)}</td></tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ===========================
// CUSTOMERS
// ===========================
function loadCustomers() {
  const box = document.getElementById("customersTable");
  const q = document.getElementById("customerSearch").value.trim().toLowerCase();

  const visitsMap = {};
  allVisits.forEach(v => {
    const mem = v[VISIT_COL.MEMBERSHIP];
    if (!visitsMap[mem]) visitsMap[mem] = [];
    visitsMap[mem].push(v);
  });

  const filtered = allCustomers.filter(c => {
    const name = String(c[CUST_COL.NAME] || "").toLowerCase();
    const phone = String(c[CUST_COL.PHONE] || "").toLowerCase();
    const mem = String(c[CUST_COL.MEMBERSHIP] || "").toLowerCase();
    if (!q) return true;
    return name.includes(q) || phone.includes(q) || mem.includes(q);
  });

  if (!filtered.length) {
    box.innerHTML = `<div style="text-align:center;color:#9CA3AF;font-size:14px;">لا توجد نتائج مطابقة</div>`;
    return;
  }

  box.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>الاسم</th>
          <th>العضوية</th>
          <th>الجوال</th>
          <th>عدد الزيارات</th>
          <th>إجمالي المدفوع</th>
          <th>النقاط</th>
          <th>المستوى</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(c => {
          const mem = c[CUST_COL.MEMBERSHIP];
          const visits = visitsMap[mem] || [];
          const totalPaid = visits.reduce((sum, v) => sum + Number(v[VISIT_COL.PRICE] || 0), 0);
          return `
            <tr>
              <td>${c[CUST_COL.NAME] || "—"}</td>
              <td>${mem || "—"}</td>
              <td>${c[CUST_COL.PHONE] || "—"}</td>
              <td>${visits.length}</td>
              <td>${formatCurrency(totalPaid)}</td>
              <td>${c[CUST_COL.POINTS] || 0}</td>
              <td>${c[CUST_COL.LEVEL] || "—"}</td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

// ===========================
// BOOKINGS
// ===========================
function loadBookings() {
  const box = document.getElementById("bookingsList");
  if (!allBookings.length) {
    box.innerHTML = "لا توجد حجوزات حالياً.";
    return;
  }

  box.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>الخدمة</th>
          <th>التاريخ</th>
          <th>الوقت</th>
          <th>الجوال</th>
          <th>العضوية</th>
          <th>الحالة</th>
        </tr>
      </thead>
      <tbody>
        ${allBookings.map(b => `
          <tr>
            <td>${b[BOOK_COL.SERVICE]}</td>
            <td>${b[BOOK_COL.DATE]}</td>
            <td>${b[BOOK_COL.TIME]}</td>
            <td>${b[BOOK_COL.PHONE]}</td>
            <td>${b[BOOK_COL.MEMBERSHIP] || "—"}</td>
            <td><span class="tag">${b[BOOK_COL.STATUS]}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// ===========================
// COSTS
// ===========================
function loadCosts() {
  const sumBox = document.getElementById("costSummary");
  const tableBox = document.getElementById("costTable");

  if (!allCosts.length) {
    sumBox.innerHTML = "لا توجد بيانات مصاريف.";
    tableBox.innerHTML = "";
    return;
  }

  let total = 0;
  let monthly = 0;
  let yearly = 0;
  let other = 0;

  allCosts.forEach(r => {
    const amount = Number(r[COST_COL.AMOUNT] || 0);
    const type = String(r[COST_COL.TYPE] || "");
    total += amount;
    if (type === "Monthly") monthly += amount;
    else if (type === "Yearly") yearly += amount;
    else other += amount;
  });

  sumBox.innerHTML = `
    <div class="grid">
      <div class="kpi">
        <div class="kpi-title">💸 إجمالي المصاريف</div>
        <div class="kpi-value">${formatCurrency(total)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-title">📅 مصاريف شهرية</div>
        <div class="kpi-value">${formatCurrency(monthly)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-title">📆 مصاريف سنوية</div>
        <div class="kpi-value">${formatCurrency(yearly)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-title">أخرى</div>
        <div class="kpi-value">${formatCurrency(other)}</div>
      </div>
    </div>
  `;

  tableBox.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>التفاصيل</th>
          <th>المبلغ</th>
          <th>النوع</th>
        </tr>
      </thead>
      <tbody>
        ${allCosts.map(r => `
          <tr>
            <td>${r[COST_COL.DETAILS]}</td>
            <td>${formatCurrency(r[COST_COL.AMOUNT])}</td>
            <td>${r[COST_COL.TYPE] || "—"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}
