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

  // ---------- utils ----------
  function formatMoney(n) {
    const ds = fmtCfg.decimalSep ?? ",";
    const ts = fmtCfg.thousandSep ?? " ";
    const fd = Number.isFinite(fmtCfg.fractionDigits) ? fmtCfg.fractionDigits : 0;
    const sign = n < 0 ? "-" : "";
    n = Math.abs(n);

    const int = Math.trunc(n);
    const frac = Math.round((n - int) * Math.pow(10, fd));
    const intStr = int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ts);
    const fracStr = fd ? ds + String(frac).padStart(fd, "0") : "";
    const cur = cfg.currency || "₽";
    return fmtCfg.currencyPosition === "prefix"
      ? `${sign}${cur}${intStr}${fracStr}`
      : `${sign}${intStr}${fracStr} ${cur}`;
  }

  function computePrice(plan, accounts, duration) {
    if (!plan || !accounts || !duration) return null;
    const baseMonthly = cfg.matrix?.[plan]?.[String(accounts)];
    if (!Number.isFinite(baseMonthly)) return null;

    const disc = Number(cfg.durationDiscount?.[String(duration)] || 0); // 0..1
    const monthlyAfter = Math.round(baseMonthly * (1 - disc));
    const months = Number(duration);
    const total = monthlyAfter * months;
    const baseTotal = baseMonthly * months;
    const savings = baseTotal - total;

    return {
      currency: cfg.currency || "₽",
      baseMonthly,
      monthlyAfter,
      discount: disc,       // 0.20 => 20%
      months,
      total,
      baseTotal,
      savings
    };
  }

  function renderPreview() {
    const p = computePrice(data.plan, data.accounts, data.duration);
    if (!p) {
      pricePreview?.classList.remove("show");
      if (pricePreview) pricePreview.textContent = "";
      return;
    }
    const discText = p.discount ? `, скидка ${Math.round(p.discount * 100)}%` : "";
    if (pricePreview) {
      pricePreview.innerHTML =
        `За месяц: <b>${formatMoney(p.monthlyAfter)}</b>` +
        `<small>(база ${formatMoney(p.baseMonthly)}${discText})</small>` +
        `<br>Итого за ${p.months} мес: <b>${formatMoney(p.total)}</b>` +
        (p.savings > 0 ? ` <small>(Вы экономите ${formatMoney(p.savings)})</small>` : "");
      pricePreview.classList.add("show");
    }
  }

  function renderSummary() {
    const p = computePrice(data.plan, data.accounts, data.duration);
    const planLabel     = data.plan     || "-";
    const accountsLabel = data.accounts || "-";
    const durationLabel = data.duration || "-";

    const priceBlock = p ? `
      <hr style="opacity:.15">
      <div style="font:600 16px/1.3 system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
        Итого: ${formatMoney(p.total)}
      </div>
      <div style="opacity:.7; font: 13px/1.35 system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
        ${formatMoney(p.monthlyAfter)} / мес
        ${p.discount ? `(скидка ${Math.round(p.discount*100)}%, база ${formatMoney(p.baseMonthly)})` : ""}
      </div>
      ${p.savings > 0 ? `<div style="opacity:.7; font: 13px/1.35 system-ui">Экономия: ${formatMoney(p.savings)}</div>` : ""}
    ` : `
      <div style="color:#b00">Для расчёта цены укажите все параметры.</div>
    `;

    if (summaryEl) {
      summaryEl.innerHTML = `
        <p><strong>Вы выбрали:</strong></p>
        <ul style="list-style-type:none; padding:0; margin:0 0 10px 0;">
          <li>Тариф: <b>${planLabel}</b></li>
          <li>Аккаунтов: <b>${accountsLabel}</b></li>
          <li>Срок: <b>${durationLabel}</b> мес.</li>
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

    if (step < totalSteps) renderPreview();   // на шагах выбора — лишь превью
    if (step === totalSteps) renderSummary(); // финальный шаг — детальный итог
  }

  // ---------- выбор опций ----------
  document.querySelectorAll(".btn.option").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const t = e.currentTarget;
      const { plan, accounts, duration } = t.dataset;

      // эксклюзивный выбор в рамках контейнера
      const group = t.parentElement.querySelectorAll(".btn.option");
      group.forEach((el) => el.classList.remove("selected"));
      t.classList.add("selected");

      if (plan)     data.plan = plan;               // ключ из data-plan (д.б. как в PRICING.matrix)
      if (accounts) data.accounts = accounts;       // строка/число — ок
      if (duration) data.duration = Number(duration);

      renderPreview();
    });
  });

  // ---------- кнопки шага ----------
  nextBtn?.addEventListener("click", async () => {
    if (currentStep === 1 && !data.plan) {
      alert("Пожалуйста, выберите тариф");
      return;
    }
    if (currentStep === 2 && (!data.accounts || !data.duration)) {
      alert("Пожалуйста, выберите количество аккаунтов и срок");
      return;
    }

    if (currentStep < totalSteps) {
      currentStep++;
      showStep(currentStep);
    } else {
      // подтверждение → отправка (вариант B: inline + answerWebAppQuery)
      const pricing = computePrice(data.plan, data.accounts, data.duration);
      const payload = { ...data, pricing }; // добавляем цены в полезную нагрузку

      const qid = tg?.initDataUnsafe?.query_id;
      const fromId = tg?.initDataUnsafe?.user?.id;
      if (!qid) {
        // fallback: если вдруг запустили не из inline-кнопки — sendData
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
        // фолбэк — sendBeacon
        const blob = new Blob([json], { type: 'application/json' });
        if (!('sendBeacon' in navigator) || !navigator.sendBeacon('/webapp-answer', blob)) {
          alert('Не удалось отправить данные. Проверьте сеть и попробуйте ещё раз.');
          return; // не закрываем — пусть попробует снова
        }
        tg?.close();
      }
    }
  });

  backBtn?.addEventListener("click", () => {
    if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);
    }
  });

  showStep(currentStep);
});
