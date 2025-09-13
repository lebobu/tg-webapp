// emailTemplates.js
const SPECIAL_PLANS = new Set(['Роутер','Сервер VPS']);

function escHtml(s=''){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function row(label, value){
  return `
    <tr>
      <td style="padding:8px 0;color:#6b7280;vertical-align:top;">${escHtml(label)}</td>
      <td style="padding:8px 0; font-weight:600; color:#111;">${escHtml(value ?? '-')}</td>
    </tr>`;
}

function buildHtml({ brand, order, variant='user' }){
  const {
    name = 'Сервис Вялого Пингвина',
    logo = '',           // URL логотипа
    primary = '#0a84ff', // основной цвет
    supportEmail = ''
  } = brand || {};

  const {
    plan, accounts, duration, email, subscribe, pricing,
    userId, chatId
  } = order || {};

  const showAccounts = !SPECIAL_PLANS.has(plan);
  const totalStr = pricing?.total != null ? String(pricing.total) : '—';

  const title = variant === 'admin' ? 'Новая заявка' : 'Ваша заявка принята';
  const subject = variant === 'admin'
    ? `Новая заявка: ${plan}${duration ? `, ${duration} мес.` : ''}`
    : `Заявка принята: ${plan}${duration ? `, ${duration} мес.` : ''}`;

  const preheader = variant === 'admin'
    ? `Тариф: ${plan}. Итого: ${totalStr}`
    : `Спасибо! Мы получили вашу заявку. Итого: ${totalStr}`;

  // основной контент таблицы
  let details = '';
  details += row('Тариф', plan || '-');
  if (showAccounts) details += row('Аккаунтов', accounts || '-');
  details += row('Срок', duration ? `${duration} мес.` : '-');
  details += row('Email', email || '-');
  details += row('Подписка', subscribe ? 'включена' : 'нет');
  if (pricing?.total != null) details += row('Итого', `${totalStr} руб.`);

  // техническая информация (админу полезно)
  let tech = '';
  if (variant === 'admin') {
    if (userId) tech += row('User ID', String(userId));
    if (chatId) tech += row('Chat ID', String(chatId));
  }

  const footerNote = supportEmail
    ? `Возникли вопросы? Напишите на <a href="mailto:${escHtml(supportEmail)}" style="color:${primary};text-decoration:none">${escHtml(supportEmail)}</a>.`
    : 'Если это письмо пришло вам по ошибке, просто игнорируйте его.';

  const logoBlock = logo
    ? `<tr><td align="center" style="padding:18px 0 6px;">
         <img src="${escHtml(logo)}" width="160" height="auto" alt="${escHtml(name)}" style="display:block;border:0;outline:none;text-decoration:none;max-width:160px;">
       </td></tr>`
    : '';

  // HTML письмо (адаптивное, без внешних стилей)
  const html = `
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta name="color-scheme" content="light only">
  <title>${escHtml(subject)}</title>
  <style>
    @media (max-width: 620px){
      .container{ width:100% !important; }
      .card{ border-radius:12px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;">
  <!-- preheader (скрытый) -->
  <div style="display:none;visibility:hidden;opacity:0;overflow:hidden;height:0;width:0;color:transparent;">
    ${escHtml(preheader)}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f7fb;">
    <tr><td align="center" style="padding:24px 12px;">
      <table class="container" role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;">
        ${logoBlock}
        <tr><td>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                 class="card"
                 style="background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(17,24,39,.06);">
            <tr>
              <td style="padding:18px 20px 0;">
                <h1 style="margin:0 0 4px;font:700 18px/1.3 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#111;">${escHtml(title)}</h1>
                <div style="font:13px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#6b7280;">
                  ${escHtml(name)}
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:12px 20px 4px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                  ${details}
                  ${tech ? `<tr><td colspan="2" style="padding-top:8px;border-top:1px solid #eef1f4"></td></tr>${tech}` : ''}
                </table>
              </td>
            </tr>

            ${pricing?.total != null ? `
            <tr>
              <td style="padding:6px 20px 18px;">
                <div style="margin-top:8px;padding:10px 12px;border-radius:10px;background:#f7f9ff;border:1px solid #e3edff;color:#111;">
                  <span style="display:inline-block;font-weight:700;">Итого к оплате:</span>
                  <span style="display:inline-block;margin-left:8px;color:${primary};font-weight:700;">${escHtml(totalStr)} руб.</span>
                </div>
              </td>
            </tr>` : ''}

          </table>
        </td></tr>

        <tr><td align="center" style="padding:12px 6px 0;">
          <div style="font:12px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#6b7280;">
            ${footerNote}
          </div>
        </td></tr>

        <tr><td align="center" style="padding:10px 6px 20px;">
          <div style="font:11px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#9ca3af;">
            © ${new Date().getFullYear()} ${escHtml(name)}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  // Plain-text fallback
  const text =
`${title}

Тариф: ${plan || '-'}
${showAccounts ? `Аккаунтов: ${accounts || '-'}` : ''}
Срок: ${duration ? `${duration} мес.` : '-'}
Email: ${email || '-'}
Подписка: ${subscribe ? 'включена' : 'нет'}
${pricing?.total != null ? `Итого: ${totalStr} руб.` : ''}

    <summary><span>Как оплатить заказ</span></summary>
    <div class="acc-body">
      <ul>
        <li>Через СБП по номеру +79957979609</li>
        <li>По номеру банковской карты 5536090318609271</li>
        <li>Совкомбанк Владимир А.</li>
      </ul>
    </div>

${variant === 'admin'
  ? [(userId ? `User ID: ${userId}` : ''), (chatId ? `Chat ID: ${chatId}` : '')].filter(Boolean).join('\n')
  : ''}`.replace(/\n{3,}/g, '\n\n');

  return { subject, html, text };
}

function buildOrderEmail({ brand, order }){
  return {
    admin: buildHtml({ brand, order, variant:'admin' }),
    user:  buildHtml({ brand, order, variant:'user'  }),
  };
}

module.exports = { buildOrderEmail };
