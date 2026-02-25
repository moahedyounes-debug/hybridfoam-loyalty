/* admin-dashboard.js
   Improved, safer, and more maintainable version.
   Layout and DOM IDs/classes preserved.
*/

const el = id => document.getElementById(id);
const q = sel => document.querySelector(sel);
const qAll = sel => Array.from(document.querySelectorAll(sel));

/* -------------------------
   Utilities
   ------------------------- */
const fmtCurrency = (v) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 2 }).format(Number(v || 0));
const fmtNumber = (v) => new Intl.NumberFormat('ar-SA').format(Number(v || 0));

const safeText = (s) => (s === null || s === undefined) ? '' : String(s);

const debounce = (fn, wait = 200) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

/* -------------------------
   Date helpers (robust)
   - parseDateTime: accepts ISO, "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss", "YYYY-MM-DD HH:mm:ss"
   - toDateOnlyISO: returns YYYY-MM-DD in UTC to compare date-only ranges reliably
   ------------------------- */
function parseDateTime(str) {
  if (!str) return null;
  str = String(str).trim();
  // Accept "YYYY-MM-DD" -> treat as local midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0);
  }
  // Replace T with space for safety, then try Date.parse
  const normalized = str.replace('T', ' ');
  const parsed = Date.parse(normalized);
  if (!isNaN(parsed)) return new Date(parsed);
  // Fallback: manual split
  const parts = normalized.split(' ');
  if (parts.length < 2) return null;
  const [datePart, timePart] = parts;
  const [y, m, d] = datePart.split('-').map(Number);
  let [hh = 0, mm = 0, ss = 0] = (timePart || '00:00:00').split(':').map(Number);
  if (isNaN(ss)) ss = 0;
  return new Date(y, m - 1, d, hh, mm, ss);
}

function toDateOnlyISO(d) {
  // Return YYYY-MM-DD using UTC to avoid timezone shifts when comparing date-only inputs
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* -------------------------
   State
   ------------------------- */
let allVisits = [];
let filteredVisits = [];
let currentActiveTab = 'employees';

/* -------------------------
   Init
   ------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  loadAllVisits();
  bindTabs();
  bindGlobalFilter();
  bindCompletedFilter();
  bindExport();
});

/* -------------------------
   Data loading
   ------------------------- */
async function loadAllVisits() {
  try {
    const res = await apiGetAll('Visits');
    if (!res || !res.success) {
      console.warn('Failed to load visits');
      return;
    }
    allVisits = Array.isArray(res.rows) ? res.rows : [];
    filteredVisits = [...allVisits];
    renderAll();
  } catch (err) {
    console.error('loadAllVisits error', err);
  }
}

/* -------------------------
   Render orchestration
   ------------------------- */
function renderAll() {
  renderTopSummary(filteredVisits);
  if (currentActiveTab === 'employees') renderEmployeesSummary(filteredVisits);
  if (currentActiveTab === 'services') renderServicesSummary(filteredVisits);
  if (currentActiveTab === 'completed') renderCompletedVisits(filteredVisits);
  if (currentActiveTab === 'invoices') renderInvoicesSummary(filteredVisits);
}

/* -------------------------
   Tabs (ARIA friendly)
   ------------------------- */
function bindTabs() {
  qAll('.tab-btn').forEach(btn => {
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-controls', 'tab-' + btn.dataset.tab);
    btn.onclick = () => {
      qAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      qAll('.tab-content').forEach(c => c.classList.remove('active'));
      const target = el('tab-' + btn.dataset.tab);
      if (target) target.classList.add('active');
      currentActiveTab = btn.dataset.tab;
      renderAll();
    };
  });
}

/* -------------------------
   Global filter
   ------------------------- */
function bindGlobalFilter() {
  el('gToday').onclick = () => applyGlobalFilter('today');
  el('gWeek').onclick = () => applyGlobalFilter('week');
  el('gMonth').onclick = () => applyGlobalFilter('month');
  el('gYear').onclick = () => applyGlobalFilter('year');
  el('gCustom').onclick = () => applyGlobalFilter('custom');
}

function applyGlobalFilter(type) {
  const now = new Date();
  if (type === 'today') {
    // Business day window: 12:30 -> next day 03:30 (15 hours)
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 30, 0);
    const end = new Date(start.getTime() + 15 * 60 * 60 * 1000);
    filteredVisits = allVisits.filter(v => {
      const d = parseDateTime(v[13]);
      return d && d >= start && d <= end;
    });
  } else if (type === 'week') {
    const { start, end } = getWeekRange();
    filteredVisits = allVisits.filter(v => {
      const d = parseDateTime(v[13]);
      return d && d >= start && d < end;
    });
  } else if (type === 'month') {
    const m = now.getMonth();
    const y = now.getFullYear();
    filteredVisits = allVisits.filter(v => {
      const d = parseDateTime(v[13]);
      return d && d.getMonth() === m && d.getFullYear() === y;
    });
  } else if (type === 'year') {
    const y = now.getFullYear();
    filteredVisits = allVisits.filter(v => {
      const d = parseDateTime(v[13]);
      return d && d.getFullYear() === y;
    });
  } else if (type === 'custom') {
    const f = el('gFrom').value;
    const t = el('gTo').value;
    if (!f || !t) return alert('اختر التاريخين');
    // Compare using date-only ISO strings (UTC) to avoid timezone issues
    filteredVisits = allVisits.filter(v => {
      const d = parseDateTime(v[13]);
      if (!d) return false;
      const dateOnly = toDateOnlyISO(d);
      return dateOnly >= f && dateOnly <= t;
    });
  }
  renderAll();
}

