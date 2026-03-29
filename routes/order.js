const express = require('express');
const router = express.Router();

const { upsertCustomer, appendOrder } = require('../googleSheets');

const SPECIAL_PLANS = new Set(['Роутер', 'Сервер VPS']);

router.post('/order', async (req, res) => {
  try {
    const { form, pricing, email } = req.body || {};

    const plan     = form?.plan ?? '-';
    const accounts = form?.accounts ?? '-';
    const duration = form?.duration ?? '-';
    const emailStr = (email || form?.email || '').trim();

    // можно генерить user_id как timestamp или uuid
    const user_id = Date.now().toString();

    // запись в таблицу
    await upsertCustomer({
      user_id,
      username: '',
      email: emailStr
    });

    await appendOrder({
      user_id,
      username: '',
      email: emailStr,
      plan,
      accounts: SPECIAL_PLANS.has(plan) ? '-' : accounts,
      duration,
      total: pricing?.total,
      subscribe: false,
      query_id: '',
      chat_id: ''
    });

    res.json({ ok: true });

  } catch (e) {
    console.error('order error:', e);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;