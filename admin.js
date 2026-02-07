/* -----------------------------------------
   API
----------------------------------------- */
const API = "https://script.google.com/macros/s/AKfycby6gaUcMNIorB6oTmLfRA7La90frLUF6NchZ4Xm_i9SFLv6QMEB8Dtwo812S5Nnib4C_g/exec";

/* -----------------------------------------
   تحميل البيانات
----------------------------------------- */
let customers = [];
let visits = [];

async function loadData() {
    try {
        // جلب العملاء
        const c = await fetch(API + "?action=getAll").then(r => r.json());
        if (c.success) customers = c.data;

        // جلب كل الزيارات
        const v = await fetch(API + "?action=getAllVisits").then(r => r.json());
        if (v.success) visits = v.data;

        updateOverview();
        updateCharts();
        updateLastVisits();

        document.getElementById("lastUpdate").innerText =
            "آخر تحديث: " + new Date().toLocaleTimeString("ar-SA");

    } catch (err) {
        console.error("خطأ في تحميل البيانات:", err);
    }
}

loadData();
setInterval(loadData, 60000);

/* -----------------------------------------
   نظرة عامة
----------------------------------------- */
function updateOverview() {
    const totalCustomers = customers.length;
    const totalVisits = visits.length;
    const totalPaid = visits.reduce((s, v) => s + Number(v.price || 0), 0);

    const vip = customers.filter(c => c.level === "VIP").length;
    const gold = customers.filter(c => c.level === "Gold").length;
    const silver = customers.filter(c => c.level === "Silver").length;
    const bronze = customers.filter(c => c.level === "Bronze").length;
    const none = customers.filter(c => !c.level || c.level === "-").length;

    document.getElementById("card_customers").innerText = totalCustomers;
    document.getElementById("card_visits").innerText = totalVisits;
    document.getElementById("card_totalPaid").innerText = totalPaid + " ريال";

    document.getElementById("card_vip").innerText = vip;
    document.getElementById("card_gold").innerText = gold;
    document.getElementById("card_silver").innerText = silver;
    document.getElementById("card_bronze").innerText = bronze;
    document.getElementById("card_none").innerText = none;

    document.getElementById("card_vip_ratio").innerText = percent(vip, totalCustomers);
    document.getElementById("card_gold_ratio").innerText = percent(gold, totalCustomers);
    document.getElementById("card_silver_ratio").innerText = percent(silver, totalCustomers);
    document.getElementById("card_bronze_ratio").innerText = percent(bronze, totalCustomers);
    document.getElementById("card_none_ratio").innerText = percent(none, totalCustomers);
}

function percent(v, total) {
    if (total === 0) return "0%";
    return ((v / total) * 100).toFixed(1) + "%";
}

/* -----------------------------------------
   الرسوم البيانية
----------------------------------------- */
let chart1, chart2, chart3, chart4;

function updateCharts() {
    if (chart1) chart1.destroy();
    if (chart2) chart2.destroy();
    if (chart3) chart3.destroy();
    if (chart4) chart4.destroy();

    /* الخدمات */
    const serviceCount = {};
    visits.forEach(v => {
        if (!serviceCount[v.service]) serviceCount[v.service] = 0;
        serviceCount[v.service]++;
    });

    chart1 = new Chart(document.getElementById("chartServices"), {
        type: "bar",
        data: {
            labels: Object.keys(serviceCount),
            datasets: [{
                label: "عدد المرات",
                data: Object.values(serviceCount),
                backgroundColor: "#d4af37"
            }]
        }
    });

    /* السيارات */
    const carCount = {};
    customers.forEach(c => {
        if (!carCount[c.car]) carCount[c.car] = 0;
        carCount[c.car]++;
    });

    chart2 = new Chart(document.getElementById("chartCars"), {
        type: "pie",
        data: {
            labels: Object.keys(carCount),
            datasets: [{
                data: Object.values(carCount),
                backgroundColor: ["#d4af37", "#b8962f", "#8a6f1f", "#6b5518"]
            }]
        }
    });

    /* الزيارات اليومية */
    const daily = {};
    visits.forEach(v => {
        const d = String(v.date).split("T")[0];
        if (!daily[d]) daily[d] = 0;
        daily[d]++;
    });

    chart3 = new Chart(document.getElementById("chartVisitsDaily"), {
        type: "line",
        data: {
            labels: Object.keys(daily),
            datasets: [{
                label: "زيارات",
                data: Object.values(daily),
                borderColor: "#d4af37"
            }]
        }
    });

    /* الإيرادات اليومية */
    const revenue = {};
    visits.forEach(v => {
        const d = String(v.date).split("T")[0];
        if (!revenue[d]) revenue[d] = 0;
        revenue[d] += Number(v.price || 0);
    });

    chart4 = new Chart(document.getElementById("chartRevenueDaily"), {
        type: "line",
        data: {
            labels: Object.keys(revenue),
            datasets: [{
                label: "ريال",
                data: Object.values(revenue),
                borderColor: "#d4af37"
            }]
        }
    });
}

