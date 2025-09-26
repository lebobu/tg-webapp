# How to develop?
1. To restrat bot run pm2 reload ecosystem.config.cjs
or to restart of its not running to start
pm2 startOrReload /root/tg-webapp/ecosystem.config.cjs
2. To print logs pm2 logs

Both steps are executed in run.sh via ./run.sh

# Logic
# Structure ready

# fix worked version 28-08 + one more
# check deploy
# fix worked 31-08 with dev on port 4001

node -v
v18.20.8
npm -v
10.9.2

ADMIN_CHAT_IDS=5509921283
# Прописал site-prod: 4000 Нужно узнать как сливать dev в prod и менять ENV
# зафиксировал .env на сервере
# на сервере секреты создаются руками в /var/www/site-*/.env, никогда не коммитятся

### DEV-сайт (ветка main)

Цель: всегда иметь свежую разработческую версию.

В VS Code (локально):

Переключись на main: в статус-баре клик по имени ветки → main.

Pull: … (More) → Pull
— это эквивалент git pull origin main.

Если появится конфликт: Source Control подскажет файлы → реши конфликты → Commit.

### PROD-сайт (ветка prod)

Цель: локально видеть актуальный продакшн (для ревью/горячих фиксов).

В VS Code (локально):

Переключись на prod.

Pull: Pull
— эквивалент git pull origin prod.

Хотфикс в prod сделал? Потом не забудь вернуть фикс в main (merge/cherry-pick).


# v 1.2 
# v 1.5
# Control point before email check
№ check deploy.yml 2