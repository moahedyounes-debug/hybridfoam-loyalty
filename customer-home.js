// =====================================================
// حماية الصفحة – تحقق من وجود رقم + تحقق من وجوده في الشيت
// =====================================================
async function protectPage() {
    const phone = localStorage.getItem("phone");

    // لو ما فيه رقم جوال → رجّعه للتسجيل
    if (!phone) {
        window.location.href = "full-register.html";
        return;
    }

    // تحقق من وجود العميل في Google Sheet
    const res = await apiGet({
        action: "getByPhone",
        phone
    });

    // لو العميل غير موجود في الشيت → رجّعه للتسجيل
    if (!res.success || !res.customer) {
        window.location.href = "full-register.html";
        return;
    }

    // لو كل شيء تمام → كمل تحميل الصفحة
    loadCustomer(res);
    loadNotifications();
}

// =====================================================
// دوال التنقل
// =====================================================
function goTo(page) {
    window.location.href = page;
}

function logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "login.html";
}

// =====================================================
// تحميل بيانات العميل
// =====================================================
function loadCustomer(res) {
    const c = res.customer;

    // الاسم في الهيدر
    document.getElementById("cNameTop").textContent = c.name;

    // مستوى العضوية
    document.getElementById("cLevel").textContent = c.level;

    // النقاط
    document.getElementById("cPoints").textContent = c.points;

    // الولاء
    document.getElementById("loyaltyLevel").textContent = c.level;
    document.getElementById("loyaltyPoints").textContent = c.points;

    // حساب المتبقي للمستوى التالي
    let nextLevelPoints = 0;
    if (c.points < 200) nextLevelPoints = 200 - c.points;
    else if (c.points < 500) nextLevelPoints = 500 - c.points;
    else if (c.points < 1000) nextLevelPoints = 1000 - c.points;
    else if (c.points < 2000) nextLevelPoints = 2000 - c.points;

    document.getElementById("loyaltyRemaining").textContent = nextLevelPoints;

    // شريط التقدم
    let progress = 0;
    if (c.points <= 200) progress = (c.points / 200) * 100;
    else if (c.points <= 500) progress = (c.points / 500) * 100;
    else if (c.points <= 1000) progress = (c.points / 1000) * 100;
    else if (c.points <= 2000) progress = (c.points / 2000) * 100;
    else progress = 100;

    document.getElementById("progressBar").style.width = progress + "%";

    // السيارة
    if (res.cars.length > 0) {
        const car = res.cars[0];
        document.getElementById("carInfo").textContent =
            `${car.car} — ${car.plate_letters} ${car.plate_numbers}`;
        document.getElementById("carMembership").textContent =
            `عضوية: ${car.membership}`;
    }
}

// =====================================================
// تحميل التنبيهات
// =====================================================
async function loadNotifications() {
    const phone = localStorage.getItem("phone");

    const res = await apiGet({
        action: "getNotifications",
        phone
    });

    if (!res.success) return;

    const unread = res.notifications.filter(n => n.read != 1);

    if (unread.length > 0) {
        document.getElementById("notifDot").style.display = "block";
    }
}

// =====================================================
// تشغيل الحماية أولًا
// =====================================================
protectPage();