/* -------------------------
   Top summary
   ------------------------- */
function renderTopSummary(list) {
  let totalPaid = 0;
  let priceTotal = 0;
  let cash = 0;
  let card = 0;
  let tips = 0;
  let totalCommission = 0;

  list.forEach(v => {
    const price = Number(v[7] || 0);
    const cashAmount = Number(v[20] || 0);
    const cardAmount = Number(v[21] || 0);
    const total = Number(v[22] || 0);
    const tip = Number(v[23] || 0);
    const commission = Number(v[12] || 0);

    priceTotal += price;
    totalPaid += total;
    cash += cashAmount;
    card += cardAmount;
    tips += tip;
    totalCommission += commission;
  });

  const discount = priceTotal - totalPaid;
  el('sumCash').innerText = fmtCurrency(cash);
  el('sumCard').innerText = fmtCurrency(card);
  el('sumDiscount').innerText = fmtCurrency(discount);
  el('sumNet').innerText = fmtCurrency(totalPaid);
  el('sumTotal').innerText = fmtCurrency(priceTotal);
  el('sumTips').innerText = fmtCurrency(tips);
  el('sumServices').innerText = fmtNumber(list.length);
  el('sumCommission').innerText = fmtCurrency(totalCommission);
}

/* -------------------------
   Employees summary
   ------------------------- */
