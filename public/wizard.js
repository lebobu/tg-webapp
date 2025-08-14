// wizard.js
const tg = window.Telegram.WebApp;
tg.expand();

document.addEventListener("DOMContentLoaded", () => {
  let currentStep = 1;
  const totalSteps = 3;
  const data = {};

  const steps = document.querySelectorAll(".step");
  const progressBar = document.getElementById("progress-bar");
  const backBtn = document.getElementById("back");
  const nextBtn = document.getElementById("next");

  function showStep(step) {
    steps.forEach((el, idx) => {
      el.style.display = idx === step - 1 ? "block" : "none";
    });
    progressBar.style.width = `${(step / totalSteps) * 100}%`;
    backBtn.style.display = step === 1 ? "none" : "inline-block";
    nextBtn.textContent = step === totalSteps ? "Подтвердить" : "Далее";

    if (step === 3) {
      const summary = document.getElementById("summary");
      summary.innerHTML = `
        <p><strong>Вы выбрали:</strong></p>
        <ul style="list-style-type: none;">
          <li>Тариф: ${data.plan || '-'} </li>
          <li>Аккаунтов: ${data.accounts || '-'} </li>
          <li>Срок: ${data.duration || '-'} мес.</li>
        </ul>
      `;
    }
  }

  document.querySelectorAll(".btn.option").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const { plan, accounts, duration } = e.target.dataset;
      if (plan) data.plan = plan;
      if (accounts) data.accounts = accounts;
      if (duration) data.duration = duration;

      const group = e.target.parentElement.querySelectorAll(".btn.option");
      group.forEach((el) => el.classList.remove("selected"));
      e.target.classList.add("selected");
    });
  });

  nextBtn.addEventListener("click", () => {
    if (currentStep < totalSteps) {
      currentStep++;
      showStep(currentStep);
    } else {
      if (!data.plan || !data.accounts || !data.duration) {
        alert("Пожалуйста, выберите все параметры подписки.");
        return;
      }
      tg.sendData(JSON.stringify(data));
      tg.close();
    }
  });

  backBtn.addEventListener("click", () => {
    if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);
    }
  });

  showStep(currentStep);
});
