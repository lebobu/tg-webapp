// controllers/telegramController.js
const chatStore = require('../chatStore');        // если не используете — удалите и вызовы chatStore.*
const { sendMail } = require('../mailer');        // nodemailer-обёртка (см. mailer.js)
const { buildOrderEmail } = require('../emailTemplates'); // НОВОЕ: «красивые» HTML-письма

/* ===================== ENV / CONFIG ===================== */

// Telegram-админы (ID через запятую)
const ADMIN_IDS = (process.env.ADMIN_CHAT_IDS || process.env.ADMIN_CHAT_ID || '')
  .split(/[,\s]+/)
  .map(x => x.trim())
  .filter(Boolean);

// Админский e-mail для писем
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim();

// Брендовые настройки для HTML-писем
const BRAND = {
  name:         process.env.BRAND_NAME     || 'Catalog Bot',
  logo:         process.env.BRAND_LOGO_URL || '',       // URL логотипа (PNG/SVG)
  primary:      process.env.BRAND_PRIMARY  || '#0a84ff',
  supportEmail: process.env.SUPPORT_EMAIL  || ''
};

/* ===================== HELPERS ===================== */

function escMd(s = '') {
  // важно: не экранируем точку (.) — иначе в e-mail будет \.
  return String(s).replace(/([_*[\]()~`>#+\-=|{}])/g, '\\$1');
}
function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

// Без форматирования и без "Экономии" — только итог
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

/* ===================== EMAIL SENDER (HTML CARD) ===================== */

async function emailAdminsAndUser({ order }) {
  try {
    // шаблоны для админа и пользователя
    const adminTpl = buildOrderEmail({ brand: BRAND, order }).admin;
    const userTpl  = buildOrderEmail({ brand: BRAND, order }).user;

    // админу
    if (ADMIN_EMAIL) {
      await sendMail({ to: ADMIN_EMAIL, subject: adminTpl.subject, text: adminTpl.text, html: adminTpl.html });
    }
    // пользователю
    if (order.email && isValidEmail(order.email)) {
      await sendMail({ to: order.email, subject: userTpl.subject, text: userTpl.text, html: userTpl.html });
    }
  } catch (e) {
    console.warn('emailAdminsAndUser failed:', e.message);
  }
}

/* ===================== CONTROLLER ===================== */

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
      const emailStr = (email || form?.email || '').trim();
      const subs     = !!subscribe;

      const base = [
        `• *Тариф:* ${escMd(plan)}`,
        ...(SPECIAL_PLANS.has(plan) ? [] : [`• *Аккаунтов:* ${escMd(accounts)}`]),
        `• *Срок:* ${escMd(duration)} мес.`,
        `• *Email:* ${escMd(emailStr || '-')}`,
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

      // письма админу и пользователю — ИСПОЛЬЗУЕМ НОВЫЙ ШАБЛОН
      await emailAdminsAndUser({
        order: {
          plan,
          accounts: SPECIAL_PLANS.has(plan) ? '-' : accounts,
          duration,
          email: emailStr,
          subscribe: subs,
          pricing,
          userId: user.id,
          chatId: await chatStore.get(user.id)
        }
      });

      res.json({ ok: true });
    } catch (e) {
      console.error('onWebAppData error:', e);
      res.status(500).json({ ok: false });
    }
  },

  // Вариант B: inline-кнопка → фронт шлёт { query_id, from_id, data }
  onWebAppAnswer: async (req, res) => {
    try {
      const { query_id, from_id, data } = req.body || {};
      if (!query_id) return res.status(400).json({ ok: false, error: 'no query_id' });

      const plan      = data?.plan ?? '-';
      const accounts  = data?.accounts ?? '-';
      const duration  = data?.duration ?? '-';
      const pricing   = data?.pricing; // { total, ... }
      const email     = (data?.email || '').trim();
      const subscribe = !!data?.subscribe;

      const baseLines = [
        '✅ *Заявка подтверждена!*',
        `• *Тариф:* ${escMd(plan)}`,
        ...(SPECIAL_PLANS.has(plan) ? [] : [`• *Аккаунтов:* ${escMd(accounts)}`]),
        `• *Срок:* ${escMd(duration)} мес.`,
        `• *Email:* ${escMd(email || '-')}`,
        `• *Подписка:* ${subscribe ? 'включена' : 'нет'}`
      ];
      const priceLines = buildPriceLines(pricing);
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

      // 4) E-mail админу и пользователю — ИСПОЛЬЗУЕМ НОВЫЙ ШАБЛОН
      await emailAdminsAndUser({
        order: {
          plan,
          accounts: SPECIAL_PLANS.has(plan) ? '-' : accounts,
          duration,
          email,
          subscribe,
          pricing,
          userId: from_id,
          chatId
        }
      });

      res.json({ ok: true });
    } catch (e) {
      console.error('answerWebAppQuery error:', e);
      res.status(500).json({ ok: false });
    }
  },

});
