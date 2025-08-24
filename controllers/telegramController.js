// controllers/telegramController.js
function escMd(s = '') {
  return String(s).replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

module.exports = (bot) => ({
  onStartCommand: (msg) => {
    bot.sendMessage(msg.chat.id, 'Нажмите кнопку Каталог', {
      reply_markup: {
        inline_keyboard: [[{
          text: 'Открыть каталог',
          web_app: { url: process.env.SERVER_URL }
        }]]
      }
    });
  },

  onWebhook: (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  },

  // Оставляем путь POST /data на случай использования fetch/beacon c фронта
  onWebAppData: async (req, res) => {
    try {
      const { user, initData, platform, form } = req.body || {};
      if (!user?.id) return res.status(400).json({ ok: false, error: 'no user.id' });

      const lines = [
        '🔔 *WebApp (/data):*',
        `• *Name:* ${escMd([user.first_name, user.last_name].filter(Boolean).join(' ') || 'N/A')}`,
        `• *Username:* ${escMd(user.username ? '@' + user.username : 'N/A')}`,
        `• *Platform:* ${escMd(platform || 'N/A')}`,
      ];
      if (form && typeof form === 'object') {
        lines.push('• *Form:*', '`' + escMd(JSON.stringify(form)) + '`');
      } else {
        lines.push(`• *initData:* \`${String(initData || '').slice(0, 1500)}\``);
      }

      await bot.sendMessage(user.id, lines.join('\n'), { parse_mode: 'Markdown' });
      res.json({ ok: true });
    } catch (e) {
      console.error('onWebAppData error:', e);
      res.status(500).json({ ok: false });
    }
  },

  // НОВОЕ: обработчик для tg.sendData(...) из wizard.js
  onWebAppMessage: async (msg) => {
    try {
      const payload = msg.web_app_data?.data;
      if (!payload) return; // обычные сообщения пропускаем

      const chatId = msg.chat.id;
      let data = {};
      try { data = JSON.parse(payload); } catch { data = { raw: String(payload) }; }

      const plan     = data.plan ?? '-';
      const accounts = data.accounts ?? '-';
      const duration = data.duration ?? '-';

      const text = [
        '✅ *Заявка подтверждена*',
        `• *Тариф:* ${escMd(plan)}`,
        `• *Аккаунтов:* ${escMd(accounts)}`,
        `• *Срок:* ${escMd(duration)} мес.`,
      ].join('\n');

      await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error('onWebAppMessage error:', e);
    }
  }
});
