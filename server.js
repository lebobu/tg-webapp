// server.js
require('dotenv').config({
  path: require('path').join(__dirname, '.env')
});

const express = require('express');
const path = require('path');

const orderRoute = require('./routes/order');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// MIDDLEWARE
// =========================
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// STATIC
app.use(express.static(path.join(__dirname, 'public')));

// API
app.use('/api', orderRoute);

// HEALTHCHECK
app.get('/health', (_, res) => {
  res.json({ ok: true, mode: 'web-only' });
});

// =========================
// TELEGRAM CODE DISABLED
// =========================

// const TelegramBot = require('node-telegram-bot-api');
// const BOT_TOKEN  = process.env.BOT_TOKEN;
// const SERVER_URL = process.env.SERVER_URL;
// const bot = new TelegramBot(BOT_TOKEN);
// bot.setWebHook(`${SERVER_URL}/telegram-webhook`);
// const telegramController = require('./controllers/telegramController')(bot);
// bot.onText(/\/start(?:\s|$)/, telegramController.onStartCommand);
// bot.onText(/\/id(?:\s|$)/, telegramController.onIdCommand);
// bot.on('message', telegramController.onAnyMessage);
// app.post('/telegram-webhook', telegramController.onWebhook);
// app.post('/data', telegramController.onWebAppData);
// app.post('/webapp-answer', telegramController.onWebAppAnswer);
// app.post('/prefill-email', telegramController.prefillEmail);

// =========================
// START
// =========================
app.listen(PORT, () => {
  console.log(`🚀 Web server started on port ${PORT}`);
});