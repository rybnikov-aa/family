---
name: deploy
description: 'Деплой и диагностика сервера приложения family. Use when: публикация на сервер (npm run deploy, scripts/deploy.mjs), флаги --no-build/--no-restart/--print-script/--print-config, тестовый хост test.rybnikov.su, диагностика 502/health/pm2/nginx, SSL, сохранение .env и SQLite при деплое, ошибки деплоя (npm not found, pm2). Не для правки кода приложения — это скилл про деплой и сервер.'
argument-hint: 'Деплой'
user-invocable: true
---

# Деплой и сервер (family)

Публикация фронтенда/бэкенда/проектов на сервер через `scripts/deploy.mjs` и диагностика после деплоя. Полный справочник по серверу/nginx/SSL — в [docs/server.md](../../docs/server.md) и [README.md](../../README.md) «Деплой».

## Когда использовать

- Деплой на `my.rybnikov.su` (основной хост, по умолчанию из `.env`) или `test.rybnikov.su` (тестовый, инстанс `family-backend-test`). Данные основного хоста мигрированы с прежнего хоста 2026-08-16 (прежний домен редиректится на `my.rybnikov.su`).
- Предпросмотр того, что выполнится на сервере (`--print-script`, `--print-config`).
- Диагностика после деплоя: 502, бэкенд не слушает порт, pm2-логи, nginx.
- Вопросы «что сохраняется на сервере при деплое» (.env, data/, .well-known, проекты).

## Процедуры

### Полный деплой

Для обычной публикации использовать `npm run pipeline`. Команда `npm run deploy` ниже описана
как исторический прямой деплой без тестового этапа.

1. Убедиться, что в корневом `.env` корректная конфигурация `DEPLOY_*` (или переменные окружения). Без `.env` скрипт идёт под `root`, а хосты деплоятся под `rybnikov` (шаблон — `.env.example`; основной хост: `DEPLOY_USER=rybnikov`, `DEPLOY_PM2_HOME=/home/rybnikov/.pm2`).
2. `npm run deploy` — сборка (`npm run build`) + архив + scp + remote-скрипт (nginx не трогает).
3. После деплоя проверить: health через домен, `GET /api/vps`, `GET /api/projects`.

### Пошаговая публикация через тестовый сервер

Для стандартного выпуска использовать `npm run pipeline`, а не прямой деплой на основной хост:

```powershell
npm run pipeline
```

Pipeline строго выполняет четыре этапа: деплой на тестовый сервер, очистка и копирование
`data/` с основного сервера, ожидание готовности `GET /api/health` и sanity-тесты, затем
деплой на основной сервер только при успехе.
Перед тестами создаются временные `test` (admin) и `user` (user), после sanity они удаляются.
`PIPELINE_SYNC_FILES=1` дополнительно копирует `docs/` и `images/`. Сухой просмотр конфигурации:
`npm run pipeline -- --print-config`.

Частичный деплой (npm требует `--` перед флагами):

- `npm run deploy -- --no-build` — без локальной сборки (нужен уже собранный `dist`).
- `npm run deploy -- --no-restart` — файлы обновятся, pm2 не перезапустится.
- `npm run deploy -- --no-pdf-setup` — не готовить сервер к импорту PDF (по умолчанию деплой сам ставит `python3-venv` + `~/renov-venv` с pdfplumber и дописывает `RENOVATION_PYTHON`/`RENOVATION_EXTRACT_SCRIPT` в `server/.env`, создавая файл при его отсутствии; идемпотентно, не роняет деплой). На Python 3.8 последний pdfplumber не ставится (нужен Python>=3.9) — деплой откатывается на `pdfplumber==0.11.0` и предупреждает.

**Рестарт pm2 в деплое — обычный (`pm2 restart`, без `--update-env`):** приложение само читает `server/.env` через dotenv при старте, а `--update-env` в неинтерактивных SSH-сессиях может падать с `env: 'node': No such file or directory` (node не в PATH на части хостов) — рестарт не происходит. Если вручную правили `server/.env` и рестартите вне деплоя — `export PM2_HOME=/home/rybnikov/.pm2` и `pm2 restart family-backend` (см. `docs/server.md`).

### Предпросмотр без деплоя

- `node scripts/deploy.mjs --print-config` — итоговая конфигурация (host, пути, флаги).
- `node scripts/deploy.mjs --print-script` — сгенерированный bash-скрипт, который выполнится на сервере.

### Деплой на тестовый хост (test.rybnikov.su)

- Сервер `31.76.227.98`. Отдельный инстанс `family-backend-test` на `127.0.0.1:3001` (`server/.env`: `PORT=3001`, `CORS_ORIGIN=https://test.rybnikov.su`).
- Автозапуск pm2 при загрузке включён (как и на основном): `pm2-rybnikov.service` + `pm2 save` — после перезагрузки `family-backend-test` поднимается сам.
- Тот же скрипт; хост и пути задаются переменными окружения (приоритетнее `.env`):
  ```powershell
  $env:DEPLOY_HOST = "test.rybnikov.su"; $env:DEPLOY_USER = "rybnikov"
  $env:DEPLOY_FRONTEND_DIR = "/var/www/test.rybnikov.su/public_html"
  $env:DEPLOY_BACKEND_DIR = "/var/www/test.rybnikov.su/server"
  $env:DEPLOY_PM2_APP = "family-backend-test"; $env:DEPLOY_PM2_HOME = "/home/rybnikov/.pm2"
  npm run deploy -- --no-pdf-setup
  ```
