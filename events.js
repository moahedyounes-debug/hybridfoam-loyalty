/* ===========================
   Event Delegation (دفع + تعديل)
=========================== */
document.addEventListener("click", e => {

    /* ===========================
       1) إغلاق أي قائمة مفتوحة عند الضغط خارجها
    ============================ */
    if (!e.target.closest(".dropdown")) {
        document.querySelectorAll(".dropdown-content").forEach(menu => {
            menu.style.display = "none";
        });
    }

    /* ===========================
       2) فتح قائمة التعديل أو الدفع
    ============================ */
    if (e.target.classList.contains("edit-btn") || e.target.classList.contains("btn-pay")) {
        const dropdown = e.target.nextElementSibling;

        // إغلاق كل القوائم الأخرى
        document.querySelectorAll(".dropdown-content").forEach(menu => {
            if (menu !== dropdown) menu.style.display = "none";
        });

        // تبديل القائمة الحالية
        dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
        return;
    }

    /* ===========================
       3) قائمة الدفع
    ============================ */
    if (e.target.matches(".pay-menu a")) {
        e.preventDefault();

        const plate  = e.target.parentElement.dataset.plate;
        const method = e.target.dataset.method;

        selectedPlate = plate;

        // فتح مودال الدفع
        openPaymentModal(plate);

        // تعبئة طريقة الدفع داخل المودال
        el("modal_method_select").value = method;

        // إغلاق القائمة
        e.target.parentElement.style.display = "none";
        return;
    }

    /* ===========================
       4) قائمة التعديل
    ============================ */
    if (e.target.matches(".edit-menu a")) {
        e.preventDefault();

        const plate  = e.target.parentElement.dataset.plate;
        const action = e.target.dataset.action;

        selectedPlate = plate;

        openEditModal(action);

        // إغلاق القائمة
        e.target.parentElement.style.display = "none";
        return;
    }
});
