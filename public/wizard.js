// public/wizard.js
const tg = window.Telegram?.WebApp;
tg?.expand();

document.addEventListener("DOMContentLoaded", () => {
  let currentStep = 1;
  const totalSteps = 3;
  const data = {};

  const steps = document.querySelectorAll(".step");
  const progressBar = document.getElementById("progress-bar");
  const backBtn = document.getElementById("back");
  const nextBtn = document.getElementById("next");
  const summaryEl = document.getElementById("summary");

  function showStep(step) {
    steps.forEach((el, idx) => {
      el.style.display = idx === step - 1 ? "block" : "none";
    });
    progressBar.style.width = `${(step / totalSteps) * 100}%`;
    backBtn.style.display = step === 1 ? "none" : "inline-block";
    nextBtn.textContent = step === totalSteps ? "Подтвердить" : "Далее";

    if (step === 3 && summaryEl) {
      summaryEl.innerHTML = `
        <p><strong>Вы выбрали:</strong></p>
        <ul style="list-style-type: none; padding: 0; margin: 0;">
          <li>Тариф: ${data.plan || '-'} </li>
          <li>Аккаунтов: ${data.accounts || '-'} </li>
          <li>Срок: ${data.duration || '-'} мес.</li>
        </ul>
      `;
    }
  }

  // выбор опций
  document.querySelectorAll(".btn.option").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const t = e.currentTarget;
      const { plan, accounts, duration } = t.dataset;

      const group = t.parentElement.querySelectorAll(".btn.option");
      group.forEach((el) => el.classList.remove("selected"));
      t.classList.add("selected");

      if (plan)     data.plan = plan;
      if (accounts) data.accounts = accounts;
      if (duration) data.duration = duration;
    });
  });

  async function sendInlineResult(payload) {
    const qid = tg?.initDataUnsafe?.query_id; // есть ТОЛЬКО при запуске из inline-кнопки
    if (!qid) {
      // Fallback: если вдруг запустили не из inline-кнопки,
      // используем стандартный sendData (вариант A)
      try { tg?.sendData(JSON.stringify(payload)); } catch (_) {}
      return;
    }

    const json = JSON.stringify({ query_id: qid, data: payload });

    // сначала пробуем fetch + keepalive
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
      return;
    } catch (e) {
      // фолбэк на sendBeacon
      try {
        const blob = new Blob([json], { type: 'application/json' });
        if (!navigator.sendBeacon('/webapp-answer', blob)) {
          throw new Error('sendBeacon returned false');
        }
      } catch (err) {
        alert('Не удалось отправить данные. Проверьте сеть и попробуйте ещё раз.');
        throw err;
      }
    }
  }

  // Далее / Подтвердить
  nextBtn.addEventListener("click", async () => {
    if (currentStep === 1 && !data.plan) {
      alert("Пожалуйста, выберите вариант на первом шаге");
      return;
    }
    if (currentStep === 2 && (!data.accounts || !data.duration)) {
      alert("Пожалуйста, выберите количество аккаунтов и срок подписки");
      return;
    }
    if (currentStep < totalSteps) {
      currentStep++;
      showStep(currentStep);
    } else {
      // подтверждение → отправляем на сервер query_id + данные
      try {
        await sendInlineResult(data);
        tg?.close();
      } catch (_) {
        // не закрываем — пусть пользователь попробует снова
      }
    }
  });

  // Назад
  backBtn.addEventListener("click", () => {
    if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);
    }
  });

  showStep(currentStep);
});
