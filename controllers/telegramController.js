// controllers/telegramController.js
const chatStore = require('../chatStore');
const { sendMail } = require('../mailer');
const { buildOrderEmail } = require('../emailTemplates');
const { upsertCustomer, appendOrder } = require('../googleSheets');

// PAYMENT_NOTE можно задать в .env
//const PAYMENT_NOTE = (process.env.PAYMENT_NOTE || '').trim();
// const UserExtraText = [
//   '💳 *Оплата*',
//   'Переводом СБП ',
//   mdBoldCode('+79777419609'),
//   'или по номеру банковской карты ',
//   mdBoldCode('5536090318609271'),
//   'Совкомбанк',
//   'Получатель: Владимир А',
//   'Проверьте, что вам доходят письма на указанную в заявке эл.почту, а не попадают в спам!',
//   'Рабочие ссылки для скачивания приложений:',
//   'Android: https://play.google.com/store/apps/details?id=app.hiddify.com&pcampaignid=web_share',
//   'iOS: https://apps.apple.com/ru/app/fair-vpn/id1533873488'
// ].join('\n');

// Вспомогательная функция для экранирования спецсимволов MarkdownV2
const escsimb = (s = '') => String(s).replace(/[_*[\]()~`>#\-=|{}.!]/g, '\\$&');

const UserExtraText = [
  '💳 ' + mdBoldCode('Оплата'),
  escsimb('Переводом СБП '),
  mdBoldCode('+79777419609'),
  escsimb('или по номеру банковской карты '),
  mdBoldCode('5536090318609271'),
  escsimb('Совкомбанк'),
  escsimb('Получатель: Владимир А'),
  '', // Пустая строка для красоты
  escsimb('Проверьте, что письма доходят на почту, а не попадают в спам!'),
  '',
  escsimb('Рабочие ссылки для скачивания:'),
  // Используем формат [Название](ссылка) — это надежнее всего
  '• [Android \\- Hiddify](https://play.google.com/store/apps/details?id=app.hiddify.com)',
  '',
  '• [iOS \\- Fair VPN](https://apps.apple.com/ru/app/fair-vpn/id1533873488)',
  ''
].join('\n');

function mdBoldCode(s = '') {
  // Экранируем содержимое и оборачиваем в звездочки для жирности
  return '*' + escsimb(String(s).replace(/`/g, '')) + '*';
}
// function buildPaymentNote(pricing) {
//   const lines = ['', '———', '💳 *Оплата*'];
//   if (pricing?.total != null) lines.push(`${escsimbMd(pricing.total)} руб.`);
//   lines.push(escsimbMd(PAYMENT_NOTE || 'После подтверждения мы пришлём реквизиты в чат и на e-mail'));
//   return lines.join('\n');
// }

function buildUserExtraText() {
  if (!UserExtraText) return '';
  return ['','———', UserExtraText].join('\n');
}

// function mdCode(s = '') {
//   return '`' + String(s).replace(/`/g, '') + '`';
// }

// function mdBoldCode(s = '') {
//   // return '*`' + String(s).replace(/`/g, '') + '`*';
//   return '*' + String(s).replace(/`/g, '') + '*';
// }

const ADMIN_IDS = (process.env.ADMIN_CHAT_IDS || process.env.ADMIN_CHAT_ID || '')
  .split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim();

const BRAND = {
  name: process.env.BRAND_NAME || 'Сервис Вялого Пингвина',
  logo: process.env.BRAND_LOGO_URL || '',
  primary: process.env.BRAND_PRIMARY || '#0a84ff',
  supportEmail: process.env.SUPPORT_EMAIL || ''
};

