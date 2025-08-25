// chatStore.js
// simple user_id → chat_id mapping
// 1) Если задан REDIS_URL — используем Redis (ioredis)
// 2) Иначе — in-memory Map (на один процесс)

let useRedis = false;
let redis = null;
const mem = new Map();

if (process.env.REDIS_URL) {
  try {
    const Redis = require('ioredis');
    redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 2
    });
    useRedis = true;
    console.log('💾 chatStore: using Redis');
  } catch (e) {
    console.warn('chatStore: ioredis not installed or failed to init, fallback to memory. Error:', e.message);
  }
} else {
  console.log('💾 chatStore: using in-memory Map');
}

const KEY = (userId) => `chat:${userId}`;

module.exports = {
  async set(userId, chatId) {
    const u = String(userId);
    const c = String(chatId);
    if (useRedis && redis) {
      // храним 30 дней
      await redis.set(KEY(u), c, 'EX', 60 * 60 * 24 * 30);
    } else {
      mem.set(u, c);
    }
  },

  async get(userId) {
    const u = String(userId);
    if (useRedis && redis) {
      return await redis.get(KEY(u));
    }
    return mem.get(u);
  }
};
