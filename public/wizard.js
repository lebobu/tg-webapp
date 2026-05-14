// =========================
// WEB ONLY VERSION
// =========================

const state = {
  plan: null,
  accounts: null,
  duration: null,
  email: ''
};

let currentStep = 1;

// =========================
// ELEMENTS
// =========================

const steps = [
  document.querySelector('.step-1'),
  document.querySelector('.step-2'),
  document.querySelector('.step-3')
];

const nextBtn = document.getElementById('next');
const backBtn = document.getElementById('back');

const progressBar =
  document.getElementById('progress-bar');

const summary =
  document.getElementById('summary');

const emailInput =
  document.getElementById('email');

// =========================
// INIT
// =========================

init();

function init() {

  bindOptions();

  nextBtn.addEventListener(
    'click',
    onNext
  );

  backBtn.addEventListener(
    'click',
    onBack
  );

  bindHelpModal();

  render();
}

// =========================
// HELP MODAL
// =========================

function bindHelpModal() {

  const modal =
    document.getElementById('help-modal');

  const openBtn =
    document.querySelector('.bt-help');

  // открыть
  openBtn.addEventListener('click', () => {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  });

  // закрыть по кнопке ×
  modal.addEventListener('click', e => {

    if (
      e.target.closest('[data-close]') ||
      e.target === modal
    ) {
      closeHelpModal(modal);
    }
  });

  // закрыть по Escape
  document.addEventListener('keydown', e => {

    if (
      e.key === 'Escape' &&
      modal.classList.contains('active')
    ) {
      closeHelpModal(modal);
    }
  });
}

function closeHelpModal(modal) {
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

// =========================
// OPTIONS
// =========================

function bindOptions() {

  document
    .querySelectorAll('.option')
    .forEach(btn => {

      btn.addEventListener('click', () => {

        const {
          plan,
          accounts,
          duration
        } = btn.dataset;

        if (plan)
          state.plan = plan;

        if (accounts)
          state.accounts = accounts;

        if (duration)
          state.duration = duration;

        updateButtons();
        updateSummary();
      });
    });
}

function updateButtons() {

  document
    .querySelectorAll('.option')
    .forEach(btn => {

      btn.classList.remove('selected');

      const {
        plan,
        accounts,
        duration
      } = btn.dataset;

      if (
        (plan && state.plan === plan) ||
        (accounts && state.accounts === accounts) ||
        (duration && state.duration === duration)
      ) {
        btn.classList.add('selected');
      }
    });
}

// =========================
// NAVIGATION
// =========================

function onNext() {

  if (currentStep === 1) {

    if (!state.plan) {
      alert('Выберите тариф');
      return;
    }

    currentStep = 2;

  } else if (currentStep === 2) {

    if (!state.duration) {
      alert('Выберите срок');
      return;
    }

    if (
      state.plan !== 'Роутер' &&
      !state.accounts
    ) {
      alert('Выберите количество аккаунтов');
      return;
    }

    currentStep = 3;

    updateSummary();

  } else {

    submitOrder();
  }

  render();
}

function onBack() {

  if (currentStep > 1) {
    currentStep--;
  }

  render();
}

// =========================
// RENDER
// =========================

function render() {

  steps.forEach((step, i) => {

    step.style.display =
      i + 1 === currentStep
        ? 'block'
        : 'none';
  });

  progressBar.style.width =
    `${currentStep * 33}%`;

  backBtn.style.display =
    currentStep === 1
      ? 'none'
      : 'inline-flex';

  nextBtn.textContent =
    currentStep === 3
      ? 'Подтвердить'
      : 'Далее';
}

// =========================
// SUMMARY
// =========================

function updateSummary() {

  const total = getPrice();

  summary.innerHTML = `
    <p><strong>Тариф:</strong> ${state.plan}</p>

    <p><strong>Аккаунты:</strong>
      ${state.accounts || '-'}
    </p>

    <p><strong>Срок:</strong>
      ${state.duration} мес.
    </p>

    <hr>

    <p>
      <strong>
        Итого: ${total} ₽
      </strong>
    </p>
  `;
}

function getPrice() {

  const pricing =
    window.PRICING.matrixTotals;

  if (state.plan === 'Роутер') {

    return pricing['Роутер']
      .durations[state.duration];
  }

  return pricing[state.plan]
    [state.accounts]
    [state.duration];
}

// =========================
// API
// =========================

async function submitOrder() {

  const email =
    emailInput.value.trim();

  if (!isValidEmail(email)) {

    alert(
      'Введите корректный email'
    );

    return;
  }

  try {

    nextBtn.disabled = true;

    const payload = {

      form: {
        plan: state.plan,
        accounts: state.accounts,
        duration: state.duration
      },

      pricing: {
        total: getPrice()
      },

      customer: {
        email
      }
    };

    const response = await fetch(
      '/api/order',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify(payload)
      }
    );

    const result =
      await response.json();

    if (!result.ok) {

      throw new Error(
        result.error ||
        'Order failed'
      );
    }

    alert(
      `Заказ оформлен: ${result.orderId}`
    );

    location.reload();

  } catch (err) {

    console.error(err);

    alert(
      'Ошибка оформления заказа'
    );

  } finally {

    nextBtn.disabled = false;
  }
}

// =========================
// HELPERS
// =========================

function isValidEmail(email) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);
}