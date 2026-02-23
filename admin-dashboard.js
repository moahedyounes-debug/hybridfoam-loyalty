// =========================
//  الإعدادات الأساسية
// =========================
const apiUrl = "https://hybridfoam.com/api"; // عدل الرابط لو عندك دومين مختلف

// =========================
//  تبديل التابات
// =========================
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
});

// =========================
//  تحميل ملخص الموظفين
// =========================
async function loadEmployeesSummary() {
    try {
        const res = await fetch(apiUrl + "/visits/completed");
        const data = await res.json();

        const perEmployee = {};

        data.forEach(v => {
            if (!perEmployee[v.employee]) {
                perEmployee[v.employee] = { count: 0, total: 0 };
            }
            perEmployee[v.employee].count++;
            perEmployee[v.employee].total += Number(v.price);
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
                    <td>${perEmployee[emp].count}</td>
                    <td>${perEmployee[emp].total} ريال</td>
                </tr>
            `;
        });

        html += `</table>`;
        document.getElementById("tab-employees").innerHTML = html;

    } catch (err) {
        console.error("Error loading employees summary:", err);
    }
}

// =========================
//  تحميل الزيارات المكتملة
// =========================
async function loadCompletedVisits() {
    try {
        const res = await fetch(apiUrl + "/visits/completed");
        const data = await res.json();

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

        data.forEach(v => {
            html += `
                <tr>
                    <td>${v.plate}</td>
                    <td>${v.service}</td>
                    <td>${v.price}</td>
                    <td>${v.employee}</td>
                    <td>${v.payment}</td>
                    <td>
                        <button class="btn-primary" onclick='openDetails(${JSON.stringify(v)})'>
                            عرض
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `</table>`;
        document.getElementById("tab-completed").innerHTML = html;

    } catch (err) {
        console.error("Error loading completed visits:", err);
    }
}

// =========================
//  تحميل ملخص الخدمات
// =========================
async function loadServicesSummary() {
    try {
        const res = await fetch(apiUrl + "/visits/completed");
        const data = await res.json();

        const perService = {};

        data.forEach(v => {
            if (!perService[v.service]) {
                perService[v.service] = { count: 0, cash: 0, card: 0, total: 0 };
            }

            perService[v.service].count++;
            perService[v.service].total += Number(v.price);

            if (v.payment === "كاش") perService[v.service].cash += Number(v.price);
            else perService[v.service].card += Number(v.price);
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
            html += `
                <tr>
                    <td>${s}</td>
                    <td>${perService[s].count}</td>
                    <td>${perService[s].cash}</td>
                    <td>${perService[s].card}</td>
                    <td>${perService[s].total}</td>
                </tr>
            `;
        });

        html += `</table>`;
        document.getElementById("tab-services").innerHTML = html;

    } catch (err) {
        console.error("Error loading services summary:", err);
    }
}

// =========================
//  مودال التفاصيل
// =========================
function openDetails(v) {
    document.getElementById("detailsBody").innerHTML = `
        <p><b>اللوحة:</b> ${v.plate}</p>
        <p><b>الخدمة:</b> ${v.service}</p>
        <p><b>السعر:</b> ${v.price} ريال</p>
        <p><b>الموظف:</b> ${v.employee}</p>
        <p><b>طريقة الدفع:</b> ${v.payment}</p>
        <p><b>وقت الدخول:</b> ${v.start_time}</p>
        <p><b>وقت الخروج:</b> ${v.end_time}</p>
    `;
    document.getElementById("detailsModal").style.display = "flex";
}

document.getElementById("closeModal").onclick = () => {
    document.getElementById("detailsModal").style.display = "none";
};

// =========================
//  تشغيل كل شيء عند فتح الصفحة
// =========================
window.onload = () => {
    loadEmployeesSummary();
    loadCompletedVisits();
    loadServicesSummary();
};
