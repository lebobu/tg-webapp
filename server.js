// server.js v.2.10-2026
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express     = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path        = require('path');

const { getCustomerByUserId } = require('./googleSheets');

const BOT_TOKEN  = process.env.BOT_TOKEN;
const SERVER_URL = process.env.SERVER_URL;
const PORT       = process.env.PORT || 3000;

if (!BOT_TOKEN)  throw new Error('BOT_TOKEN is not set');
if (!SERVER_URL) throw new Error('SERVER_URL is not set');

const bot = new TelegramBot(BOT_TOKEN);
bot.setWebHook(`${SERVER_URL}/telegram-webhook`);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const telegramController = require('./controllers/telegramController')(bot);

// подписки бота
bot.onText(/\/start(?:\s|$)/, telegramController.onStartCommand);
bot.onText(/\/id(?:\s|$)/, telegramController.onIdCommand);
bot.on('message', telegramController.onAnyMessage); // обновляем маппинг user→chat

// вебхуки и эндпоинты
app.post('/telegram-webhook', telegramController.onWebhook);
app.post('/data', telegramController.onWebAppData);       // опционально
app.post('/webapp-answer', telegramController.onWebAppAnswer); // inline → answerWebAppQuery

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});

// префилл e-mail для WebApp
app.post('/prefill-email', async (req, res) => {
  try {
    const { user_id } = req.body || {};
    if (!user_id) return res.json({ ok: true, email: null });

    const c = await getCustomerByUserId(user_id);
    const email = c?.email || null;
    res.json({ ok: true, email });
  } catch (e) {
    console.error('prefill-email error', e);
    res.json({ ok: false, email: null });
  }
});

