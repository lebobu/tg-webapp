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

  // Узлы шага 2
  const accountsLabel =
    document.querySelector('.step-2 .accounts-label') || null;

  const accountsGroup =
    document.querySelector("#accountsGroup") ||
    document.querySelector(".row-accounts") ||
    document.querySelector(".accounts") ||
    document.querySelector('.step-2 [data-group="accounts"]') || null;

  const durationGroup =
    document.querySelector("#durationGroup") ||
    document.querySelector(".row-duration") ||
    document.querySelector(".duration") ||
    document.querySelector('.step-2 [data-group="duration"]') || null;

  const SPECIAL_PLANS = new Set(["Роутер", "Сервер VPS"]);

  const emailInput = document.getElementById('email');
  const emailError = document.getElementById('email-error');

  const isValidEmail = (s) => {
    const v = String(s || '').trim();
    // простой и надёжный для UI формат: "что-то@что-то.домен"
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  };


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

  // Итог из матрицы (без формул):
  // - EU/RU: totals[plan][accounts][duration]
  // - Роутер/VPS: totals[plan].durations[duration]
  function computeTotal(plan, accounts, duration) {
    if (!plan) return null;
    const table = cfg.matrixTotals?.[plan];
    if (!table) return null;

    if (SPECIAL_PLANS.has(plan)) {
      if (!duration) return null;
      const total = table.durations?.[String(duration)];
      if (!Number.isFinite(total)) return null;
      return { total: Number(total), months: Number(duration), currency: cfg.currency || "₽" };
    }

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
      const suffix = p.months ? ` за ${p.months} мес` : "";
      pricePreview.innerHTML = `Итого${suffix}: <b>${formatMoney(p.total)}</b>`;
      pricePreview.classList.add("show");
    }
  }

  function renderSummary() {
    const p = computeTotal(data.plan, data.accounts, data.duration);
    const planLabel = data.plan || "-";
    const durationLabel = data.duration || "-";

    // Аккаунты показываем только для НЕ спец-планов
    const accountsLine = SPECIAL_PLANS.has(planLabel)
      ? ""
      : `<li>Аккаунтов: <b>${data.accounts || "-"}</b></li>`;

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
          ${accountsLine}
          <li>Срок: <b>${durationLabel}</b></li>
          <li>${emailLine}</b></li>
        </ul>
        ${priceBlock}
      `;
    }
  }

  // Сброс выбора ШАГА 2 (только при переходе 1 -> 2)
  function resetStep2Selections() {
    delete data.accounts;
    delete data.duration;

    // убрать выделение кнопок на шаге 2
    document.querySelectorAll('.step-2 .btn.option.selected')
      .forEach(el => el.classList.remove('selected'));

    // спрятать превью цены
    if (pricePreview) {
      pricePreview.classList.remove('show');
      pricePreview.textContent = '';
    }
  }

  function showStep(step) {
    steps.forEach((el, idx) => { el.style.display = idx === step - 1 ? "block" : "none"; });
    if (progressBar) progressBar.style.width = `${(step / totalSteps) * 100}%`;
    if (backBtn) backBtn.style.display = step === 1 ? "none" : "inline-block";
    if (nextBtn) nextBtn.textContent = step === totalSteps ? "Подтвердить" : "Далее";

    // На шаге 2 — показать/скрыть группу АККАУНТОВ для спец-планов
    if (step === 2) {
      const hideAccounts = SPECIAL_PLANS.has(data.plan || "");
      if (accountsGroup) accountsGroup.classList.toggle("hidden", hideAccounts);
      if (accountsLabel) accountsLabel.classList.toggle("hidden", hideAccounts);
      document.querySelectorAll('.step-2 .btn.option[data-accounts]')
        .forEach(b => b.classList.toggle('hidden', hideAccounts));
    }

    if (step < totalSteps) renderPreview();
    if (step === totalSteps) renderSummary();
  }

  // ---------- выбор опций ----------
  document.querySelectorAll(".btn.option").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const t = e.currentTarget;
      const { plan, accounts, duration } = t.dataset;

      // эксклюзивный выбор в рамках контейнера
      const group = t.parentElement.querySelectorAll(".btn.option");
      group.forEach((el) => el.classList.remove("selected"));
      t.classList.add("selected");

      if (plan) {
        data.plan = plan;
        // если выбран спец-план — аккаунты не нужны
        if (SPECIAL_PLANS.has(plan)) {
          delete data.accounts;
        }
      }
      if (accounts) data.accounts = accounts;
      if (duration) data.duration = Number(duration);

      // если уже на шаге 2 — просто обновим видимость блока аккаунтов
      if (currentStep === 2) {
        const hideAccounts = SPECIAL_PLANS.has(data.plan || "");
        if (accountsGroup) accountsGroup.classList.toggle("hidden", hideAccounts);
        if (accountsLabel) accountsLabel.classList.toggle("hidden", hideAccounts);
        document.querySelectorAll('.step-2 .btn.option[data-accounts]')
          .forEach(b => b.classList.toggle('hidden', hideAccounts));
      }

      renderPreview();
    });
  });

  // ---------- кнопки навигации ----------
  nextBtn?.addEventListener("click", async (e) => {
    e.preventDefault();

    if (currentStep === 1) {
      if (!data.plan) return alert("Пожалуйста, выберите тариф");
      // Переход 1 -> 2: сбрасываем выбор второго шага
      resetStep2Selections();
    }

    if (currentStep === 2) {
      if (SPECIAL_PLANS.has(data.plan || "")) {
        if (!data.duration) return alert("Пожалуйста, выберите срок");
      } else {
        if (!data.accounts || !data.duration) {
          return alert("Пожалуйста, выберите количество аккаунтов и срок");
        }
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
        try { tg?.sendData(JSON.stringify(payload)); } catch (_) { }
        tg?.close();
        return;
      }

      // мы на шаге 3 — проверяем e-mail
      if (currentStep === totalSteps) {
        const val = emailInput ? String(emailInput.value).trim() : '';
        if (!isValidEmail(val)) {
          if (emailError) emailError.style.display = 'block';
          if (emailInput) {
            emailInput.focus();
            emailInput.style.borderColor = '#c62828';
          }
          return; // стоп подтверждение
        }
        data.email = val; // добавляем в данные заявки
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

  // ⬇️ ДОБАВЬ ЭТОТ БЛОК СРАЗУ ПОСЛЕ showStep(...)
  if (emailInput) {
    emailInput.addEventListener('input', () => {
      const ok = isValidEmail(emailInput.value);
      emailInput.style.borderColor = ok ? '#d0d0d4' : '#c62828';
      if (emailError) emailError.style.display = ok ? 'none' : 'block';
    });
  }

});
