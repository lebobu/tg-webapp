#!/usr/bin/env bash
set -euo pipefail

# === настройки ===
APP_DIR="/root/tg-webapp"   # <— проверь свой фактический путь!
APP_NAME="tgwebapp-bot"               # <— имя процесса в PM2
ENTRY="server.js"                     # точка входа

# === проверки ===
[ -d "$APP_DIR" ] || { echo "No dir: $APP_DIR"; exit 1; }
[ -f "$APP_DIR/$ENTRY" ] || { echo "No entry: $APP_DIR/$ENTRY"; exit 1; }

# === CRLF → LF на всякий случай ===
find "$APP_DIR" -type f -name "*.sh" -print0 | xargs -0 sed -i 's/\r$//'

# === перезапуск под PM2 ===
cd "$APP_DIR"
pm2 delete "$APP_NAME" || true
pm2 flush || true
pm2 start "$ENTRY" \
  --name "$APP_NAME" \
  --cwd "$APP_DIR" \
  --update-env

pm2 save

# Не блокируем CI/деплой:
pm2 logs "$APP_NAME" --lines 100 --nostream || true