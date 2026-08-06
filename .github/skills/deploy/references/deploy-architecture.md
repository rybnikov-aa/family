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
| `DEPLOY_HOST`         | `family.rybnikov.su` (для второго хоста — `itg-ru-gw.rybnikov.su`)                                                                                         |
| `DEPLOY_USER`         | `root` (дефолт скрипта); в `.env.example` и фактически на основном хосте — `rybnikov`. Без корневого `.env` SSH пойдёт под `root` и подключение провалится |
| `DEPLOY_PORT`         | `22`                                                                                                                                                       |
| `DEPLOY_FRONTEND_DIR` | `/var/www/family.rybnikov.su/public_html`                                                                                                                  |
| `DEPLOY_BACKEND_DIR`  | `/var/www/family.rybnikov.su/server`                                                                                                                       |
| `DEPLOY_PM2_APP`      | `family-backend`                                                                                                                                           |
| `DEPLOY_NODE_PATH`    | пусто (remote-скрипт сам ищет node/npm; при неудаче указать bin-каталог на сервере)                                                                        |

## Этапы (локально)

1. **Сборка**: `npm run build` (если не `--no-build`). На Windows npm — `npm.cmd` через `cmd.exe`.
2. **Стейджинг** в `mkdtemp`:
   - `frontend/` ← `frontend/dist` (содержимое: `index.html`, `assets/`…).
   - `backend/` ← `backend/dist` (сохраняя layout `dist/`, чтобы на сервере было `dist/app.cjs`) + `package.json` + `package-lock.json` + `backend/scripts/` (CLI, например `users.mjs` — управление пользователями авторизации прямо на сервере).
   - `projects/` ← `projects/` без служебных записей `_*` (`_template` не деплоится).
   - Если нет `frontend/dist` или `backend/dist` — ошибка: «Run `npm run build` first or drop `--no-build`».
3. **Архив**: `tar -czf` (`frontend`, `backend`[, `projects`]).
4. **Загрузка**: `scp` архива в `/tmp/family-deploy.tar.gz` и remote-скрипта в `/tmp/family-deploy.sh`.
5. **Выполнение** remote-скрипта через `ssh` (`bash /tmp/family-deploy.sh`).
6. Очистка временного каталога.

## Remote-скрипт (шаги на сервере)

1. **Node/npm/pm2**: если `DEPLOY_NODE_PATH` задан — добавить в PATH; иначе подключить профили (`~/.profile`, `~/.bashrc`, `nvm.sh`) и проверить типовые пути (`~/.nvm/versions/node/*/bin`, `/usr/local/bin`, …). Если npm не найден — ошибка (нужно установить Node или задать `DEPLOY_NODE_PATH`).
2. **Распаковка**: `/tmp/family-deploy` (каталог пересоздаётся).
3. **Фронтенд** → `$PUBLIC`: удаляются только файлы верхнего уровня (`find -maxdepth 1 -type f -delete`) и `assets/`; прочие подпапки (`.well-known`) сохраняются. Сам каталог не удаляется.
4. **Проекты** → `$PUBLIC/projects`: папка `projects/` репозитория зеркалится 1:1 — перезаписываются только записи из репозитория (резервная копия не создаётся); записи, которых нет в репо, на сервере не удаляются. И подпапки проектов (`renovation/` и т.п.), и общие файлы (`styles.css`, `theme.js`, `icon-sprite.svg`) копируются в `public_html/projects/`; страницы проектов обслуживаются по `/projects/<slug>/` (например, `/projects/renovation/`, см. `docs/server.md`).
5. **Бэкенд** → `$SERVER`: каталог сохраняется, содержимое заменяется, кроме `.env` и `data/` (SQLite).
6. `npm install --omit=dev` в `$SERVER`.
7. **Рестарт pm2** (если не `--no-restart`): найти/установить pm2; `export NODE_ENV=production`; если приложение есть — `pm2 restart family-backend --update-env`, иначе `pm2 start dist/app.cjs --name family-backend --cwd $SERVER`; затем `pm2 save`.
8. Очистка временных файлов.

## Грабли (проверять при проблемах)

- **pm2 не в PATH** в неинтерактивной SSH-сессии → полный путь `~/.nvm/versions/node/v24.19.0/bin/pm2`.
- **`NODE_ENV=production` обязателен**: под pm2 `app.listen` гейтится в `app.ts`; argv-проверка даёт `false` (pm2 запускает скрипт через свой враппер), поэтому основной сигнал — `NODE_ENV`. Деплой-скрипт ставит его при `pm2 restart --update-env`.
- **nginx `proxy_pass`** в `location /api/` должен быть `http://127.0.0.1:3000;` БЕЗ завершающего слэша — иначе срезается `/api` → 404 («бэкенд оффлайн» в UI).
- **502**: сначала локально `curl -i http://127.0.0.1:3000/api/health` (200 → проблема в nginx/прокси), `ss -ltnp | grep 3000`, `pm2 logs family-backend --lines 50 --nostream`.
- **Деплой не обновляет**: `server/.env` и `server/data/` сохраняются намеренно — конфигурацию/БД не «перезаливать» деплоем.
- **Флаги npm**: использовать `npm run deploy -- --no-build` (с `--`), иначе флаг уйдёт самому npm.
- Второй хост `itg-ru-gw.rybnikov.su`: SSL — letsencrypt (`/etc/letsencrypt/live/itg-ru-gw.rybnikov.su/`), у пользователя `rybnikov` есть passwordless `sudo`.

## Проверка после деплоя

- Read-only снимок сервера одной командой: [check-server.mjs](../scripts/check-server.mjs) (health, порт 3000, pm2 describe + logs, nginx -t; флаги `--host/--user/--port/--app/--lines/--batch`).
- `curl -i https://family.rybnikov.su/api/health` → `{"status":"ok",…}`.
- `curl -s https://family.rybnikov.su/api/projects` — список проектов.
- `curl -s https://family.rybnikov.su/api/vps` — статусы VPS.
- Логи бэкенда при ошибках: полный путь к pm2 (см. выше).
