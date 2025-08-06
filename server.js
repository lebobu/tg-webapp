// Load env first
require('dotenv').config({
  path: require('path').join(__dirname, '.env')
});

const express       = require('express');
const TelegramBot   = require('node-telegram-bot-api');
const path          = require('path');

const BOT_TOKEN   = process.env.BOT_TOKEN;
const SERVER_URL  = process.env.SERVER_URL; 
const PORT        = process.env.PORT || 3000;

console.log('▶️ Loaded SERVER_URL =', SERVER_URL);

// 1) Instantiate without polling
const bot = new TelegramBot(BOT_TOKEN);

// 2) Register webhook (no top-level await)
bot.setWebHook(`${SERVER_URL}/telegram-webhook`)
   .then(() => console.log('✅ Webhook set'))
   .catch(console.error);

const app = express();

// 3) Parse JSON bodies for both /data and /telegram-webhook
app.use(express.json());

// 4) Serve your WebApp
app.use(express.static(path.join(__dirname, 'public')));

// 5) /start handler stays exactly the same
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Click below to open the WebApp:', {
    reply_markup: {
      inline_keyboard: [[{
        text: 'Open Web App',
        web_app: { url: SERVER_URL }
      }]]
    }
  });
});

// 6) WebApp → backend echo
app.post('/data', (req, res) => {
  const { user, initData, platform } = req.body;
  console.log('📥 Received data:', req.body);

  const chatId   = user.id;
  const fullName = `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`;
  const username = user.username ? `@${user.username}` : 'N/A';

  const text = [
    `🔔 *Your WebApp Data:*`,
    `• *Name:* ${fullName}`,
    `• *Username:* ${username}`,
    `• *Platform:* ${platform}`,
    `• *initData:* \`${initData}\``
  ].join('\n');

  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  res.sendStatus(200);
});

// 7) Telegram → webhook endpoint
app.post('/telegram-webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// 8) Start HTTP server
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});

