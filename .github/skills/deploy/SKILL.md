---
name: deploy
description: 'Деплой и диагностика сервера приложения family. Use when: публикация на сервер (npm run deploy, scripts/deploy.mjs), флаги --no-build/--no-restart/--print-script/--print-config, второй хост itg-ru-gw.rybnikov.su, диагностика 502/health/pm2/nginx, SSL, сохранение .env и SQLite при деплое, ошибки деплоя (npm not found, pm2). Не для правки кода приложения — это скилл про деплой и сервер.'
argument-hint: 'Деплой'
user-invocable: true
---

# Деплой и сервер (family)

Публикация фронтенда/бэкенда/проектов на сервер через `scripts/deploy.mjs` и диагностика после деплоя. Полный справочник по серверу/nginx/SSL — в [docs/server.md](../../docs/server.md) и [README.md](../../README.md) «Деплой».

## Когда использовать

- Деплой на `family.rybnikov.su` (основной хост) или `itg-ru-gw.rybnikov.su` (второй).
- Предпросмотр того, что выполнится на сервере (`--print-script`, `--print-config`).
- Диагностика после деплоя: 502, бэкенд не слушает порт, pm2-логи, nginx.
- Вопросы «что сохраняется на сервере при деплое» (.env, data/, .well-known, проекты).

## Процедуры

### Полный деплой

1. Убедиться, что в корневом `.env` корректная конфигурация `DEPLOY_*` (или переменные окружения). Без `.env` скрипт идёт под `root`, а оба хоста деплоятся под `rybnikov` (шаблон — `.env.example`; основной хост: `DEPLOY_USER=rybnikov`).
2. `npm run deploy` — сборка (`npm run build`) + архив + scp + remote-скрипт (nginx не трогает).
3. После деплоя проверить: health через домен, `GET /api/vps`, `GET /api/projects`.

Частичный деплой (npm требует `--` перед флагами):

- `npm run deploy -- --no-build` — без локальной сборки (нужен уже собранный `dist`).
- `npm run deploy -- --no-restart` — файлы обновятся, pm2 не перезапустится.
- `npm run deploy -- --no-pdf-setup` — не готовить сервер к импорту PDF (по умолчанию деплой сам ставит `python3-venv` + `~/renov-venv` с pdfplumber и дописывает `RENOVATION_PYTHON`/`RENOVATION_EXTRACT_SCRIPT` в `server/.env`, создавая файл при его отсутствии; идемпотентно, не роняет деплой). На Python 3.8 последний pdfplumber не ставится (нужен Python>=3.9) — деплой откатывается на `pdfplumber==0.11.0` и предупреждает.

**Рестарт pm2 в деплое — обычный (`pm2 restart`, без `--update-env`):** приложение само читает `server/.env` через dotenv при старте, а `--update-env` в неинтерактивных SSH-сессиях падает с `env: 'node': No such file or directory` (node не в PATH) — рестарт не происходит. Если вручную правили `server/.env` и рестартите вне деплоя — `export PATH=".../bin:$PATH"` и `pm2 restart family-backend` (см. `docs/server.md`).

### Предпросмотр без деплоя

- `node scripts/deploy.mjs --print-config` — итоговая конфигурация (host, пути, флаги).
- `node scripts/deploy.mjs --print-script` — сгенерированный bash-скрипт, который выполнится на сервере.

### Деплой на второй хост (itg-ru-gw.rybnikov.su)

- Тот же скрипт; хост задаётся переменной окружения (переменные окружения приоритетнее `.env`):
  `$env:DEPLOY_HOST = "itg-ru-gw.rybnikov.su"; $env:DEPLOY_USER = "rybnikov"; npm run deploy`
- Пользователь `rybnikov`, SSH без пароля; на хосте есть passwordless `sudo`.

### Управление пользователями на сервере

- `server/scripts/users.mjs` (CLI из `backend/scripts/`) входит в деплой — работает прямо на сервере из каталога бэкенда.
- В неинтерактивной SSH-сессии `node`/`pm2` нет в PATH — использовать полный путь: `/home/rybnikov/.nvm/versions/node/v24.19.0/bin/node`.
- Примеры (из `/var/www/family.rybnikov.su/server`):
  ```bash
  /home/rybnikov/.nvm/versions/node/v24.19.0/bin/node scripts/users.mjs add mama Мама user
  /home/rybnikov/.nvm/versions/node/v24.19.0/bin/node scripts/users.mjs list
  /home/rybnikov/.nvm/versions/node/v24.19.0/bin/node scripts/users.mjs set-role mama admin
  /home/rybnikov/.nvm/versions/node/v24.19.0/bin/node scripts/users.mjs remove mama
  ```
- Пароль запрашивается интерактивно (не эхонируется) либо через `--password <пароль>`.
- Первый администратор: `AUTH_BOOTSTRAP_PASSWORD` в `server/.env` — создаётся при рестарте, если таблица `users` пуста; после входа переменную убрать.

### Диагностика (после деплоя / при 502)

Быстрый read-only снимок сервера одной командой (health, порт, pm2, nginx -t):

```bash
node .github/skills/deploy/scripts/check-server.mjs [--host <хост>] [--user <пользователь>] [--app <приложение>] [--lines N] [--batch]
```

Затем точечные проверки по шагам:

1. `curl -i https://family.rybnikov.su/api/health` — через домен (nginx).
2. На сервере (ssh) `curl -i http://127.0.0.1:3000/api/health` — минуя nginx. Если 200, а через домен 404 → дело в nginx-прокси (`proxy_pass` без трейлинг-слэша), не в приложении.
3. `ss -ltnp | grep 3000` — слушает ли бэкенд порт.
4. pm2-логи: полный путь, т.к. pm2 не в PATH в неинтерактивной сессии — `~/.nvm/versions/node/v24.19.0/bin/pm2 logs family-backend --lines 50 --nostream`.
5. nginx: `sudo nginx -t && sudo systemctl reload nginx` (после правки конфига).
6. Если бэкенд не слушает: проверить `NODE_ENV=production` (без него `app.listen` не вызывается под pm2) и `pm2 describe family-backend`.
7. **После правки `server/.env` (например, `RENOVATION_*` для импорта PDF) обязателен рестарт.** В неинтерактивной SSH-сессии `pm2 restart --update-env` падает с `env: 'node': No such file or directory` (node не в PATH) — рестарт не происходит, приложение работает со старым env. Правильно: `export PATH="/home/rybnikov/.nvm/versions/node/v24.19.0/bin:$PATH"` затем `pm2 restart family-backend` (без `--update-env` — dotenv перечитает `.env` при старте). Подробно — `docs/server.md`.

## Что сохраняется на сервере при деплое (не затирается)

- `server/.env` (конфигурация рантайма бэкенда).
- `server/data/` (SQLite-базы: VPS, авторизация, проекты и «Ремонт»).
- `server/docs/` (загруженные PDF «Ремонта», `docs/renovation/`).
- `public_html/.well-known` и прочие подпапки фронтенда вне репозитория.
- Существующий статичный архив `public_html/projects/` (legacy, не обновляется).

## Справочник

- [Архитектура деплоя](./references/deploy-architecture.md) — этапы `deploy.mjs`, переменные `DEPLOY_*`, шаги remote-скрипта, грабли.
- [docs/server.md](../../docs/server.md) — пути на сервере, полный nginx vhost, SSL/acme.sh, второй хост, команды диагностики.
- [README.md](../../README.md) — раздел «Деплой на family.rybnikov.su» (флаги, настройка, требования).