- Пользователь `rybnikov`, SSH без пароля; на хосте есть passwordless `sudo`. node v24.18.1 `/usr/bin/node`, pm2 7.0.3 `/usr/bin/pm2`. CPU E5-2697 v4 (AVX2) — sharp `~0.35.3` подходит.

### Деплой на основной хост (my.rybnikov.su)

- **Основной хост по умолчанию** (корневой `.env`: `DEPLOY_HOST=my.rybnikov.su`, `DEPLOY_PM2_HOME=/home/rybnikov/.pm2`). Команда — просто `npm run deploy -- --no-pdf-setup`.
- Пользователь `rybnikov`, SSH без пароля, passwordless `sudo`. node v24.19.0 `/usr/bin/node`, pm2 7.0.3 `/usr/bin/pm2`. CPU Xeon Platinum 8260 (AVX2) — sharp `~0.35.3`.
- **Обязательно `--no-pdf-setup`:** из-за грабли `HOME` (см. ниже) pdf-setup создаёт venv по битому пути. venv ставится вручную: `export HOME=/home/rybnikov; python3 -m venv /home/rybnikov/renov-venv; /home/rybnikov/renov-venv/bin/pip install pdfplumber`, затем `RENOVATION_*` дописываются в `server/.env`.
- Данные перенесены с прежнего основного хоста (2026-08-16): `data/`, `docs/`, `images/`, `server/.env` (адаптирован под домен). Учётка `admin` уже в БД; старые сессии невалидны — вход заново.
- **Конфигурация основного и тестового серверов синхронизируется** (AGENTS.md, правило 14): правки nginx/`server/.env`/pm2/зависимостей применять к **обоим** хостам; отличия — только по назначению (порт, домен, пути, имя pm2-приложения).

### Грабли: Windows OpenSSH передаёт на сервер `HOME=C:Usersalex`

- ssh из этого Windows-окружения всегда шлёт локальный `HOME=C:Usersalex` → на сервере `$HOME/...`/`~/...` резолвятся относительно CWD (удаление `$env:HOME` локально не помогает).
- **Фикс — `DEPLOY_PM2_HOME`:** `deploy.mjs` экспортирует `PM2_HOME` в remote-скрипт (`export PM2_HOME=...`). Задавать абсолютный `DEPLOY_PM2_HOME=/home/rybnikov/.pm2` — тогда демон pm2 стабилен. Без него `PM2_HOME=$CWD/C:Usersalex/.pm2`: демон нестабилен (умирает между сессиями), деплой делает `start` вместо `restart`, возможен конфликт портов. Ручное управление pm2 — `export PM2_HOME=/home/rybnikov/.pm2; pm2 ...`.
- `NODE_ENV=production` хранится в env приложения pm2 (задаётся при `pm2 start`), обычный `pm2 restart` его сохраняет; ручной запуск без `NODE_ENV=production` → процесс online, но порт не слушается (гейт `app.listen`).

### Управление пользователями на сервере

- `server/scripts/users.mjs` (CLI из `backend/scripts/`) входит в деплой — работает прямо на сервере из каталога бэкенда.
- В неинтерактивной SSH-сессии `node`/`pm2` нет в PATH — использовать полный путь: `/home/rybnikov/.nvm/versions/node/v24.19.0/bin/node`.
- Примеры (из `/var/www/my.rybnikov.su/server`):
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

1. `curl -i https://my.rybnikov.su/api/health` — через домен (nginx).
2. На сервере (ssh) `curl -i http://127.0.0.1:3000/api/health` — минуя nginx. Если 200, а через домен 404 → дело в nginx-прокси (`proxy_pass` без трейлинг-слэша), не в приложении.
3. `ss -ltnp | grep 3000` — слушает ли бэкенд порт.
4. pm2-логи: `export PM2_HOME=/home/rybnikov/.pm2; pm2 logs family-backend --lines 50 --nostream` (на текущих хостах pm2 в `/usr/bin/pm2`).
5. nginx: `sudo nginx -t && sudo systemctl reload nginx` (после правки конфига).
6. Если бэкенд не слушает: проверить `NODE_ENV=production` (без него `app.listen` не вызывается под pm2) и `pm2 describe family-backend`.
7. **После правки `server/.env` (например, `RENOVATION_*` для импорта PDF) обязателен рестарт.** В неинтерактивной SSH-сессии `pm2 restart --update-env` может падать с `env: 'node': No such file or directory` (node не в PATH на части хостов) — рестарт не происходит, приложение работает со старым env. Правильно: `export PM2_HOME=/home/rybnikov/.pm2` затем `pm2 restart family-backend` (без `--update-env` — dotenv перечитает `.env` при старте). Подробно — `docs/server.md`.

## Что сохраняется на сервере при деплое (не затирается)

- `server/.env` (конфигурация рантайма бэкенда).
- `server/data/` (SQLite-базы: VPS, авторизация, проекты, «Ремонт» и «Дневник»).
- `server/docs/` (загруженные PDF «Ремонта», `docs/renovation/`).
- `server/images/` (изображения событий «Дневника», уникальная подпапка `images/<folder>/` на событие).
- `public_html/.well-known` и прочие подпапки фронтенда вне репозитория.
- Существующий статичный архив `public_html/projects/` (legacy, не обновляется).

## Справочник

- [Архитектура деплоя](./references/deploy-architecture.md) — этапы `deploy.mjs`, переменные `DEPLOY_*`, шаги remote-скрипта, грабли.
- [docs/server.md](../../docs/server.md) — пути на сервере, полный nginx vhost, SSL, хосты, команды диагностики.
- [README.md](../../README.md) — раздел «Деплой на my.rybnikov.su» (флаги, настройка, требования).
