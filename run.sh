#!/usr/bin/env bash
set -euo pipefail

# ---- nvm bootstrap (важно для non-login/non-interactive shell) ----
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi

# Какая нода нужна проекту
NODE_VERSION="${NODE_VERSION:-18}"

# Активируем ноду (если nvm есть)
if command -v nvm >/dev/null 2>&1; then
  nvm use "$NODE_VERSION" >/dev/null
fi

# Путь к pm2 рядом с активным node (работает с nvm и без)
NODE_BIN="$(command -v node)"
if [ -z "${NODE_BIN:-}" ]; then
  echo "node not found in PATH"; exit 1
fi
PM2_BIN="$(dirname "$NODE_BIN")/pm2"

# Установить pm2, если его нет
if ! [ -x "$PM2_BIN" ]; then
  echo "pm2 not found; installing globally for current Node..."
  npm i -g pm2
fi

# === настройки ===
APP_DIR="/var/www/site-dev"           # <— проверь свой фактический путь!
APP_NAME="tg-webapp-bot-dev"          # <— имя процесса в PM2
ENTRY="server.js"                     # точка входа

# Защита от CRLF в .sh
find "$APP_DIR" -type f -name "*.sh" -print0 | xargs -0 sed -i 's/\r$//' || true

cd "$APP_DIR"
"$PM2_BIN" delete "$APP_NAME" || true
"$PM2_BIN" start "$ENTRY" --name "$APP_NAME" --cwd "$APP_DIR" --update-env
"$PM2_BIN" save
"$PM2_BIN" logs "$APP_NAME" --lines 100 --nostream || true