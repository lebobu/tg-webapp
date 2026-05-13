const express = require('express');
const router = express.Router();

const { sendMail } = require('../mailer');
const { buildOrderEmail } = require('../emailTemplates');
const {
  upsertCustomer,
  appendOrder
} = require('../googleSheets');

const SPECIAL_PLANS = new Set([
  'Роутер',
  'Сервер VPS'
]);

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(s || '').trim()
  );
}

router.post('/order', async (req, res) => {
  try {
    const {
      form,
      pricing,
      email,
      customer
    } = req.body || {};

    const plan = form?.plan ?? '-';
    const accounts = form?.accounts ?? '-';
    const duration = form?.duration ?? '-';

    const emailStr = (
      email ||
      form?.email ||
      customer?.email ||
      ''
    ).trim();

    const customerName = (
      customer?.name || ''
    ).trim();

    const phone = (
      customer?.phone || ''
    ).trim();

    const orderId = `WEB-${Date.now()}`;

    // =========================
    // SAVE CUSTOMER
    // =========================
    await upsertCustomer({
      user_id: orderId,
      username: customerName,
      email: emailStr
    });

    // =========================
    // SAVE ORDER
    // =========================
    await appendOrder({
      user_id: orderId,
      username: customerName,
      email: emailStr,
      plan,
      accounts: SPECIAL_PLANS.has(plan)
        ? '-'
        : accounts,
      duration,
      total: pricing?.total,
      subscribe: false,

      // TELEGRAM FIELDS DISABLED
      // query_id: '',
      // chat_id: ''
    });
module.exports = router;