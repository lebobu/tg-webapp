// =========================
// WEB WIZARD
// =========================

const state = {
  plan: null,
  planBeforeRouter: null,
  accounts: null,
  duration: null,
  email: '',
  os: null
};

let currentStep = 1;
const TOTAL_STEPS = 4;

// =========================
// COOKIE HELPERS
// =========================

function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name) {
  const key = name + '=';
  for (const part of document.cookie.split(';')) {
    const c = part.trim();
    if (c.startsWith(key)) return decodeURIComponent(c.slice(key.length));
  }
  return '';
}

// =========================
// ELEMENTS
// =========================

const steps = [
  document.querySelector('.step-1'),
  document.querySelector('.step-2'),
  document.querySelector('.step-3'),
  document.querySelector('.step-4')
];

const nextBtn  = document.getElementById('next');
const backBtn  = document.getElementById('back');
const okBtn    = document.getElementById('ok-btn');
const progressBar = document.getElementById('progress-bar');
const summary  = document.getElementById('summary');
const emailInput = document.getElementById('email');
const osField = document.getElementById('os-field');

// =========================
// INIT
// =========================

init();

function init() {
  // Подставить email из куки
  const savedEmail = getCookie('user_email');
  if (savedEmail) {
    emailInput.value = savedEmail;
  }

  bindOptions();
  bindOsButtons();

  nextBtn.addEventListener('click', onNext);
  backBtn.addEventListener('click', onBack);

  bindHelpModal();
  render();
}

// =========================
// OPTIONS (plan / accounts / duration)
// =========================

function bindOptions() {
  document.querySelectorAll('.option').forEach(btn => {
    btn.addEventListener('click', () => {
      const { plan, accounts, duration } = btn.dataset;
      if (plan) {
        if (plan === 'Роутер') {
          if (state.plan && state.plan !== 'Роутер') {
            state.planBeforeRouter = state.plan;
          }
          state.plan = plan;
          state.accounts = null;
        } else {
          state.plan = plan;
          state.planBeforeRouter = plan;
        }
      }
      if (accounts) {
        state.accounts = accounts;
        if (state.plan === 'Роутер') {
          state.plan = state.planBeforeRouter || 'EU';
        }
      }
      if (duration) state.duration = duration;
      updateButtons();
      updateSummary();
    });
  });
}

function updateButtons() {
  document.querySelectorAll('.option').forEach(btn => {
    btn.classList.remove('selected');
    const { plan, accounts, duration } = btn.dataset;
    if (
      (plan     && state.plan      === plan)     ||
      (accounts && state.accounts  === accounts) ||
      (duration && state.duration  === duration)
    ) {
      btn.classList.add('selected');
    }
  });
}

// =========================
// OS BUTTONS
// =========================

function bindOsButtons() {
  document.querySelectorAll('.os-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.os = btn.dataset.os;
      document.querySelectorAll('.os-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('os-error').style.display = 'none';
    });
  });
}

function updateOsVisibility() {
  if (!osField) return;
  const isRouter = state.plan === 'Роутер';
  osField.style.display = isRouter ? 'none' : 'block';
  if (isRouter) {
    state.os = null;
    document.querySelectorAll('.os-btn').forEach(b => b.classList.remove('selected'));
    const osError = document.getElementById('os-error');
    if (osError) osError.style.display = 'none';
  }
}

// =========================
// NAVIGATION
// =========================

function onNext() {

  if (currentStep === 1) {
    if (!state.plan) { alert('Выберите тариф'); return; }
    currentStep = 2;

  } else if (currentStep === 2) {
    if (!state.duration) { alert('Выберите срок'); return; }
    if (state.plan !== 'Роутер' && !state.accounts) { alert('Выберите количество аккаунтов'); return; }
    currentStep = 3;
    updateSummary();

  } else if (currentStep === 3) {

    const email = emailInput.value.trim();
    const emailError = document.getElementById('email-error');
    const osError    = document.getElementById('os-error');
    let valid = true;

    if (!isValidEmail(email)) {
      emailError.style.display = 'block';
      valid = false;
    } else {
      emailError.style.display = 'none';
    }

    if (state.plan !== 'Роутер') {
      if (!state.os) {
        osError.style.display = 'block';
        valid = false;
      } else {
        osError.style.display = 'none';
      }
    }

    if (!valid) return;

    state.email = email;
    submitOrder();
    return; // render вызовется после ответа
  }

  render();
}

function onBack() {
  if (currentStep > 1 && currentStep < 4) {
    currentStep--;
    render();
  }
}

// =========================
// RENDER
// =========================

function render() {
  steps.forEach((step, i) => {
    step.style.display = i + 1 === currentStep ? 'block' : 'none';
  });

  progressBar.style.width = `${(currentStep / TOTAL_STEPS) * 100}%`;

  if (currentStep === 4) {
    // шаг 4: показать только OK, скрыть Назад и Далее
    nextBtn.style.display = 'none';
    backBtn.style.display = 'none';
    okBtn.style.display   = 'inline-flex';
  } else {
    nextBtn.style.display = 'inline-flex';
    okBtn.style.display   = 'none';
    backBtn.style.display = currentStep === 1 ? 'none' : 'inline-flex';
    nextBtn.textContent   = currentStep === 3 ? 'Подтвердить' : 'Далее';
  }

  if (currentStep === 1) {
    nextBtn.classList.add('single-next');
  } else {
    nextBtn.classList.remove('single-next');
  }

  if (currentStep === 3) {
    updateOsVisibility();
  }
}

