// =========================
//  Helpers
// =========================
const el = id => document.getElementById(id);

// =========================
//  Tabs switching
// =========================
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    el("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// =========================
//  Top summary (Visits)
// =========================
async function loadTopSummary() {
  try {
    const res = await apiGetAll("Visits");
    if (!res || !res.rows) return;

    let cash = 0;
    let card = 0;
    let total = 0;
    let servicesCount = 0;

    res.rows.forEach(v => {
      const price = Number(v[22] || v[7] || 0);      // TOTAL_PAID أو السعر
      const method = String(v[16] || "").trim();     // payment_method
      total += price;
      servicesCount++;

      if (method === "كاش") cash += price;
      if (method === "شبكة") card += price;
    });

    el("sumCash").innerText = cash + " ريال";
    el("sumCard").innerText = card + " ريال";
    el("sumTotal").innerText = total + " ريال";
    el("sumServices").innerText = servicesCount;
  } catch (err) {
    console.error("Error loading top summary:", err);
  }
}

// =========================
//  Employees summary tab
// =========================
async function loadEmployeesSummary() {
  const box = el("tab-employees");
  box.innerHTML = "جارِ التحميل...";

  try {
    const res = await apiGetAll("Visits");
    if (!res || !res.rows || !res.rows.length) {
      box.innerHTML = "<p>لا توجد بيانات زيارات.</p>";
      return;
    }

    const perEmployee = {};

    res.rows.forEach(v => {
      const emp = String(v[9] || "غير محدد");          // employee_in
      const price = Number(v[22] || v[7] || 0);         // TOTAL_PAID أو السعر
      if (!perEmployee[emp]) perEmployee[emp] = { cars: 0, total: 0 };
      perEmployee[emp].cars++;
      perEmployee[emp].total += price;
    });

    let html = `
      <table>
        <tr>
          <th>الموظف</th>
          <th>عدد السيارات</th>
          <th>إجمالي المبلغ</th>
        </tr>
    `;

    Object.keys(perEmployee).forEach(emp => {
      html += `
        <tr>
          <td>${emp}</td>
          <td>${perEmployee[emp].cars}</td>
          <td>${perEmployee[emp].total} ريال</td>
        </tr>
      `;
    });

    html += `</table>`;
    box.innerHTML = html;
  } catch (err) {
    console.error("Error loading employees summary:", err);
    box.innerHTML = "<p>خطأ في تحميل ملخص الموظفين.</p>";
  }
}

// =========================
//  Completed visits tab
// =========================
async function loadCompletedVisits() {
  const box = el("tab-completed");
  box.innerHTML = "جارِ التحميل...";

  try {
    const res = await apiGetAll("Visits");
    if (!res || !res.rows || !res.rows.length) {
      box.innerHTML = "<p>لا توجد زيارات.</p>";
      return;
    }

    const paid = res.rows.filter(v => String(v[15] || "").trim() === "مدفوع"); // payment_status

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
      const plate = `${v[1] || ""} ${v[2] || ""}`;   // أرقام + حروف
      const service = v[6] || "";                    // service_detail
      const price = Number(v[22] || v[7] || 0);
      const emp = v[9] || "غير محدد";
      const method = v[16] || "—";

      const visitObj = {
        plate,
        service,
        price,
        employee: emp,
        payment: method,
        check_in: v[13] || "",
        check_out: v[14] || ""
      };

      html += `
        <tr>
          <td>${plate}</td>
          <td>${service}</td>
          <td>${price}</td>
          <td>${emp}</td>
          <td>${method}</td>
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
    box.innerHTML = "<p>خطأ في تحميل الزيارات المكتملة.</p>";
  }
}

// =========================
//  Services summary tab
// =========================
async function loadServicesSummary() {
  const box = el("tab-services");
  box.innerHTML = "جارِ التحميل...";

  try {
    const res = await apiGetAll("Visits");
    if (!res || !res.rows || !res.rows.length) {
      box.innerHTML = "<p>لا توجد بيانات زيارات.</p>";
      return;
    }

    const perService = {};

    res.rows.forEach(v => {
      const service = String(v[6] || "غير محدد");      // service_detail
      const price = Number(v[22] || v[7] || 0);
      const method = String(v[16] || "").trim();

      if (!perService[service]) {
        perService[service] = { count: 0, cash: 0, card: 0, total: 0 };
      }

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
    box.innerHTML = "<p>خطأ في تحميل ملخص الخدمات.</p>";
  }
}

// =========================
//  Bookings tab
// =========================
async function loadBookings() {
  const box = el("tab-bookings");
  box.innerHTML = "جارِ التحميل...";

  try {
    const res = await apiGetAll("Bookings");
    if (!res || !res.rows || !res.rows.length) {
      box.innerHTML = "<p>لا توجد حجوزات حالياً.</p>";
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
      const phone = b[0];
      const mem = b[1];
      const service = b[2];
      const date = b[3];
      const time = b[4];
      const status = b[5];

      html += `
        <tr>
          <td>${service}</td>
          <td>${date || ""} ${time || ""}</td>
          <td>${phone}</td>
          <td>${mem || "—"}</td>
          <td>${status}</td>
        </tr>
      `;
    });

    html += `</table>`;
    box.innerHTML = html;
  } catch (err) {
    console.error("Error loading bookings:", err);
    box.innerHTML = "<p>خطأ في تحميل الحجوزات.</p>";
  }
}

// =========================
//  Notifications tab (placeholder)
// =========================
async function loadNotifications() {
  const box = el("tab-notifications");
  box.innerHTML = `
    <p>عرض الإشعارات العامة من لوحة المشرف غير مفعّل حالياً.</p>
    <p>يمكنك استخدام نظام الإشعارات من واجهات أخرى (العملاء / الموظفين).</p>
  `;
}

// =========================
//  Invoices tab (simple summary)
// =========================
async function loadInvoices() {
  const box = el("tab-invoices");
  box.innerHTML = "جارِ التحميل...";

  try {
    const res = await apiGetAll("Visits");
    if (!res || !res.rows || !res.rows.length) {
      box.innerHTML = "<p>لا توجد زيارات لعرض الفواتير.</p>";
      return;
    }

    const perMember = {};

    res.rows.forEach(v => {
      const mem = v[0] || "بدون عضوية";          // membership
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
    console.error("Error loading invoices summary:", err);
    box.innerHTML = "<p>خطأ في تحميل الفواتير.</p>";
  }
}

// =========================
//  Details modal
// =========================
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

// أزرار التحميل (مكانها جاهز لو حبيت تفعلها لاحقاً)
el("downloadCSV").onclick = () => {
  alert("تحميل CSV غير مفعّل حالياً.");
};
el("downloadPDF").onclick = () => {
  alert("تحميل PDF غير مفعّل حالياً.");
};

// =========================
//  Init
// =========================
document.addEventListener("DOMContentLoaded", () => {
  loadTopSummary();
  loadEmployeesSummary();
  loadCompletedVisits();
  loadServicesSummary();
  loadBookings();
  loadNotifications();
  loadInvoices();
});
