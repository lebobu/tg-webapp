// controllers/telegramController.js
const chatStore = require('../chatStore'); // если не используете — удалите эту строку и вызовы chatStore.*
const { sendMail } = require('../mailer'); // <-- новый импорт для отправки e-mail

// список админов из окружения (через запятую)
const ADMIN_IDS = (process.env.ADMIN_CHAT_IDS || process.env.ADMIN_CHAT_ID || '')
  .split(/[,\s]+/)
  .map(x => x.trim())
  .filter(Boolean);

// e-mail админа для писем
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim();

function escMd(s = '') {
  return String(s).replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}
function escHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

// Без форматирования и без "Экономия"
function buildPriceLines(pricing) {
  if (!pricing) return [];
  return [`• *Итого:* ${escMd(pricing.total)} руб.`];
}

async function notifyAdmins(bot, lines) {
  if (!ADMIN_IDS.length) return;
  const text = ['🛎 *Новая заявка*', ...lines].join('\n');
  for (const adminId of ADMIN_IDS) {
    try {
      await bot.sendMessage(adminId, text, { parse_mode: 'Markdown' });
    } catch (e) {
      console.warn('notifyAdmins failed for', adminId, e.message);
    }
  }
}

const SPECIAL_PLANS = new Set(['Роутер','Сервер VPS']);

// Формирование письма (админу и пользователю)
function makeEmailContent({ plan, accounts, duration, email, subscribe, pricing, userId, chatId }) {
  const rows = [
    ['Тариф', plan],
    ...(SPECIAL_PLANS.has(plan) ? [] : [['Аккаунтов', accounts]]),
    ['Срок', duration ? `${duration} мес.` : '-'],
    ['Email', email || '-'],
    ['Подписка', subscribe ? 'включена' : 'нет'],
    ...(pricing ? [['Итого', `${pricing.total} руб.`]] : []),
  ];

  const subject = `Новая заявка: ${plan}${duration ? `, ${duration} мес.` : ''}`;
  const text =
    `Новая заявка\n\n` +
    rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
    (userId ? `\n\nUser ID: ${userId}` : '') +
    (chatId ? `\nChat ID: ${chatId}` : '');

  const html =
    `<h3>Новая заявка</h3>` +
    `<table border="0" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif">` +
    rows
      .map(
        ([k, v]) =>
          `<tr><td style="color:#6b7280">${escHtml(k)}</td><td><b>${escHtml(String(v))}</b></td></tr>`
      )
      .join('') +
    `</table>` +
    (userId || chatId
      ? `<p style="color:#6b7280">` +
        (userId ? `User ID: <code>${escHtml(String(userId))}</code><br>` : '') +
        (chatId ? `Chat ID: <code>${escHtml(String(chatId))}</code>` : '') +
        `</p>`
      : '');

  return { subject, text, html };
}

async function emailAdminsAndUser(payload) {
  try {
    const { plan, accounts, duration, email, subscribe, pricing, userId, chatId } = payload;
    const { subject, text, html } = makeEmailContent({
      plan, accounts, duration, email, subscribe, pricing, userId, chatId
    });

    // админу
    if (ADMIN_EMAIL) {
      await sendMail({ to: ADMIN_EMAIL, subject, text, html });
    }

    // пользователю (если валиден e-mail)
    if (email && isValidEmail(email)) {
      await sendMail({ to: email, subject: 'Ваша заявка принята', text, html });
    }
  } catch (e) {
    console.warn('emailAdminsAndUser failed:', e.message);
  }
}

module.exports = (bot) => ({

  // /start — inline-кнопка с web_app (вариант B)
  onStartCommand: async (msg) => {
    const url = process.env.SERVER_URL;
    try { await chatStore.set(msg.from.id, msg.chat.id); } catch (_) {}
    bot.sendMessage(
      msg.chat.id,
      'Перейти для оформления заказа\nЕсть вопросы — нажмите ❓ в каталоге',
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
      const { user, platform, form, pricing, email, subscribe } = req.body || {};
      if (!user?.id) return res.status(400).json({ ok: false, error: 'no user.id' });

      const plan     = form?.plan ?? '-';
      const accounts = form?.accounts ?? '-';
      const duration = form?.duration ?? '-';
      const emailStr = email || form?.email || '-';
      const subs     = !!subscribe;

      const base = [
        `• *Тариф:* ${escMd(plan)}`,
        ...(SPECIAL_PLANS.has(plan) ? [] : [`• *Аккаунтов:* ${escMd(accounts)}`]),
        `• *Срок:* ${escMd(duration)} мес.`,
        `• *Email:* ${escMd(emailStr)}`,
        `• *Подписка:* ${subs ? 'включена' : 'нет'}`,
        `• *Платформа:* ${escMd(platform || 'N/A')}`,
        `• *User ID:* ${escMd(user.id)}`
      ];
      const price = buildPriceLines(pricing);

      // пользователю
      await bot.sendMessage(
        user.id,
        ['✅ *Заявка подтверждена*', ...base, ...price].join('\n'),
        { parse_mode: 'Markdown' }
      );

      // админам в Telegram
      await notifyAdmins(bot, [
        ...base,
        ...price,
        `• *Chat ID:* ${await chatStore.get(user.id) || '—'}`
      ]);

      // письма админу и пользователю
      await emailAdminsAndUser({
        plan,
        accounts,
        duration,
        email: emailStr,
        subscribe: subs,
        pricing,
        userId: user.id,
        chatId: await chatStore.get(user.id)
      });

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

      const plan      = data?.plan ?? '-';
      const accounts  = data?.accounts ?? '-';
      const duration  = data?.duration ?? '-';
      const pricing   = data?.pricing; // { total, ... }
      const email     = data?.email ?? '-';
      const subscribe = !!data?.subscribe;

      const baseLines = [
        '✅ *Заявка подтверждена!*',
        `• *Тариф:* ${escMd(plan)}`,
        ...(SPECIAL_PLANS.has(plan) ? [] : [`• *Аккаунтов:* ${escMd(accounts)}`]),
        `• *Срок:* ${escMd(duration)} мес.`,
        `• *Email:* ${escMd(email)}`,
        `• *Подписка:* ${subscribe ? 'включена' : 'нет'}`
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
      let chatId = null;
      if (from_id) {
        try {
          chatId = await chatStore.get(from_id);
          if (chatId) {
            await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
          }
        } catch (e) {
          console.warn('sendMessage fallback failed:', e);
        }
      }

      // 3) Отправить summary админам (Telegram)
      await notifyAdmins(bot, [
        ...baseLines,
        ...priceLines,
        `• *User ID:* ${from_id || '—'}`,
        `• *Chat ID:* ${chatId || (from_id && await chatStore.get(from_id)) || '—'}`
      ]);

      // 4) E-mail админу и пользователю
      await emailAdminsAndUser({
        plan,
        accounts: SPECIAL_PLANS.has(plan) ? '-' : accounts,
        duration,
        email,
        subscribe,
        pricing,
        userId: from_id,
        chatId
      });

      res.json({ ok: true });
    } catch (e) {
      console.error('answerWebAppQuery error:', e);
      res.status(500).json({ ok: false });
    }
  },

});
