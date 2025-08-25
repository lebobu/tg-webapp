// server.js
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express     = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path        = require('path');

const BOT_TOKEN  = process.env.BOT_TOKEN;
const SERVER_URL = process.env.SERVER_URL;
const PORT       = process.env.PORT || 3000;

if (!BOT_TOKEN)  throw new Error('BOT_TOKEN is not set');
if (!SERVER_URL) throw new Error('SERVER_URL is not set');

const bot = new TelegramBot(BOT_TOKEN);
bot.setWebHook(`${SERVER_URL}/telegram-webhook`);

const app = express();

// middlewares
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// статика WebApp
app.use(express.static(path.join(__dirname, 'public')));

// контроллеры
const telegramController = require('./controllers/telegramController')(bot);

// подписки бота
bot.onText(/\/start(?:\s|$)/, telegramController.onStartCommand);
bot.onText(/\/id(?:\s|$)/, telegramController.onIdCommand);

// вебхук
app.post('/telegram-webhook', telegramController.onWebhook);

// опционально оставляем старый путь (если когда-то решите слать fetch/beacon)
app.post('/data', telegramController.onWebAppData);

// НОВОЕ: endpoint для inline-кнопки → answerWebAppQuery
app.post('/webapp-answer', telegramController.onWebAppAnswer);

// health
app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
