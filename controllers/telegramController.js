// controllers/telegramController.js
const chatStore = require('../chatStore');

function escMd(s = '') {
  return String(s).replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

module.exports = (bot) => ({

  // /start — inline-кнопка с web_app (вариант B)
  onStartCommand: async (msg) => {
    const url = process.env.SERVER_URL;
    // сохраняем user_id → chat_id (полезно для последующей отправки обычного сообщения)
    try { await chatStore.set(msg.from.id, msg.chat.id); } catch (e) { console.warn('chatStore.set on /start failed:', e); }

    bot.sendMessage(
      msg.chat.id,
      'Откройте мини-приложение по кнопке ниже, пройдите мастер и подтвердите:',
      {
        reply_markup: {
          inline_keyboard: [[{
            text: 'Открыть каталог',
            web_app: { url }
          }]]
        }
      }
    );
  },

  // общий listener — обновляем маппинг user→chat на любое сообщение
  onAnyMessage: async (msg) => {
    try { await chatStore.set(msg.from.id, msg.chat.id); } catch (e) { /* no-op */ }
  },

  // /id — быстрый chat_id
  onIdCommand: (msg) => {
    bot.sendMessage(msg.chat.id, `Ваш chat_id: ${msg.chat.id}`);
  },

  // вебхук ноды
  onWebhook: (req, res) => {
    try {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    } catch (e) {
      console.error('onWebhook error:', e);
      res.sendStatus(500);
    }
  },

  // совместимость с вариантом fetch/beacon
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

  // ВАРИАНТ B: inline-кнопка → фронт шлёт query_id(+ from_id) → отвечаем в чат через answerWebAppQuery
  onWebAppAnswer: async (req, res) => {
    try {
      const { query_id, from_id, data } = req.body || {};
      if (!query_id) return res.status(400).json({ ok: false, error: 'no query_id' });

      const plan     = data?.plan ?? '-';
      const accounts = data?.accounts ?? '-';
      const duration = data?.duration ?? '-';

      const text = [
        '✅ *Заявка подтверждена*',
        `• *Тариф:* ${escMd(plan)}`,
        `• *Аккаунтов:* ${escMd(accounts)}`,
        `• *Срок:* ${escMd(duration)} мес.`,
      ].join('\n');

      // 1) обязательный ответ на inline-запрос
      // await bot.answerWebAppQuery(query_id, {
      //   type: 'article',
      //   id: String(Date.now()),
      //   title: 'Заявка подтверждена',
      //   input_message_content: { message_text: text, parse_mode: 'Markdown' }
      // });

      // 2) ДОПОЛНИТЕЛЬНО: обычное сообщение в чат (если знаем chat_id)
      if (from_id) {
        try {
          const chatId = await chatStore.get(from_id);
          if (chatId) {
            await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
          } else {
            console.warn('No chatId found for from_id:', from_id);
          }
        } catch (e) {
          console.warn('sendMessage fallback failed:', e);
        }
      }

      res.json({ ok: true });
    } catch (e) {
      console.error('answerWebAppQuery error:', e);
      res.status(500).json({ ok: false });
    }
  },

});
