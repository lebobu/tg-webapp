#!/usr/bin/env bash
cd /root/tg-webapp-test           # ensure you’re in the project dir
pm2 delete tgwatest-bot-hook           # remove old process
pm2 flush                         # clear logs
rm -f ~/.pm2/logs/tgwatest-bot-out.log ~/.pm2/logs/tgwatest-bot-error.log
pm2 start server.js \
    --name tgwatest-bot-hook \
    --cwd /root/tg-webapp-test-hook \
    --update-env                  # reload env vars (including .env if you source it)
pm2 save                          # persist process list
pm2 logs tgwatest-bot-hook             # tail logs
