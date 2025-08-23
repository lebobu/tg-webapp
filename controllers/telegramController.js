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

  onWebAppData: async (req, res) => {
    try {
      const { user, initData, platform } = req.body || {};
      if (!user?.id) return res.status(400).json({ ok: false, error: 'no user.id' });

      const chatId = user.id;
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'N/A';
      const username = user.username ? `@${user.username}` : 'N/A';

      const text = [
        '🔔 *Your WebApp Data:*',
        `• *Name:* ${escMd(fullName)}`,
        `• *Username:* ${escMd(username)}`,
        `• *Platform:* ${escMd(platform)}`,
        `• *initData:* \`${String(initData || '').slice(0, 1500)}\``
      ].join('\n');

      await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      res.json({ ok: true });
    } catch (err) {
      console.error('onWebAppData error:', err);
      res.status(500).json({ ok: false });
    }
  }
});
