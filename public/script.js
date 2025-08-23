// public/script.js
const tg = window.Telegram.WebApp;
tg.expand();

document.addEventListener('DOMContentLoaded', () => {
  const user = tg.initDataUnsafe?.user;
  const initData = tg.initData;
  const platform = tg.platform;

  if (!user) {
    document.getElementById('greeting').innerText = "User not found.";
    return;
  }

  document.getElementById('greeting').innerText =
    `Hello, ${user.first_name}${user.last_name ? ' ' + user.last_name : ''}!`;

  // Отправляем данные и закрываем
  const payload = { user, initData, platform };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  navigator.sendBeacon('/data', blob);

  tg.close(); // можно закрыть сразу
});

