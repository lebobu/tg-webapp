// controllers/telegramController.js
module.exports = (bot) => ({
  onStartCommand: (msg) => {
    bot.sendMessage(msg.chat.id, 'Click below to open the WebApp:', {
      reply_markup: {
        inline_keyboard: [[{
          text: 'Open Web App',
          web_app: { url: process.env.SERVER_URL }
        }]]
      }
    });
  },

  onWebhook: (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  },

  onWebAppData: (req, res) => {
    const { user, initData, platform } = req.body;
    const chatId = user.id;
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
  }
});