function escsimbMd(s = '') { return String(s).replace(/([_*[\]()~`>#+\=|{}])/g, '\\$1'); }
function isValidEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim()); }
function buildPriceLines(pricing){ return pricing ? [`• *Итого:* ${escsimbMd(pricing.total)} руб.`] : []; }
function asUsername(u){ const v=(u||'').toString().trim(); return v?('@'+v.replace(/^@/,'')):'none'; }

async function notifyAdmins(bot, lines){
  if (!ADMIN_IDS.length) return;
  const text = ['🛎 *Новая заявка*', ...lines].join('\n');
  for (const id of ADMIN_IDS) {
    try { await bot.sendMessage(id, text, { parse_mode: 'Markdown' }); }
    catch (e) { console.warn('notifyAdmins failed:', id, e.message); }
  }
}

const SPECIAL_PLANS = new Set(['Роутер', 'Сервер VPS']);

async function emailAdminsAndUser({ order }) {
  try {
    const { admin, user } = buildOrderEmail({ brand: BRAND, order });
    if (ADMIN_EMAIL) await sendMail({ to: ADMIN_EMAIL, subject: admin.subject, text: admin.text, html: admin.html });
    if (order.email && isValidEmail(order.email)) {
      await sendMail({ to: order.email, subject: user.subject, text: user.text, html: user.html });
    }
  } catch (e) { console.warn('emailAdminsAndUser failed:', e.message); }
}

module.exports = (bot) => ({

  onStartCommand: async (msg) => {
    const url = process.env.SERVER_URL;
    try { await chatStore.set(msg.from.id, msg.chat.id); } catch {}
    bot.sendMessage(
  msg.chat.id,
  'Перейдите в Каталог для оформления заказа\nДля справки нажмите кнопку Помощь или❓в каталоге',
  {
    reply_markup: {
      inline_keyboard: [
      [
        { text:'Каталог 📖', web_app:{ url } },
        { text:'Помощь ❓', url:url + '/help.html'}
      ]
    ]
    }
  }
);

  },

  onAnyMessage: async (msg) => { try { await chatStore.set(msg.from.id, msg.chat.id); } catch {} },

  onIdCommand: (msg) => { bot.sendMessage(msg.chat.id, `Ваш chat_id: ${msg.chat.id}`); },

  onWebhook: (req, res) => { try { bot.processUpdate(req.body); res.sendStatus(200); } catch(e){ console.error(e); res.sendStatus(500);} },

  // Если используете прямой POST /data
  onWebAppData: async (req, res) => {
    try {
      const { user, platform, form, pricing, email } = req.body || {};
      if (!user?.id) return res.status(400).json({ ok:false, error:'no user.id' });

      const plan     = form?.plan ?? '-';
      const accounts = form?.accounts ?? '-';
      const duration = form?.duration ?? '-';
      const emailStr = (email || form?.email || '').trim();

      const base = [
        `• *Тариф:* ${escsimbMd(plan)}`,
        ...(SPECIAL_PLANS.has(plan) ? [] : [`• *Аккаунтов:* ${escsimbMd(accounts)}`]),
        `• *Срок:* ${escsimbMd(duration)} мес.`,
        `• *Email:* ${escsimbMd(emailStr || '-')}`,
        `• *Платформа:* ${escsimbMd(platform || 'N/A')}`,
        `• *User ID:* ${escsimbMd(user.id)}`
      ];
      const price = buildPriceLines(pricing);
      const userText = ['✅ *Заявка подтверждена*', ...base, ...price, /*buildPaymentNote(pricing),*/ buildUserExtraText()].join('\n');
      await bot.sendMessage(user.id, userText, { parse_mode: 'Markdown' });

      let usernameVal = (user && user.username) || null;
      try { if (!usernameVal) { const ch = await bot.getChat(user.id); usernameVal = ch?.username || null; } } catch {}

      await notifyAdmins(bot, [
        ...base, ...price,
        `• *Username:* ${escsimbMd(asUsername(usernameVal))}`,
        `• *Chat ID:* ${escsimbMd((await chatStore.get(user.id)) ?? 'none')}`
      ]);

      // Google Sheets: апдейт покупателя + запись заказа
      try {
        await upsertCustomer({ user_id: user.id, username: usernameVal || '', email: emailStr });
        await appendOrder({
          user_id: user.id,
          username: usernameVal || '',
          email: emailStr,
          plan,
          accounts: SPECIAL_PLANS.has(plan) ? '-' : accounts,
          duration,
          total: pricing?.total,
          subscribe: false,
          query_id: '',
          chat_id: await chatStore.get(user.id) || ''
        });
      } catch (e) { console.warn('Sheets save failed:', e.message); }

      res.json({ ok:true });
    } catch (e) {
      console.error('onWebAppData error:', e);
      res.status(500).json({ ok:false });
    }
  },

  // Inline-поток: { query_id, from_id, data }
  onWebAppAnswer: async (req, res) => {
    try {
      const { query_id, from_id, data } = req.body || {};
      if (!query_id) return res.status(400).json({ ok:false, error:'no query_id' });

      const plan      = data?.plan ?? '-';
      const accounts  = data?.accounts ?? '-';
      const duration  = data?.duration ?? '-';
      const pricing   = data?.pricing;
      const email     = (data?.email || '').trim();

      const baseLines = [
        '✅ *Заявка подтверждена!*',
        `• *Тариф:* ${escsimbMd(plan)}`,
        ...(SPECIAL_PLANS.has(plan) ? [] : [`• *Аккаунтов:* ${escsimbMd(accounts)}`]),
        `• *Срок:* ${escsimbMd(duration)} мес.`,
        `• *Email:* ${escsimbMd(email || '-')}`
      ];
      const priceLines = buildPriceLines(pricing);
      const textForUser = [...baseLines, ...priceLines, /*buildPaymentNote(pricing),*/buildUserExtraText()].join('\n');
      // await bot.answerWebAppQuery(query_id, {
      //   type: 'article',
      //   id: String(Date.now()),
      //   title: 'Заявка подтверждена',
      //   input_message_content: { message_text: textForUser, parse_mode: 'Markdown' }
      // });

      let chatId = null;
      if (from_id) {
        try { chatId = await chatStore.get(from_id); if (chatId) await bot.sendMessage(chatId, textForUser, { parse_mode:'Markdown' }); }
        catch (e) { console.warn('sendMessage to user failed:', e.message); }
      }

      let usernameVal = null;
      if (from_id) { try { const ch = await bot.getChat(from_id); usernameVal = ch?.username || null; } catch {} }

      await notifyAdmins(bot, [
        ...baseLines, ...priceLines,
        `• *Username:* ${escsimbMd(asUsername(usernameVal))}`,
        `• *User ID:* ${from_id ?? 'none'}`,
        `• *Chat ID:* ${chatId || (from_id && await chatStore.get(from_id)) || 'none'}`
      ]);

      // Письма
      await emailAdminsAndUser({
        order: {
          plan,
          accounts: SPECIAL_PLANS.has(plan) ? '-' : accounts,
          duration,
          email,
          pricing,
          userId: from_id,
          chatId
        }
      });

      // Google Sheets
      try {
        await upsertCustomer({ user_id: from_id, username: usernameVal || '', email });
        await appendOrder({
          user_id: from_id,
          username: usernameVal || '',
          email,
          plan,
          accounts: SPECIAL_PLANS.has(plan) ? '-' : accounts,
          duration,
          total: pricing?.total,
          subscribe: false,
          query_id,
          chat_id: chatId || ''
        });
      } catch (e) { console.warn('Sheets save failed:', e.message); }

      res.json({ ok:true });
    } catch (e) {
      console.error('answerWebAppQuery error:', e);
      res.status(500).json({ ok:false });
    }
  },

});