function renderEmployeesSummary(list) {
  const box = el('tab-employees');
  const emp = {};
  let totalAfterDiscount = 0;
  let totalDiscount = 0;
  let totalTips = 0;
  let totalCommission = 0;

  list.forEach(v => {
    const employee = safeText(v[9]) || 'غير محدد';
    const price = Number(v[22] || v[7] || 0);
    const tip = Number(v[25] || 0);
    const discount = Number(v[26] || 0);
    const commission = Number(v[12] || 0);

    if (!emp[employee]) emp[employee] = { cars: 0, total: 0, commission: 0 };
    emp[employee].cars++;
    emp[employee].total += price;
    emp[employee].commission += commission;

    totalAfterDiscount += price;
    totalDiscount += discount;
    totalTips += tip;
    totalCommission += commission;
  });

  const sorted = Object.entries(emp).sort((a, b) => b[1].total - a[1].total);

  // Build table safely
  const frag = document.createDocumentFragment();
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>الموظف</th><th>الخدمات</th><th>الإجمالي</th><th>العمولات</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');

  sorted.forEach(([name, data]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(name)}</td><td>${fmtNumber(data.cars)}</td><td>${fmtCurrency(data.total)}</td><td>${fmtCurrency(data.commission)}</td>`;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  frag.appendChild(table);

  const totalsDiv = document.createElement('div');
  totalsDiv.className = 'table-total';
  totalsDiv.innerHTML = `<b>الإجمالي: ${fmtCurrency(totalAfterDiscount)}</b><br><b>العمولات: ${fmtCurrency(totalCommission)}</b>`;
  frag.appendChild(totalsDiv);

  box.innerHTML = '';
  box.appendChild(frag);
}

/* -------------------------
   Services summary + PDF export
   ------------------------- */
function renderServicesSummary(list) {
  const box = el('tab-services');
  const svc = {};
  let total = 0;

  list.forEach(v => {
    const s = safeText(v[6]) || 'غير محدد';
    const price = Number(v[22] || v[7] || 0);
    const method = safeText(v[16]);

    if (!svc[s]) svc[s] = { count: 0, cash: 0, card: 0, total: 0 };
    svc[s].count++;
    svc[s].total += price;
    total += price;
    if (method === 'كاش') svc[s].cash += price;
    if (method === 'شبكة') svc[s].card += price;
  });

  const frag = document.createDocumentFragment();

  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn-export';
  exportBtn.id = 'exportServicesPDF';
  exportBtn.style.marginBottom = '15px';
  exportBtn.textContent = 'تصدير PDF';
  frag.appendChild(exportBtn);

  const table = document.createElement('table');
  table.id = 'servicesTable';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>الخدمة</th><th>العدد</th><th>الكاش</th><th>الشبكة</th><th>الإجمالي</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');

  Object.keys(svc).forEach(s => {
    const r = svc[s];
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(s)}</td><td>${fmtNumber(r.count)}</td><td>${fmtCurrency(r.cash)}</td><td>${fmtCurrency(r.card)}</td><td>${fmtCurrency(r.total)}</td>`;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  frag.appendChild(table);

  const totalDiv = document.createElement('div');
  totalDiv.className = 'table-total';
  totalDiv.innerHTML = `<b>الإجمالي: ${fmtCurrency(total)}</b>`;
  frag.appendChild(totalDiv);

  box.innerHTML = '';
  box.appendChild(frag);

  // Attach export handler
  el('exportServicesPDF').onclick = exportServicesPDF;
}

/* -------------------------
   Export Services PDF
   ------------------------- */
function exportServicesPDF() {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const table = document.querySelector('#servicesTable');
    if (!table) return alert('لا توجد بيانات للتصدير');

    // Extract headers and rows reliably
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText);
    const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
      Array.from(tr.querySelectorAll('td')).map(td => td.innerText)
    );

    doc.autoTable({
      head: [headers],
      body: rows,
      styles: { fontSize: 10, cellPadding: 5 },
      headStyles: { fillColor: [13, 71, 161] },
      margin: { top: 40 }
    });

    doc.save('services-summary.pdf');
  } catch (err) {
    console.error('exportServicesPDF error', err);
    alert('حدث خطأ أثناء التصدير');
  }
}

/* -------------------------
   Completed visits
   ------------------------- */
