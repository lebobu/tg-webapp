// public/wizard.js
const tg = window.Telegram?.WebApp;
tg?.expand();

document.addEventListener("DOMContentLoaded", () => {
  // ---------- config/refs ----------
  const cfg = window.PRICING || {};
  const fmtCfg = cfg.display || {};
  const pricePreview = document.getElementById("pricePreview");

  let currentStep = 1;
  const totalSteps = 3;
  const data = {}; // { plan, accounts, duration, email }

  const steps = document.querySelectorAll(".step");
  const progressBar = document.getElementById("progress-bar");
  const backBtn = document.getElementById("back");
  const nextBtn = document.getElementById("next");
  const summaryEl = document.getElementById("summary");

  // шаг 2: группы
  const accountsLabel =
    document.querySelector('.step-2 .accounts-label') || null;

  const accountsGroup =
    document.querySelector("#accountsGroup") ||
    document.querySelector(".row-accounts") ||
    document.querySelector(".accounts") ||
    document.querySelector('.step-2 [data-group="accounts"]') || null;

  const SPECIAL_PLANS = new Set(["Роутер", "Сервер VPS"]);
  
  // шаг 3: email
  const emailInput = document.getElementById('email');
  const emailError = document.getElementById('email-error');

  // ---------- validators / utils ----------
  const isValidEmail = (s) => {
    const v = String(s || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  };

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
  // - обычные планы: totals[plan][accounts][duration]
  // - спец-планы: totals[plan].durations[duration]
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
    const planLabel     = data.plan || "-";
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
        </ul>
        ${priceBlock}
      `;
    }
  }

  // Сброс выбора шага 2 при переходе 1 -> 2
  function resetStep2Selections() {
    delete data.accounts;
    delete data.duration;

    document.querySelectorAll('.step-2 .btn.option.selected')
      .forEach(el => el.classList.remove('selected'));

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

  // ---------- генерация таблиц цен для модалки ----------
  const fmtMoneyForTable = (n) => {
    if (typeof formatMoney === 'function') return formatMoney(n);
    const cur = (window.PRICING && window.PRICING.currency) || '₽';
    return `${Number(n).toLocaleString('ru-RU')} ${cur}`;
  };

  function makePricingTables() {
    const host = document.getElementById('pricing-tables');
    if (!host) return;

    const { matrixTotals = {} } = window.PRICING || {};
    const parts = [];

    // обычные планы
    for (const [plan, table] of Object.entries(matrixTotals)) {
      if (SPECIAL_PLANS.has(plan)) continue;

      const accounts = Object.keys(table).sort((a,b)=>Number(a)-Number(b));
      const dset = new Set();
      accounts.forEach(acc => Object.keys(table[acc] || {}).forEach(d => dset.add(d)));
      const durations = Array.from(dset).sort((a,b)=>Number(a)-Number(b));

      let html = `<h4 class="pt-title">${plan}</h4><div class="pt-wrap"><table class="price-table"><thead><tr><th>Аккаунты \\ Срок</th>`;
      durations.forEach(d => html += `<th>${d} мес</th>`);
      html += `</tr></thead><tbody>`;

      accounts.forEach(acc => {
        html += `<tr><th>${acc}</th>`;
        durations.forEach(d => {
          const v = table?.[acc]?.[d];
          html += `<td>${(v != null) ? fmtMoneyForTable(v) : '—'}</td>`;
        });
        html += `</tr>`;
      });

      html += `</tbody></table></div>`;
      parts.push(html);
    }

    // спец-планы
    const specials = Object.entries(matrixTotals).filter(([p]) => SPECIAL_PLANS.has(p));
    specials.forEach(([plan, obj]) => {
      const durs = Object.keys(obj?.durations || {}).sort((a,b)=>Number(a)-Number(b));
      let html = `<h4 class="pt-title">${plan}</h4><div class="pt-wrap"><table class="price-table"><thead><tr>`;
      durs.forEach(d => html += `<th>${d} мес</th>`);
      html += `</tr></thead><tbody><tr>`;
      durs.forEach(d => {
        const v = obj?.durations?.[d];
        html += `<td>${(v != null) ? fmtMoneyForTable(v) : '—'}</td>`;
      });
      html += `</tr></tbody></table></div>`;
      parts.push(html);
    });

    host.innerHTML = parts.join('');
  }

  // ---------- help modal ----------
  const helpBtn   = document.querySelector('.bt-help');
  const helpModal = document.getElementById('help-modal');
  let _prevFocus = null;

  function openHelp(){
    if (!helpModal) return;
    _prevFocus = document.activeElement;
    helpModal.classList.add('modal--open');
    helpModal.removeAttribute('aria-hidden');
    document.body.classList.add('no-scroll');

    const closeBtn = helpModal.querySelector('[data-close]');
    if (closeBtn) closeBtn.focus();

    makePricingTables();
    helpModal.querySelectorAll('.acc-item').forEach(d => {
      d.addEventListener('toggle', () => {
        if (d.open) {
          helpModal.querySelectorAll('.acc-item').forEach(x => { if (x !== d) x.open = false; });
        }
      });
    });
  }

  function closeHelp(){
    if (!helpModal) return;
    helpModal.classList.remove('modal--open');
    helpModal.setAttribute('aria-hidden','true');
    document.body.classList.remove('no-scroll');
    if (_prevFocus && typeof _prevFocus.focus === 'function') _prevFocus.focus();
  }

  helpBtn?.addEventListener('click', openHelp);
  helpModal?.addEventListener('click', (e) => { if (e.target === helpModal) closeHelp(); });
  helpModal?.querySelector('[data-close]')?.addEventListener('click', closeHelp);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpModal?.classList.contains('modal--open')) closeHelp();
  });

  // ---------- выбор опций ----------
  document.querySelectorAll(".btn.option").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const t = e.currentTarget;
      const { plan, accounts, duration } = t.dataset;

      const group = t.parentElement.querySelectorAll(".btn.option");
      group.forEach((el) => el.classList.remove("selected"));
      t.classList.add("selected");

      if (plan) {
        data.plan = plan;
        if (SPECIAL_PLANS.has(plan)) {
          delete data.accounts;
        }
      }
      if (accounts) data.accounts = accounts;
      if (duration) data.duration = Number(duration);

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
      const val = emailInput ? String(emailInput.value).trim() : '';
      if (!isValidEmail(val)) {
        if (emailError) emailError.style.display = 'block';
        if (emailInput) {
          emailInput.focus();
          emailInput.style.borderColor = '#c62828';
        }
        return;
      }
      data.email = val;

      const pricing = computeTotal(data.plan, data.accounts, data.duration);
      const payload = { ...data, pricing };

      const qid = tg?.initDataUnsafe?.query_id;
      const fromId = tg?.initDataUnsafe?.user?.id;
      if (!qid) {
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
          return;
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

  // рендер 1-го шага
  showStep(currentStep);

  // 💡 Префилл email для старого покупателя из Google Sheets
  (async () => {
    const uid = tg?.initDataUnsafe?.user?.id;
    if (!uid || !emailInput) return;
    try {
      const resp = await fetch('/prefill-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid })
      });
      const j = await resp.json();
      if (j?.ok && j.email) {
        emailInput.value = j.email;
        const evt = new Event('input', { bubbles: true });
        emailInput.dispatchEvent(evt);
      }
    } catch {}
  })();

  // лайв-проверка e-mail
  if (emailInput) {
    emailInput.addEventListener('input', () => {
      const ok = isValidEmail(emailInput.value);
      emailInput.style.borderColor = ok ? '#d0d0d4' : '#c62828';
      if (emailError) emailError.style.display = ok ? 'none' : 'block';
    });
  }
});