const https = require('https');

function sendTelegramAdminOrderAlert(orderId) {
  const botToken = process.env.BOT_TOKEN;
  const chatId = process.env.ADMIN_CHAT_IDS;

  if (!botToken || !chatId) return Promise.resolve(false);

  const postData = JSON.stringify({
    chat_id: chatId,
    text: `Новый заказ: ${orderId}`,
    disable_web_page_preview: true
  });

  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${botToken}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
          return;
        }
        reject(new Error(`Telegram API ${res.statusCode}: ${body}`));
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = { sendTelegramAdminOrderAlert };
