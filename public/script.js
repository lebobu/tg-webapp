// public/script.js
const tg = window.Telegram.WebApp;
tg.expand();

const user = tg.initDataUnsafe.user;
const initData = tg.initData;
const platform = tg.platform;

document.addEventListener('DOMContentLoaded', () => {
  if (!user) {
    document.getElementById('greeting').innerText = "User not found.";
    return;
  }

  document.getElementById('greeting').innerText =
    `Hello, ${user.first_name}${user.last_name ? ' ' + user.last_name : ''}!`;

  // Отправка данных на сервер
  fetch('/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, initData, platform })
  }).catch(console.error);
});
