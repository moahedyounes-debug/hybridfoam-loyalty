/* ===========================
   Helpers
=========================== */
const el = id => document.getElementById(id);

/* ===========================
   Tabs switching
=========================== */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    el("tab-" + btn.dataset.tab).classList.add("active");
  });
});

/* ===========================
   Top Summary
=========================== */
async function loadTopSummary() {
  try {
    const res = await apiGetAll("Visits");
    if (!res.success || !res.rows) return;

    let cash = 0, card = 0, total = 0, services = 0;

    res.rows.forEach(v => {
      const price = Number(v[22] || v[7] || 0);
      const method = String(v[16] || "").trim();

      total += price;
      services++;

      if (method === "كاش") cash += price;
      if (method === "شبكة") card += price;
    });

    el("sumCash").innerText = cash + " ريال";
    el("sumCard").innerText = card + " ريال";
    el("sumTotal").innerText = total + " ريال";
    el("sumServices").innerText = services;

  } catch (err) {
    console.error("Error loading top summary:", err);
  }
}

/* ===========================
   Employees Summary
=========================== */
async function loadEmployeesSummary() {
  const box = el("tab-employees");
  box.innerHTML = "جارِ التحميل...";

  try {
    const res = await apiGetAll("Visits");
    if (!res.success || !res.rows.length) {
      box.innerHTML = "<p>لا توجد بيانات.</p>";
      return;
    }

    const perEmp = {};

    res.rows.forEach(v => {
      const emp = v[9] || "غير محدد";
      const price = Number(v[22] || v[7] || 0);

      if (!perEmp[emp]) perEmp[emp] = { cars: 0, total: 0 };
      perEmp[emp].cars++;
      perEmp[emp].total += price;
    });

    let html = `
      <table>
        <tr>
          <th>الموظف</th>
          <th>عدد السيارات</th>
          <th>إجمالي المبلغ</th>
        </tr>
    `;

    Object.keys(perEmp).forEach(emp => {
      html += `
        <tr>
          <td>${emp}</td>
          <td>${perEmp[emp].cars}</td>
          <td>${perEmp[emp].total} ريال</td>
        </tr>
      `;
    });

    html += `</table>`;
    box.innerHTML = html;

  } catch (err) {
    console.error("Error loading employees summary:", err);
    box.innerHTML = "<p>خطأ في تحميل البيانات.</p>";
  }
}

/* ===========================
   Completed Visits
=========================== */
async function loadCompletedVisits() {
  const box = el("tab-completed");
  box.innerHTML = "جارِ التحميل...";

  try {
    const res = await apiGetAll("Visits");
    if (!res.success || !res.rows.length) {
      box.innerHTML = "<p>لا توجد زيارات.</p>";
      return;
    }

    const paid = res.rows.filter(v => String(v[15] || "").trim() === "مدفوع");

    if (!paid.length) {
      box.innerHTML = "<p>لا توجد زيارات مكتملة.</p>";
      return;
    }

    let html = `
      <table>
        <tr>
          <th>اللوحة</th>
          <th>الخدمة</th>
          <th>السعر</th>
          <th>الموظف</th>
          <th>طريقة الدفع</th>
          <th>تفاصيل</th>
        </tr>
    `;

    paid.forEach(v => {
      const visitObj = {
        plate: `${v[1] || ""} ${v[2] || ""}`,
        service: v[6] || "",
        price: Number(v[22] || v[7] || 0),
        employee: v[9] || "غير محدد",
        payment: v[16] || "—",
        check_in: v[13] || "",
        check_out: v[14] || ""
      };

      html += `
        <tr>
          <td>${visitObj.plate}</td>
          <td>${visitObj.service}</td>
          <td>${visitObj.price}</td>
          <td>${visitObj.employee}</td>
          <td>${visitObj.payment}</td>
          <td>
            <button class="btn-primary" onclick='openDetails(${JSON.stringify(visitObj)})'>
              عرض
            </button>
          </td>
        </tr>
      `;
    });

    html += `</table>`;
    box.innerHTML = html;

  } catch (err) {
    console.error("Error loading completed visits:", err);
    box.innerHTML = "<p>خطأ في تحميل البيانات.</p>";
  }
}

