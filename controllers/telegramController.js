// controllers/telegramController.js

function escMd(s = '') {
  return String(s).replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

module.exports = (bot) => ({

  // /start — показываем ИМЕННО inline_keyboard с web_app (для варианта B)
  onStartCommand: (msg) => {
    const url = process.env.SERVER_URL; // ваш публичный https хост, где открыт WebApp
    bot.sendMessage(
      msg.chat.id,
      'Откройте мини-приложение по кнопке ниже, пройдите мастер и подтвердите:',
      {
        reply_markup: {
          inline_keyboard: [[{
            text: 'Открыть каталог',
            web_app: { url }     // ВАЖНО: inline-кнопка
          }]]
        }
      }
    );
  },

  // /id — быстрый способ узнать chat_id
  onIdCommand: (msg) => {
    bot.sendMessage(msg.chat.id, `Ваш chat_id: ${msg.chat.id}`);
  },

  // Telegram webhook → прокидываем апдейты в node-telegram-bot-api
  onWebhook: (req, res) => {
    try {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    } catch (e) {
      console.error('onWebhook error:', e);
      res.sendStatus(500);
    }
  },

  // Оставляем совместимость: если когда-то пошлёте данные через /data
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
        lines.push(`• *initData:* \`${escMd(String(initData || '').slice(0, 1500))}\``);
      }

      await bot.sendMessage(user.id, lines.join('\n'), { parse_mode: 'Markdown' });
      res.json({ ok: true });
    } catch (e) {
      console.error('onWebAppData error:', e);
      res.status(500).json({ ok: false });
    }
  },

  // НОВОЕ: обработчик варианта B — ответ через answerWebAppQuery по query_id
  onWebAppAnswer: async (req, res) => {
    try {
      const { query_id, data } = req.body || {};
      if (!query_id) return res.status(400).json({ ok: false, error: 'no query_id' });

      // ожидаем структуру { plan, accounts, duration } из wizard.js
      const plan     = data?.plan ?? '-';
      const accounts = data?.accounts ?? '-';
      const duration = data?.duration ?? '-';

      const text = [
        '✅ *Заявка подтверждена*',
        `• *Тариф:* ${escMd(plan)}`,
        `• *Аккаунтов:* ${escMd(accounts)}`,
        `• *Срок:* ${escMd(duration)} мес.`,
      ].join('\n');

      // Ответ пользователю: сообщение появится В ЧАТЕ, где нажали inline-кнопку
      await bot.answerWebAppQuery(query_id, {
        type: 'article',
        id: String(Date.now()),
        title: 'Заявка подтверждена',
        input_message_content: {
          message_text: text,
          parse_mode: 'Markdown'
        }
      });

      res.json({ ok: true });
    } catch (e) {
      console.error('answerWebAppQuery error:', e);
      res.status(500).json({ ok: false });
    }
  },

});