/* -----------------------------------------
   آخر 20 زيارة
----------------------------------------- */
function updateLastVisits() {
    const tbody = document.getElementById("lastVisitsBody");
    tbody.innerHTML = "";

    visits.slice(-20).reverse().forEach(v => {
        const c = customers.find(x => x.membership == v.membership);

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${c ? c.name : "-"}</td>
            <td>${v.membership}</td>
            <td>${v.service}</td>
            <td>${v.price}</td>
            <td>${v.points}</td>
            <td>${String(v.date).split("T")[0]}</td>
        `;
        tbody.appendChild(tr);
    });
}

/* -----------------------------------------
   عمليات العميل
----------------------------------------- */
async function loadCustomerOperations() {
    const phone = document.getElementById("opsPhone").value.trim();
    if (!phone) return;

    const res = await fetch(API + "?action=getByPhone&phone=" + phone).then(r => r.json());

    const tbody = document.getElementById("opsTableBody");
    tbody.innerHTML = "";

    if (!res.success) {
        document.getElementById("opsSummary").innerText = "العميل غير موجود";
        return;
    }

    const customer = res.customer;

    // جلب زيارات العضوية
    const v = await fetch(API + "?action=getVisits&membership=" + customer.membership).then(r => r.json());

    let total = 0;
    let points = Number(customer.points || 0);

    if (v.success) {
        v.data.forEach(vis => {
            total += Number(vis.price || 0);

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${String(vis.date).split("T")[0]}</td>
                <td>${vis.service}</td>
                <td>${vis.price}</td>
                <td>${vis.points}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById("opsSummary").innerText =
        `إجمالي المبلغ: ${total} ريال — إجمالي النقاط: ${points}`;
}

/* -----------------------------------------
   تقرير حسب التاريخ
----------------------------------------- */
function filterByDate() {
    const f = document.getElementById("fromDate").value;
    const t = document.getElementById("toDate").value;

    if (!f || !t) return;

    const list = visits.filter(v => {
        const d = String(v.date).split("T")[0];
        return d >= f && d <= t;
    });

    document.getElementById("date_visits").innerText =
        "عدد الزيارات: " + list.length;

    document.getElementById("date_totalPaid").innerText =
        "إجمالي المبالغ: " + list.reduce((s, v) => s + Number(v.price || 0), 0) + " ريال";

    const serviceCount = {};
    list.forEach(v => {
        if (!serviceCount[v.service]) serviceCount[v.service] = 0;
        serviceCount[v.service]++;
    });

    const topService = Object.entries(serviceCount).sort((a, b) => b[1] - a[1])[0];
    document.getElementById("date_topService").innerText =
        "أكثر خدمة: " + (topService ? topService[0] : "-");

    const carCount = {};
    list.forEach(v => {
        const c = customers.find(x => x.membership == v.membership);
        if (!c) return;
        if (!carCount[c.car]) carCount[c.car] = 0;
        carCount[c.car]++;
    });

    const topCar = Object.entries(carCount).sort((a, b) => b[1] - a[1])[0];
    document.getElementById("date_topCar").innerText =
        "أكثر سيارة: " + (topCar ? topCar[0] : "-");
}

/* -----------------------------------------
   أزرار التحكم
----------------------------------------- */
function openVisitPage() {
    window.location.href = "add-visit.html";
}

function manualRefresh() {
    loadData();
}

function logout() {
    sessionStorage.clear();
    window.location.href = "index.html";
}

/* -----------------------------------------
   الثيم
----------------------------------------- */
function toggleTheme() {
    document.body.classList.toggle("light");
}
