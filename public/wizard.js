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

  function showCustomAlert(message) {
    let existing = document.getElementById("custom-alert");
    if (existing) existing.remove();

    const alertBox = document.createElement("div");
    alertBox.id = "custom-alert";
    alertBox.style.position = "fixed";
    alertBox.style.top = "0";
    alertBox.style.left = "0";
    alertBox.style.width = "100%";
    alertBox.style.height = "100vh";
    alertBox.style.background = "rgba(0,0,0,0.6)";
    alertBox.style.display = "flex";
    alertBox.style.alignItems = "center";
    alertBox.style.justifyContent = "center";
    alertBox.style.zIndex = "9999";

    alertBox.innerHTML = `
      <div style="background:white; padding:20px 30px; border-radius:10px; max-width: 300px; text-align:center;">
        <h3 style="margin-top:0">Внимание!</h3>
        <p>${message}</p>
        <button style="margin-top:10px; padding:6px 16px; background:#0088cc; color:white; border:none; border-radius:6px; font-weight:bold" onclick="document.getElementById('custom-alert').remove()">ОК</button>
      </div>
    `;
    
  // function updateNextButtonState() {
  //   if (
  //     (currentStep === 1 && !data.plan) ||
  //     (currentStep === 2 && (!data.accounts || !data.duration))
  //   ) {
  //     nextBtn.setAttribute.add("title","Check");
  //     // nextBtn.setAttribute("disabled", "true");
  //     nextBtn.classList.add("disabled");
  //   } else {
  //     nextBtn.setAttribute.add("title","Далее");

  //     // nextBtn.removeAttribute("disabled");
  //     nextBtn.classList.remove("disabled");
  //   }
  // }

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
        <ul style="list-style-type: none; padding: 0; margin: 0;">
          <li>Тариф: ${data.plan || '-'} </li>
          <li>Аккаунтов: ${data.accounts || '-'} </li>
          <li>Срок: ${data.duration || '-'} мес.</li>
        </ul>
      `;
    }
    // updateNextButtonState();
  }

  document.querySelectorAll(".btn.option").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const { plan, accounts, duration } = e.target.dataset;
      const isSelected = e.target.classList.contains("selected");

      if (plan) {
        if (isSelected) {
          delete data.plan;
        } else {
          data.plan = plan;
        }
      }
      if (accounts) {
        if (isSelected) {
          delete data.accounts;
        } else {
          data.accounts = accounts;
        }
      }
      if (duration) {
        if (isSelected) {
          delete data.duration;
        } else {
          data.duration = duration;
        }
      }

      const group = e.target.parentElement.querySelectorAll(".btn.option");
      group.forEach((el) => el.classList.remove("selected"));

      if (!isSelected) {
        e.target.classList.add("selected");
      }

      // updateNextButtonState();
    });
  });

  nextBtn.addEventListener("click", () => {
    if (currentStep === 1 && !data.plan) {
      showCustomAlert("Пожалуйста, выберите вариант на первом шаге");
      return;
    }
    if (currentStep === 2 && (!data.accounts || !data.duration)) {
      showCustomAlert("Пожалуйста, выберите количество аккаунтов и срок подписки");
      return;
    }
    if (currentStep < totalSteps) {
      currentStep++;
      showStep(currentStep);
    } else {
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
