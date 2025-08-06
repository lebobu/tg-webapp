// script.js
const tg = window.Telegram.WebApp;

// let the WebApp expand to full height
tg.expand();

// when button is clicked, grab user info and send it
document.getElementById('send_btn').addEventListener('click', () => {
  const user = tg.initDataUnsafe.user || {};
  console.log('🧪 Sending user data:', user);

  // send user JSON as string to bot
  tg.sendData(JSON.stringify(user));

  // close WebApp to trigger update to bot
  tg.close();
});
