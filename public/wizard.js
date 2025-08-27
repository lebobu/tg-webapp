// public/wizard.js
const tg = window.Telegram?.WebApp;
tg?.expand();

document.addEventListener("DOMContentLoaded", () => {
  const cfg = window.PRICING || {};
  const fmtCfg = cfg.display || {};
  const pricePreview = document.getElementById("pricePreview");

  let currentStep = 1;
  const totalSteps = 3;
  const data = {}; // { plan, accounts, duration }

  const steps = document.querySelectorAll(".step");
  const progressBar = document.getElementById("progress-bar");
  const backBtn = document.getElementById("back");
  const nextBtn = document.getElementById("next");
  const summaryEl = document.getElementById("summary");

  const SPECIAL_PLANS = new Set(["Роутер", "Сервер VPS"]);

  // ---------- utils ----------
  function formatMoney(n) {
    const ds = fmtCfg.decimalSep ?? ",";
    const ts = fmtCfg.thousandSep ?? " ";
    const fd = Number.isFinite(fmtCfg.fractionDigits) ? fmtCfg.fractionDigits : 0;
    const sign = n < 0 ? "-" : "";
    n = Math.abs(Number(n));

    const int = Math.trunc(n);
    const frac = Math.round((n - int) * Math.pow(10, fd));
    const intStr = int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ts);
    const fracStr = fd ? ds + String(frac).padStart(fd, "0") : "";
    const cur = cfg.currency || "₽";
    return fmtCfg.currencyPosition === "prefix"
      ? `${sign}${cur}${intStr}${fracStr}`
      : `${sign}${intStr}${fracStr} ${cur}`;
  }

  // Берём ИТОГ непосредственно из PRICING.matrixTotals
  function computeTotal(plan, accounts, duration) {
    if (!plan) return null;
    const table = cfg.matrixTotals?.[plan];
    if (!table) return null;

    // Фиксированная цена для спец-планов
    if (table && typeof table.total !== "undefined") {
      return { total: Number(table.total), months: null, currency: cfg.currency || "₽" };
    }

    // Обычные планы — нужна комбинация accounts + duration
    if (!accounts || !duration) return null;
    const byAcc = table[String(accounts)];
    if (!byAcc) return null;
    const total = byAcc[String(duration)];
    if (!Number.isFinite(total)) return null;

    return { total: Number(total), months: Number(duration), currency: cfg.currency || "₽" };
  }

  function renderPreview() {
    const p = computeTotal(data.plan, data.accounts, data.duration);
    if (!p) {
      pricePreview?.classList.remove("show");
      if (pricePreview) pricePreview.textContent = "";
      return;
    }
    if (pricePreview) {
      // только ИТОГО (без скидок/месячных)
      const suffix = p.months ? ` за ${p.months} мес` : "";
      pricePreview.innerHTML = `Итого${suffix}: <b>${formatMoney(p.total)}</b>`;
      pricePreview.classList.add("show");
    }
  }

  function renderSummary() {
    const p = computeTotal(data.plan, data.accounts, data.duration);
    const planLabel     = data.plan     || "-";
    const accountsLabel = data.accounts || (SPECIAL_PLANS.has(planLabel) ? "—" : "-");
    const durationLabel = data.duration || (SPECIAL_PLANS.has(planLabel) ? "—" : "-");

    const priceBlock = p ? `
      <hr style="opacity:.15">
      <div style="font:600 16px/1.3 system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
        Итого: ${formatMoney(p.total)}
      </div>
    ` : ``;

    if (summaryEl) {
      summaryEl.innerHTML = `
        <p><strong>Вы выбрали:</strong></p>
        <ul style="list-style-type:none; padding:0; margin:0 0 10px 0;">
          <li>Тариф: <b>${planLabel}</b></li>
          <li>Аккаунтов: <b>${accountsLabel}</b></li>
          <li>Срок: <b>${durationLabel}</b></li>
        </ul>
        ${priceBlock}
      `;
    }
  }

  function showStep(step) {
    steps.forEach((el, idx) => { el.style.display = idx === step - 1 ? "block" : "none"; });
    if (progressBar) progressBar.style.width = `${(step / totalSteps) * 100}%`;
    if (backBtn) backBtn.style.display = step === 1 ? "none" : "inline-block";
    if (nextBtn) nextBtn.textContent = step === totalSteps ? "Подтвердить" : "Далее";

    if (step < totalSteps) renderPreview();
    if (step === totalSteps) renderSummary();
  }

  // ---------- выбор опций ----------
  document.querySelectorAll(".btn.option").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const t = e.currentTarget;
      const { plan, accounts, duration } = t.dataset;

      // эксклюзивный выбор в рамках контейнера кнопок
      const group = t.parentElement.querySelectorAll(".btn.option");
      group.forEach((el) => el.classList.remove("selected"));
      t.classList.add("selected");

      if (plan) {
        data.plan = plan;

        // Спец-планы: сразу на Шаг 3 (без выбора аккаунтов/срока)
        if (SPECIAL_PLANS.has(plan)) {
          delete data.accounts;
          delete data.duration;
          currentStep = 3;
          showStep(currentStep);
          renderPreview(); // уже покажем ИТОГО
          return;
        }
      }
      if (accounts) data.accounts = accounts;
      if (duration) data.duration = Number(duration);

      renderPreview();
    });
  });

  // ---------- кнопки навигации ----------
  nextBtn?.addEventListener("click", async (e) => {
    e.preventDefault();

    if (currentStep === 1) {
      if (!data.plan) {
        alert("Пожалуйста, выберите тариф");
        return;
      }
      // Если выбран спец-план, мы уже перепрыгнули на шаг 3 в обработчике клика.
    }

    if (currentStep === 2) {
      if (!data.accounts || !data.duration) {
        alert("Пожалуйста, выберите количество аккаунтов и срок");
        return;
      }
    }

    if (currentStep < totalSteps) {
      currentStep++;
      showStep(currentStep);
    } else {
      // подтверждение → отправка (inline + answerWebAppQuery)
      const pricing = computeTotal(data.plan, data.accounts, data.duration);
      const payload = { ...data, pricing };

      const qid = tg?.initDataUnsafe?.query_id;
      const fromId = tg?.initDataUnsafe?.user?.id;

      if (!qid) {
        // fallback: если вдруг запустили не из inline-кнопки
        try { tg?.sendData(JSON.stringify(payload)); } catch (_) {}
        tg?.close();
        return;
      }

      const json = JSON.stringify({ query_id: qid, from_id: fromId, data: payload });

      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 8000);
        const resp = await fetch('/webapp-answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: json,
          keepalive: true,
          signal: controller.signal
        });
        clearTimeout(t);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        tg?.close();
      } catch {
        const blob = new Blob([json], { type: 'application/json' });
        if (!('sendBeacon' in navigator) || !navigator.sendBeacon('/webapp-answer', blob)) {
          alert('Не удалось отправить данные. Проверьте сеть и попробуйте ещё раз.');
          return; // не закрываем — пусть попробует снова
        }
        tg?.close();
      }
    }
  });

  backBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);
    }
  });

  showStep(currentStep);
});