function renderCompletedVisits(list) {
  const box = el('completedContent');
  const totalBox = el('completedTotal');
  const paid = list.filter(v => safeText(v[15]) === 'مدفوع');

  if (!paid.length) {
    box.innerHTML = 'لا توجد نتائج';
    totalBox.innerHTML = '';
    return;
  }

  let totalNet = 0;
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>اللوحة</th><th>الخدمة</th><th>السعر</th><th>الخصم</th><th>الصافي</th><th>الدفع</th><th>الموظف</th><th>الدخول</th><th>الخروج</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');

  paid.forEach(v => {
    const price = Number(v[7] || 0);
    const discount = Number(v[26] || 0);
    const net = price - discount;
    const method = safeText(v[16]);
    const employee = safeText(v[9]);
    totalNet += net;

    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(safeText(v[1]))} ${escapeHtml(safeText(v[2]))}</td>
                    <td>${escapeHtml(safeText(v[6]))}</td>
                    <td>${fmtCurrency(price)}</td>
                    <td>${fmtCurrency(discount)}</td>
                    <td>${fmtCurrency(net)}</td>
                    <td>${escapeHtml(method)}</td>
                    <td>${escapeHtml(employee)}</td>
                    <td>${escapeHtml(safeText(v[13]))}</td>
                    <td>${escapeHtml(safeText(v[14]))}</td>`;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  box.innerHTML = '';
  box.appendChild(table);
  totalBox.innerHTML = `<b>الإجمالي الصافي: ${fmtCurrency(totalNet)}</b>`;
}

/* -------------------------
   Invoices summary
   ------------------------- */
function renderInvoicesSummary(list) {
  const box = el('tab-invoices');
  const mem = {};
  let total = 0;

  list.forEach(v => {
    const m = safeText(v[0]) || 'بدون عضوية';
    const price = Number(v[22] || v[7] || 0);
    if (!mem[m]) mem[m] = { visits: 0, total: 0 };
    mem[m].visits++;
    mem[m].total += price;
    total += price;
  });

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>العضوية</th><th>الزيارات</th><th>الإجمالي</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');

  Object.keys(mem).forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(m)}</td><td>${fmtNumber(mem[m].visits)}</td><td>${fmtCurrency(mem[m].total)}</td>`;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  const totalDiv = document.createElement('div');
  totalDiv.className = 'table-total';
  totalDiv.innerHTML = `<b>الإجمالي: ${fmtCurrency(total)}</b>`;

  box.innerHTML = '';
  box.appendChild(table);
  box.appendChild(totalDiv);
}

/* -------------------------
   Completed tab filters (local)
   ------------------------- */
function bindCompletedFilter() {
  // Today: 12:00 -> next day 06:00
  el('filterToday').onclick = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 6, 0, 0);
    renderCompletedVisits(filteredVisits.filter(v => {
      const d = parseDateTime(v[13]);
      return d && d >= start && d <= end;
    }));
  };

  el('filterWeek').onclick = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    const start = new Date(now);
    start.setDate(now.getDate() + diff);
    renderCompletedVisits(filteredVisits.filter(v => {
      const d = parseDateTime(v[13]);
      return d && d >= start && d <= now;
    }));
  };

  el('filterMonth').onclick = () => {
    const now = new Date();
    renderCompletedVisits(filteredVisits.filter(v => {
      const d = parseDateTime(v[13]);
      return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }));
  };

  el('filterYear').onclick = () => {
    const y = new Date().getFullYear();
    renderCompletedVisits(filteredVisits.filter(v => {
      const d = parseDateTime(v[13]);
      return d && d.getFullYear() === y;
    }));
  };

  el('filterCustom').onclick = () => {
    const f = el('filterFrom').value;
    const t = el('filterTo').value;
    if (!f || !t) return alert('اختر التاريخين');
    renderCompletedVisits(filteredVisits.filter(v => {
      const d = parseDateTime(v[13]);
      if (!d) return false;
      const dateOnly = toDateOnlyISO(d);
      return dateOnly >= f && dateOnly <= t;
    }));
  };
}

/* -------------------------
   Export filtered table to CSV
   ------------------------- */
function bindExport() {
  el('exportExcel').onclick = () => {
    const table = document.querySelector('#completedContent table');
    if (!table) return alert('لا توجد بيانات للتصدير');

    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length <= 1) return alert('لا توجد بيانات للتصدير');

    // Build CSV with proper escaping
    const csvLines = [];
    rows.forEach(row => {
      const cols = Array.from(row.querySelectorAll('th, td')).map(td => td.innerText.replace(/"/g, '""'));
      csvLines.push('"' + cols.join('","') + '"');
    });

    const csv = '\uFEFF' + csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filtered_visits.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
}

/* -------------------------
   Helpers
   ------------------------- */
function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const lastWed = new Date(now);
  const diff = day >= 3 ? day - 3 : (7 - (3 - day));
  lastWed.setDate(now.getDate() - diff);
  const nextWed = new Date(lastWed);
  nextWed.setDate(lastWed.getDate() + 7);
  return { start: lastWed, end: nextWed };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
