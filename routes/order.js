const express = require('express');
const router = express.Router();

const { sendMail } = require('../mailer');
const { buildOrderEmail } = require('../emailTemplates');
const { appendOrder, upsertCustomer, getCustomerByEmail } = require('../googleSheets');
const { sendTelegramAdminOrderAlert } = require('../telegramNotifier');

router.post('/order', async (req, res) => {
  try {
    const {
      form = {},
      pricing = {},
      customer = {},
      email = ''
    } = req.body || {};

    const orderId = `WEB-${Date.now()}`;

    const order = {
      id: orderId,

      plan: form.plan || '-',
      duration: form.duration || '-',
      accounts: form.accounts || '-',
      os: form.os || '-',

      email: email || customer.email || '',
      name: customer.name || '',
      phone: customer.phone || '',

      pricing
    };

    // =========================
    // GOOGLE SHEETS
    // =========================

    try {
      // РџСЂРѕРІРµСЂСЏРµРј СЃСѓС‰РµСЃС‚РІРѕРІР°РЅРёРµ РєР»РёРµРЅС‚Р° РїРѕ email
      // upsertCustomer СЃР°Рј РЅР°Р№РґС‘С‚ Р·Р°РїРёСЃСЊ Рё СѓРІРµР»РёС‡РёС‚ order_count
      await upsertCustomer({
        user_id: orderId,   // РґР»СЏ РЅРѕРІС‹С… РєР»РёРµРЅС‚РѕРІ вЂ” orderId РєР°Рє id
        username: order.name || '',
        email: order.email
      });

      // Р—Р°РїРёСЃС‹РІР°РµРј Р·Р°РєР°Р· РІ Р»РёСЃС‚ Orders
      await appendOrder({
        email: order.email,
        plan: order.plan,
        accounts: order.accounts,
        duration: order.duration,
        os: order.os,
        total: pricing.total,
        subscribe: false
      });
    } catch (sheetsErr) {
      console.warn('Google Sheets write failed:', sheetsErr.message);
    }

    const BRAND = {
      name:         process.env.BRAND_NAME || 'Web Service',
      logo:         process.env.BRAND_LOGO_URL || '',
      primary:      process.env.BRAND_PRIMARY || '#0a84ff',
      supportEmail: process.env.SUPPORT_EMAIL || ''
    };

    const { admin, user } = buildOrderEmail({ brand: BRAND, order });

    // =========================
    // ADMIN EMAIL
    // =========================

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    if (ADMIN_EMAIL) {
      await sendMail({
        to: ADMIN_EMAIL,
        subject: admin.subject,
        text: admin.text,
        html: admin.html
      });
    }

    // =========================
    // USER EMAIL
    // =========================

    if (order.email) {
      await sendMail({
        to: order.email,
        subject: user.subject,
        text: user.text,
        html: user.html
      });
    }

    // =========================
    // TELEGRAM ADMIN ALERT
    // =========================
    try {
      await sendTelegramAdminOrderAlert(order.id);
    } catch (tgErr) {
      console.warn('Telegram notify failed:', tgErr.message);
    }

    res.json({ ok: true, orderId });

  } catch (err) {
    console.error('ORDER ERROR:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

module.exports = router;

