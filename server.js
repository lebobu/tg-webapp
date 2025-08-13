require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express     = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path        = require('path');

const BOT_TOKEN  = process.env.BOT_TOKEN;
const SERVER_URL = process.env.SERVER_URL;
const PORT       = process.env.PORT || 3000;

const bot = new TelegramBot(BOT_TOKEN);
bot.setWebHook(`${SERVER_URL}/telegram-webhook`);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const telegramController = require('./controllers/telegramController')(bot);

// 🧠 Подключение логики
bot.onText(/\/start/, telegramController.onStartCommand);
app.post('/data', telegramController.onWebAppData);
app.post('/telegram-webhook', telegramController.onWebhook);

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