/* ===========================
   Services Summary
=========================== */
async function loadServicesSummary() {
  const box = el("tab-services");
  box.innerHTML = "جارِ التحميل...";

  try {
    const res = await apiGetAll("Visits");
    if (!res.success || !res.rows.length) {
      box.innerHTML = "<p>لا توجد بيانات.</p>";
      return;
    }

    const perService = {};

    res.rows.forEach(v => {
      const service = v[6] || "غير محدد";
      const price = Number(v[22] || v[7] || 0);
      const method = v[16] || "";

      if (!perService[service]) perService[service] = { count: 0, cash: 0, card: 0, total: 0 };

      perService[service].count++;
      perService[service].total += price;

      if (method === "كاش") perService[service].cash += price;
      if (method === "شبكة") perService[service].card += price;
    });

    let html = `
      <table>
        <tr>
          <th>الخدمة</th>
          <th>العدد</th>
          <th>الكاش</th>
          <th>الشبكة</th>
          <th>الإجمالي</th>
        </tr>
    `;

    Object.keys(perService).forEach(s => {
      const row = perService[s];
      html += `
        <tr>
          <td>${s}</td>
          <td>${row.count}</td>
          <td>${row.cash}</td>
          <td>${row.card}</td>
          <td>${row.total}</td>
        </tr>
      `;
    });

    html += `</table>`;
    box.innerHTML = html;

  } catch (err) {
    console.error("Error loading services summary:", err);
    box.innerHTML = "<p>خطأ في تحميل البيانات.</p>";
  }
}

/* ===========================
   Bookings
=========================== */
async function loadBookings() {
  const box = el("tab-bookings");
  box.innerHTML = "جارِ التحميل...";

  try {
    const res = await apiGetAll("Bookings");
    if (!res.success || !res.rows.length) {
      box.innerHTML = "<p>لا توجد حجوزات.</p>";
      return;
    }

    let html = `
      <table>
        <tr>
          <th>الخدمة</th>
          <th>التاريخ</th>
          <th>الجوال</th>
          <th>العضوية</th>
          <th>الحالة</th>
        </tr>
    `;

    res.rows.forEach(b => {
      html += `
        <tr>
          <td>${b[2]}</td>
          <td>${b[3]} ${b[4]}</td>
          <td>${b[0]}</td>
          <td>${b[1] || "—"}</td>
          <td>${b[5]}</td>
        </tr>
      `;
    });

    html += `</table>`;
    box.innerHTML = html;

  } catch (err) {
    console.error("Error loading bookings:", err);
    box.innerHTML = "<p>خطأ في تحميل البيانات.</p>";
  }
}

/* ===========================
   Notifications
=========================== */
async function loadNotifications() {
  el("tab-notifications").innerHTML = `
    <p>عرض الإشعارات من لوحة المشرف غير مفعّل حالياً.</p>
  `;
}

/* ===========================
   Invoices Summary
=========================== */
async function loadInvoices() {
  const box = el("tab-invoices");
  box.innerHTML = "جارِ التحميل...";

  try {
    const res = await apiGetAll("Visits");
    if (!res.success || !res.rows.length) {
      box.innerHTML = "<p>لا توجد بيانات.</p>";
      return;
    }

    const perMember = {};

    res.rows.forEach(v => {
      const mem = v[0] || "بدون عضوية";
      const price = Number(v[22] || v[7] || 0);

      if (!perMember[mem]) perMember[mem] = { visits: 0, total: 0 };
      perMember[mem].visits++;
      perMember[mem].total += price;
    });

    let html = `
      <table>
        <tr>
          <th>العضوية</th>
          <th>عدد الزيارات</th>
          <th>إجمالي المبلغ</th>
        </tr>
    `;

    Object.keys(perMember).forEach(mem => {
      html += `
        <tr>
          <td>${mem}</td>
          <td>${perMember[mem].visits}</td>
          <td>${perMember[mem].total} ريال</td>
        </tr>
      `;
    });

    html += `</table>`;
    box.innerHTML = html;

  } catch (err) {
    console.error("Error loading invoices:", err);
    box.innerHTML = "<p>خطأ في تحميل البيانات.</p>";
  }
}

/* ===========================
   Details Modal
=========================== */
function openDetails(v) {
  el("detailsBody").innerHTML = `
    <p><b>اللوحة:</b> ${v.plate}</p>
    <p><b>الخدمة:</b> ${v.service}</p>
    <p><b>السعر:</b> ${v.price} ريال</p>
    <p><b>الموظف:</b> ${v.employee}</p>
    <p><b>طريقة الدفع:</b> ${v.payment}</p>
    <p><b>وقت الدخول:</b> ${v.check_in || "—"}</p>
    <p><b>وقت الخروج:</b> ${v.check_out || "—"}</p>
  `;
  el("detailsModal").style.display = "flex";
}

el("closeModal").onclick = () => {
  el("detailsModal").style.display = "none";
};

el("downloadCSV").onclick = () => alert("تحميل CSV غير مفعّل حالياً.");
el("downloadPDF").onclick = () => alert("تحميل PDF غير مفعّل حالياً.");

/* ===========================
   Init
=========================== */
document.addEventListener("DOMContentLoaded", () => {
  loadTopSummary();
  loadEmployeesSummary();
  loadCompletedVisits();
  loadServicesSummary();
  loadBookings();
  loadNotifications();
  loadInvoices();
});
