// controllers/telegramController.js
const chatStore = require('../chatStore'); // если не используете — удалите эту строку и вызовы chatStore.*

function escMd(s = '') {
  return String(s).replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

// Без форматирования и без "Экономия"
function buildPriceLines(pricing) {
  if (!pricing) return [];
  const lines = [
    `• *Итого:* ${escMd(pricing.total)}`,
    // `• *Ежемесячно:* ${escMd(pricing.monthlyAfter)}`
  ];
/*   const extras = [];
  if (pricing.baseMonthly !== undefined) extras.push(`база ${pricing.baseMonthly}`);
  if (pricing.discount !== undefined)     extras.push(`скидка ${pricing.discount}`);
  if (extras.length) lines[1] += ` _(${escMd(extras.join(', '))})_`;
 */  return lines;
}

module.exports = (bot) => ({

  // /start — inline-кнопка с web_app (вариант B)
  onStartCommand: async (msg) => {
    const url = process.env.SERVER_URL;
    try { await chatStore.set(msg.from.id, msg.chat.id); } catch (_) {}
    bot.sendMessage(
      msg.chat.id,
      'Перейти для оформления заказа\n Нажмите ❓ в каталоге, если возникают вопросы',
      {
        reply_markup: {
          inline_keyboard: [[{ text: 'Открыть каталог', web_app: { url } }]]
        }
      }
    );
  },

  // общий listener — обновляем маппинг user→chat на любое сообщение
  onAnyMessage: async (msg) => {
    try { await chatStore.set(msg.from.id, msg.chat.id); } catch (_) {}
  },

  // /id
  onIdCommand: (msg) => {
    bot.sendMessage(msg.chat.id, `Ваш chat_id: ${msg.chat.id}`);
  },

  // webhook
  onWebhook: (req, res) => {
    try { bot.processUpdate(req.body); res.sendStatus(200); }
    catch (e) { console.error('onWebhook error:', e); res.sendStatus(500); }
  },

  // (опционально) поток /data
  onWebAppData: async (req, res) => {
    try {
      const { user, initData, platform, form, pricing } = req.body || {};
      if (!user?.id) return res.status(400).json({ ok: false, error: 'no user.id' });

      const lines = [
        '🔔 *WebApp (/data):*',
        `• *Name:* ${escMd([user.first_name, user.last_name].filter(Boolean).join(' ') || 'N/A')}`,
        `• *Username:* ${escMd(user.username ? '@' + user.username : 'N/A')}`,
        `• *Platform:* ${escMd(platform || 'N/A')}`,
      ];

      if (form && typeof form === 'object') {
        lines.push('• *Выбор:*', '`' + escMd(JSON.stringify(form)) + '`');
      } else {
        lines.push(`• *initData:* \`${escMd(String(initData || '').slice(0, 1500))}\``);
      }

      // 👉 добавляем цену БЕЗ форматирования и без "Экономия"
      lines.push(...buildPriceLines(pricing));

      await bot.sendMessage(user.id, lines.join('\n'), { parse_mode: 'Markdown' });
      res.json({ ok: true });
    } catch (e) {
      console.error('onWebAppData error:', e);
      res.status(500).json({ ok: false });
    }
  },

  // Вариант B: inline-кнопка → фронт шлёт { query_id, from_id, data } → answerWebAppQuery + обычное сообщение
  onWebAppAnswer: async (req, res) => {
    try {
      const { query_id, from_id, data } = req.body || {};
      if (!query_id) return res.status(400).json({ ok: false, error: 'no query_id' });

      const SPECIAL_PLANS = new Set(['Роутер','Сервер VPS']);
      const plan     = data?.plan ?? '-';
      const accounts = data?.accounts ?? '-';
      const duration = data?.duration ?? '-';
      const pricing  = data?.pricing; // ожидаем { total, monthlyAfter, baseMonthly, discount, ... }
      const email    = data?.email ?? '-';

      const baseLines = [
        '✅ *Заявка подтверждена*',
        `• *Тариф:* ${escMd(plan)}`,
         // показываем "Аккаунтов" только если НЕ спец-план
        ...(SPECIAL_PLANS.has(plan) ? [] : [`• *Аккаунтов:* ${escMd(accounts)}`]),
        `• *Срок:* ${escMd(duration)} мес.`,
        `• *Email:* ${escMd(email)}`
      ];
      const priceLines = buildPriceLines(pricing); // без форматирования и экономии

      const text = [...baseLines, ...priceLines].join('\n');

      // 1) Ответ на inline-запрос (сообщение появится в чате)
      await bot.answerWebAppQuery(query_id, {
        type: 'article',
        id: String(Date.now()),
        title: 'Заявка подтверждена',
        input_message_content: { message_text: text, parse_mode: 'Markdown' }
      });

      // 2) Параллельно — обычное сообщение от бота (если знаем chat_id)
      if (from_id) {
        try {
          const chatId = await chatStore.get(from_id);
          if (chatId) {
            await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
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