// =========================
// SUMMARY (шаг 3)
// =========================

function updateSummary() {
  const total = getPrice();
  summary.innerHTML = `
    <p><strong>Тариф:</strong> ${state.plan}</p>
    <p><strong>Аккаунты:</strong> ${state.accounts || '-'}</p>
    <p><strong>Срок:</strong> ${state.duration} мес.</p>
    <hr>
    <p><strong>Итого: ${total == null ? '—' : `${total} ₽`}</strong></p>
  `;
}

function getPrice() {
  const pricing = window.PRICING.matrixTotals;
  if (!state.plan || !state.duration) return null;
  if (state.plan === 'Роутер') {
    return pricing['Роутер']?.durations?.[state.duration] ?? null;
  }
  return pricing[state.plan]?.[state.accounts]?.[state.duration] ?? null;
}

// =========================
// RECEIPT (шаг 4)
// =========================

function showReceipt(orderId) {
  const total = getPrice();
  const osLabel = {
    apple:   '🍎 Apple (iOS / macOS)',
    android: '🤖 Android',
    windows: '🪟 Windows'
  }[state.os] || state.os;

  document.getElementById('receipt-box').innerHTML = `

    <div style="text-align:center;padding:20px 0 12px">
      <div style="font-size:36px;line-height:1">✅</div>
      <h3 style="margin:12px 0 4px;font-size:22px">Заказ оформлен!</h3>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0">№ ${orderId}</p>
    </div>

    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:16px 0">

    <p style="margin:8px 0"><strong>Тариф:</strong> ${state.plan}</p>
    <p style="margin:8px 0"><strong>Аккаунты:</strong> ${state.accounts || '-'}</p>
    <p style="margin:8px 0"><strong>Срок:</strong> ${state.duration} мес.</p>
    <p style="margin:8px 0"><strong>ОС:</strong> ${osLabel}</p>
    <p style="margin:8px 0"><strong>Email:</strong> ${state.email}</p>

    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:16px 0">

    <p style="font-size:22px;margin:0 0 16px"><strong>К оплате: ${total} ₽</strong></p>

    <div style="background:rgba(255,255,255,0.06);border-radius:16px;padding:16px;border:1px solid rgba(255,255,255,0.1)">
      <p style="margin:0 0 10px;font-weight:600">💳 Способы оплаты</p>
      <p style="margin:6px 0">📲 <strong>СБП</strong> по номеру: <strong>+7 977 741-96-09</strong></p>
      <p style="margin:6px 0">💳 <strong>Карта:</strong> 5536 0903 1860 9271</p>
      <p style="margin:6px 0;color:rgba(255,255,255,0.5);font-size:14px">Совкомбанк · Владимир А.</p>
    </div>

    <p style="margin-top:16px;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.5">
      Ключ доступа будет выдан в течение 2-х часов. Ожидаем оплату в ближайшие сутки, спасибо за заказ</br>
      <span style="display:block;text-align:center;margin:10px 0;">
        <a href="help.html#install" target="_blank" rel="noopener">Как установить и запустить</a>
      </span>
      <a href="https://t.me/polpo2022" target="_blank" rel="noopener">Чат поддержки в Телеграм</a></br>
      <a href="mailto:sicuro.vpn@gmail.com">E-mail поддержки</a>
      
    </p>
  `;
}

// =========================
// API
// =========================

async function submitOrder() {

  nextBtn.disabled = true;
  nextBtn.classList.add('is-loading');
  nextBtn.textContent = 'Отправка…';

  try {
    const payload = {
      form: {
        plan:     state.plan,
        accounts: state.accounts,
        duration: state.duration,
        os:       state.os
      },
      pricing: { total: getPrice() },
      customer: { email: state.email }
    };

    const response = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'Order failed');

    // Сохранить email в куки на 180 дней
    setCookie('user_email', state.email, 180);

    currentStep = 4;
    showReceipt(result.orderId);
    render();

  } catch (err) {
    console.error(err);
    alert('Ошибка оформления заказа. Попробуйте ещё раз.');
    nextBtn.textContent = 'Подтвердить';
  } finally {
    nextBtn.disabled = false;
    nextBtn.classList.remove('is-loading');
  }
}

// =========================
// HELP MODAL
// =========================

function bindHelpModal() {
  const modal   = document.getElementById('help-modal');
  const openBtn = document.querySelector('.bt-help');

  openBtn.addEventListener('click', () => {
    modal.querySelectorAll('details[open]').forEach(d => d.removeAttribute('open'));
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  });

  modal.addEventListener('click', e => {
    if (e.target.closest('[data-close]') || e.target === modal) {
      closeHelpModal(modal);
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeHelpModal(modal);
    }
  });
}

function closeHelpModal(modal) {
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

// =========================
// HELPERS
// =========================

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
