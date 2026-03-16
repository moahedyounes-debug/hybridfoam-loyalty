/* =============================
   تنسيق التاريخ (Excel + نص + ISO)
============================= */
function formatDateSmart(value) {
  if (!value) return "";

  if (isNaN(value)) {
    const d = new Date(value);
    if (!isNaN(d)) {
      const month = d.toLocaleString("en-US", { month: "short" });
      const day = String(d.getDate()).padStart(2, "0");
      const year = d.getFullYear();
      return `${month}/${day}/${year}`;
    }
    return value;
  }

  const excelDate = Number(value);
  const jsDate = new Date((excelDate - 25569) * 86400 * 1000);

  const month = jsDate.toLocaleString("en-US", { month: "short" });
  const day = String(jsDate.getDate()).padStart(2, "0");
  const year = jsDate.getFullYear();

  return `${month}/${day}/${year}`;
}

/* =============================
   تنسيق الوقت (Excel + نص)
============================= */
function formatTimeSmart(value) {
  if (!value) return "";

  if (typeof value === "string" && value.includes(":")) {
    return value.slice(0, 5);
  }

  if (!isNaN(value)) {
    const excelTime = Number(value);
    const totalMinutes = Math.round(excelTime * 24 * 60);
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  return value;
}

/* =============================
   تحميل بيانات العميل
============================= */
let CUSTOMER = JSON.parse(localStorage.getItem("customer") || "null");
let PHONE = CUSTOMER ? CUSTOMER.phone : null;

if (!CUSTOMER || !PHONE) {
  window.location.href = "customer-home.html";
}

window.onload = async function () {
  await loadCustomerFromAPI();
  loadCustomerInfoFromLocal();

  await Promise.all([
    loadCars(),
    loadLastVisit(),
    loadBookings()
  ]);

  await loadLevelSystem();
};

async function loadCustomerFromAPI() {
  const res = await apiGetCustomerByPhone(PHONE);
  if (!res.success) return;

  const c = res.customer;

  CUSTOMER = {
    name: c[0],
    phone: c[1],
    membership: c[8],
    city: c[4],
    last_visit: c[9],
    visit_count: c[10],
    points: c[11],
    level: c[12],
    free_wash: c[13]
  };

  localStorage.setItem("customer", JSON.stringify(CUSTOMER));
}

function loadCustomerInfoFromLocal() {
  document.getElementById("name").innerText = CUSTOMER.name;
  document.getElementById("phone").innerText = CUSTOMER.phone;
  document.getElementById("membership").innerText = CUSTOMER.membership;
  document.getElementById("city").innerText = CUSTOMER.city;
  document.getElementById("points").innerText = CUSTOMER.points;
  document.getElementById("freeWash").innerText =
    CUSTOMER.free_wash > 0 ? "متوفر" : "لا يوجد";
}

/* =============================
   قراءة مستويات الترقية من الشيت
============================= */
async function loadLevelSystem() {
  const points = Number(CUSTOMER.points || 0);
  const res = await apiGetLevels();

  if (!res.success) {
    document.getElementById("nextLevelText").innerText = "خطأ في تحميل المستويات";
    return;
  }

  const levels = res.levels.map(r => ({
    level: r[0],
    from: Number(r[1]),
    to: r[2] === "" ? null : Number(r[2])
  }));

  let current = levels.find(l => {
    if (l.to === null) return points >= l.from;
    return points >= l.from && points <= l.to;
  });

  if (!current) {
    document.getElementById("nextLevelText").innerText = "مستوى غير معروف";
    return;
  }

  let progress = 0;
  let nextText = "";

  if (current.to === null) {
    progress = 100;
    nextText = "أنت في أعلى مستوى 🎉";
  } else {
    const range = current.to - current.from;
    progress = ((points - current.from) / range) * 100;
    const remaining = current.to - points;
    nextText = `متبقي ${remaining} نقطة للوصول إلى المستوى التالي`;
  }

  document.getElementById("level").innerText = current.level;
  document.getElementById("progress").style.width =
    Math.min(100, Math.max(0, progress)) + "%";
  document.getElementById("nextLevelText").innerText = nextText;
}

/* =============================
   تحميل سيارات العميل
============================= */
async function loadCars() {
  const box = document.getElementById("carsBox");
  const res = await apiGetCarsByPhone(PHONE);

  if (!res.success) {
    box.innerHTML = "خطأ في قراءة البيانات.";
    return;
  }

  const cars = res.cars.map(c => c.data);

  if (cars.length === 0) {
    box.innerHTML = "لا توجد سيارات مسجلة.";
    return;
  }

  box.classList.remove("empty");

  box.innerHTML = cars.map(c => `
    <div class="car-card">
      <div class="car-img">🚗</div>
      <div class="car-info">
        <div><b>${c[2]}</b></div>
        <div>الحجم: ${c[3]}</div>
        <div>اللوحة: ${c[5]} ${c[4]}</div>
        <div>عضوية السيارة: <span style="color:#0D47A1">${c[0]}</span></div>
      </div>
    </div>
  `).join("");
}

/* =============================
   آخر زيارة
============================= */
async function loadLastVisit() {
  const box = document.getElementById("lastVisitBox");
  const res = await apiGetVisitsByMembership(CUSTOMER.membership);

  if (!res.success || !res.visits.length) {
    box.innerHTML = "لا توجد زيارات.";
    return;
  }

  const last = res.visits[res.visits.length - 1].data;

  box.classList.remove("empty");

  box.innerHTML = `
    <div style="font-size:14px;">
      الخدمة: ${last[1]}<br>
      السعر: ${last[2]} ريال<br>
      النقاط: ${last[3]}<br>
      التاريخ: ${formatDateSmart(last[8])}
    </div>
  `;
}

/* =============================
   الحجوزات
============================= */
async function loadBookings(){
  const box = document.getElementById("bookingsBox");
  const res = await apiGetBookingsByPhone(PHONE);

  if(!res.success || !res.bookings.length){
    box.innerHTML = "لا توجد حجوزات.";
    return;
  }

  // تحويل البيانات
  const bookings = res.bookings.map(b => b.data);

  // ترتيب الحجوزات حسب التاريخ والوقت
  bookings.sort((a, b) => {
    const dateA = new Date(a[3] + " " + a[4]);
    const dateB = new Date(b[3] + " " + b[4]);
    return dateB - dateA; // الأحدث أولاً
  });

  const last = bookings[0];

  const service = last[2];
  const date = formatDateSmart(last[3]);
  const time = formatTimeSmart(last[4]);

  // استخراج اليوم
  const dayName = new Date(last[3]).toLocaleDateString("ar-SA", { weekday: "long" });

  box.classList.remove("empty");

  box.innerHTML = `
    <div style="font-size:14px;margin-bottom:6px;">${bookings.length} حجز</div>

    <div style="font-size:14px;">
      <b>${dayName}</b><br>
      التاريخ: ${date}<br>
      الوقت: ${time}<br>
      الخدمة: ${service}
    </div>
  `;
}

/* =============================
   واتساب
============================= */
async function contactWhatsApp() {
  const phone = CUSTOMER.phone;
  let msg = "مرحباً مغسلة رغوة الهجين%0A";

  const res = await apiGetCustomerByPhone(phone);

  if (!res.success) {
    msg += "رقم الجوال: " + phone;
    window.location.href = "https://wa.me/966582007063?text=" + msg;
    return;
  }

  const c = res.customer;
  const carsRes = await apiGetAll("Cars");
  let carCount = 0;

  if (carsRes.success) {
    carCount = carsRes.rows.filter(r => r[1] === phone).length;
  }

  msg +=
    "الاسم: " + c[0] + "%0A" +
    "رقم العضوية: " + c[8] + "%0A" +
    "عدد السيارات: " + carCount;

  window.location.href = "https://wa.me/966582007063?text=" + msg;
}

/* =============================
   تسجيل خروج
============================= */
function logout() {
  localStorage.removeItem("customer");
  window.location.href = "customer-home.html";
}
