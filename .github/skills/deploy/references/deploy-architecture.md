# Архитектура деплоя (family)

Справочник по `scripts/deploy.mjs` и remote-скрипту. Процедуры — в `../SKILL.md`, сервер/nginx/SSL — в `docs/server.md`.

## Команда и флаги

- `npm run deploy` → `node scripts/deploy.mjs` (сборка + публикация + рестарт pm2).
- Флаги (через `--` после `npm run deploy`):
  - `--no-build` — пропустить локальную сборку (нужен готовый `dist`).
  - `--no-restart` — не перезапускать pm2.
  - `--print-config` — вывести итоговую конфигурацию и выйти.
  - `--print-script` — вывести генерируемый remote bash-скрипт и выйти.

## Переменные окружения (корневой `.env`, читает `deploy.mjs` своим мини-загрузчиком)

Реальные `.env` значения НЕ переопределяют уже заданные переменные окружения процесса.

| Переменная            | Дефолт                                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEPLOY_HOST`         | `my.rybnikov.su` (основной; для тестового — `test.rybnikov.su`)                                                                                            |
| `DEPLOY_USER`         | `root` (дефолт скрипта); в `.env.example` и фактически на основном хосте — `rybnikov`. Без корневого `.env` SSH пойдёт под `root` и подключение провалится |
| `DEPLOY_PORT`         | `22`                                                                                                                                                       |
| `DEPLOY_FRONTEND_DIR` | `/var/www/my.rybnikov.su/public_html`                                                                                                                      |
| `DEPLOY_BACKEND_DIR`  | `/var/www/my.rybnikov.su/server`                                                                                                                           |
| `DEPLOY_PM2_APP`      | `family-backend`                                                                                                                                           |
| `DEPLOY_NODE_PATH`    | пусто (remote-скрипт сам ищет node/npm; при неудаче указать bin-каталог на сервере)                                                                        |
| `DEPLOY_PM2_HOME`     | пусто (если задан — remote-скрипт делает `export PM2_HOME=...`; задавать абсолютный `/home/rybnikov/.pm2` для стабильного демона)                          |
| `DEPLOY_PDF_SETUP`    | `1` (готовит сервер к импорту PDF: python3-venv + `~/renov-venv` + `RENOVATION_*` в `server/.env`; `0` или `--no-pdf-setup` — отключить)                   |

## Этапы (локально)

1. **Сборка**: `npm run build` (если не `--no-build`). На Windows npm — `npm.cmd` через `cmd.exe`.
2. **Стейджинг** в `mkdtemp`:
   - `frontend/` ← `frontend/dist` (содержимое: `index.html`, `assets/`…).
   - `backend/` ← `backend/dist` (сохраняя layout `dist/`, чтобы на сервере было `dist/app.cjs`) + `package.json` + `package-lock.json` + `backend/scripts/` (CLI, например `users.mjs` — управление пользователями авторизации прямо на сервере).
   - Если нет `frontend/dist` или `backend/dist` — ошибка: «Run `npm run build` first or drop `--no-build`».
3. **Архив**: `tar -czf` (`frontend`, `backend`).
4. **Загрузка**: `scp` архива в `/tmp/family-deploy.tar.gz` и remote-скрипта в `/tmp/family-deploy.sh`.
5. **Выполнение** remote-скрипта через `ssh` (`bash /tmp/family-deploy.sh`).
6. Очистка временного каталога.

## Remote-скрипт (шаги на сервере)

1. **Node/npm/pm2**: если `DEPLOY_NODE_PATH` задан — добавить в PATH; иначе подключить профили (`~/.profile`, `~/.bashrc`, `nvm.sh`) и проверить типовые пути (`~/.nvm/versions/node/*/bin`, `/usr/local/bin`, …). Если npm не найден — ошибка (нужно установить Node или задать `DEPLOY_NODE_PATH`).
2. **Распаковка**: `/tmp/family-deploy` (каталог пересоздаётся).
3. **Фронтенд** → `$PUBLIC`: удаляются только файлы верхнего уровня (`find -maxdepth 1 -type f -delete`) и `assets/`; прочие подпапки (`.well-known`) сохраняются. Сам каталог не удаляется.
4. **Бэкенд** → `$SERVER`: каталог сохраняется, содержимое заменяется, кроме `.env`, `data/`
   (SQLite), `docs/` (загруженные PDF «Ремонта») и `images/` (изображения «Дневника»). Seed
   «Ремонта» и `renovation-source` упразднены; статичный архив `public_html/projects/` на сервере удалён.
5. `npm install --omit=dev` в `$SERVER`.
6. **Рестарт pm2** (если не `--no-restart`): если задан `DEPLOY_PM2_HOME` — `export PM2_HOME=...`; найти/установить pm2; `export NODE_ENV=production`; если приложение есть — `pm2 restart family-backend` (без `--update-env` — dotenv перечитает `.env` при старте), иначе `pm2 start dist/app.cjs --name family-backend --cwd $SERVER`; затем `pm2 save`.
7. Очистка временных файлов.

## Грабли (проверять при проблемах)

- **pm2 не в PATH** в неинтерактивной SSH-сессии → полный путь (на текущих хостах pm2 в `/usr/bin/pm2`).
- **`NODE_ENV=production` обязателен**: под pm2 `app.listen` гейтится в `app.ts`; argv-проверка даёт `false` (pm2 запускает скрипт через свой враппер), поэтому основной сигнал — `NODE_ENV`. Деплой-скрипт ставит его при `pm2 start`; `pm2 restart` (без `--update-env`) сохраняет env.
- **Стабильный `PM2_HOME`**: без него (Windows-ssh шлёт `HOME=C:Usersalex`) демон резолвится относительно CWD и нестабилен — задавать `DEPLOY_PM2_HOME=/home/rybnikov/.pm2`.
- **nginx `proxy_pass`** в `location /api/` должен быть `http://127.0.0.1:3000;` БЕЗ завершающего слэша — иначе срезается `/api` → 404 («бэкенд оффлайн» в UI).
- **502**: сначала локально `curl -i http://127.0.0.1:3000/api/health` (200 → проблема в nginx/прокси), `ss -ltnp | grep 3000`, `pm2 logs family-backend --lines 50 --nostream`.
- **Деплой не обновляет**: `server/.env`, `server/data/` и `server/docs/` сохраняются намеренно — конфигурацию/БД/PDF не «перезаливать» деплоем.
- **Флаги npm**: использовать `npm run deploy -- --no-build` (с `--`), иначе флаг уйдёт самому npm.
- Тестовый хост `test.rybnikov.su`: SSL — letsencrypt (`/etc/letsencrypt/live/test.rybnikov.su/`), у пользователя `rybnikov` есть passwordless `sudo`.

## Проверка после деплоя

- Read-only снимок сервера одной командой: [check-server.mjs](../scripts/check-server.mjs) (health, порт 3000, pm2 describe + logs, nginx -t; флаги `--host/--user/--port/--app/--lines/--batch`).
- `curl -i https://my.rybnikov.su/api/health` → `{"status":"ok",…}`.
- `curl -s https://my.rybnikov.su/api/projects` / `curl -s https://my.rybnikov.su/api/vps` — списки (только под авторизованной сессией: без cookie — 401; сначала `curl -c ck -X POST https://my.rybnikov.su/api/auth/login -H 'Content-Type: application/json' -d '{"username":"…","password":"…"}'`, затем `curl -b ck ...`).
- Логи бэкенда при ошибках: полный путь к pm2 (см. выше).
