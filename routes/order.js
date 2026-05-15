const express = require('express');
const router = express.Router();

const { sendMail } = require('../mailer');
const { buildOrderEmail } = require('../emailTemplates');
const { appendOrder, upsertCustomer, getCustomerByEmail } = require('../googleSheets');

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
      // Проверяем существование клиента по email
      // upsertCustomer сам найдёт запись и увеличит order_count
      await upsertCustomer({
        user_id: orderId,   // для новых клиентов — orderId как id
        username: order.name || '',
        email: order.email
      });

      // Записываем заказ в лист Orders
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

    res.json({ ok: true, orderId });

  } catch (err) {
    console.error('ORDER ERROR:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

module.exports = router;
