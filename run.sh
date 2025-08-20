#!/usr/bin/env bash
set -euo pipefail
cd /root/tg-webapp           # ensure you’re in the project dir
pm2 delete tg-webapp-bot           # remove old process
pm2 flush                         # clear logs
rm -f ~/.pm2/logs/tg-webapp-bot-out.log ~/.pm2/logs/tg-webapp-bot-error.log
pm2 start server.js \
    --name tg-webapp-bot \
    --cwd /root/tg-webapp \
    --update-env                  # reload env vars (including .env if you source it)
pm2 save                          # persist process list
pm2 logs tg-webapp-bot --lines 100 --nostream || true            # tail logs