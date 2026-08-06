# AGENTS.md — Family

Монорепозиторий веб-приложения: **frontend** (React 19 + TypeScript + Vite, порт 5173) и **backend** (Node + Express 5 + Vite через `vite-plugin-node`, порт 3000). npm workspaces, общие dev-зависимости в корневом `package.json`. Node >= 20.19.0.

> ⚠️ **`renovation_source/` — временная папка, исключена.** Не править, не учитывать в анализе и не деплоить. Рабочий проект ремонта — `projects/renovation/`.

## Команды

| Команда                    | Что делает                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run dev`              | Фронтенд + бэкенд одновременно (concurrently)                                                      |
| `npm run build`            | Сборка frontend (`tsc --noEmit && vite build`) + backend (`vite build`)                            |
| `npm run typecheck`        | `tsc --noEmit` во всех воркспейсах — **единственный статический gate** (lint/тестов нет)           |
| `npm run format`           | Prettier (`.prettierrc.json`: singleQuote, semi, printWidth 100, trailingComma all)                |
| `npm run start -w backend` | Запуск собранного бэкенда (`node dist/app.cjs`) — `start` есть только в backend-воркспейсе         |
| `npm run deploy`           | `node scripts/deploy.mjs`; флаги: `--no-build`, `--no-restart`, `--print-script`, `--print-config` |

## Архитектура (кратко)

- **Backend** (`backend/src/`): `app.ts` экспортирует `app` (Express); роуты `/api/health`, `/api/vps`, `/api/projects` → контроллеры → сервисы. Хранилище VPS — SQLite (`node:sqlite`): `db/database.ts` (синглтон `getDb()`, WAL + foreign_keys), `db/vpsRepository.ts`. Проверка доступности — `services/vpsChecker.ts` (кэш 30с + in-flight dedup, `?refresh=1` форсирует).
- **Frontend** (`frontend/src/`): `createHashRouter` (react-router-dom v7) — **hash-роутинг обязателен** (nginx `try_files ... =404`, нет SPA-fallback). HTTP-клиент `api/client.ts` (`VITE_API_BASE_URL ?? '/api'`; dev-прокси `/api`→`:3000`). Тема light/dark/system — `hooks/useTheme.ts` + CSS-переменные в `index.css` + инлайн-скрипт в `index.html` (без «мигания»).
- **Проекты** (`projects/`): статичные страницы, проект = подпапка с `index.html`. Мета-теги в `index.html`: `project-title`, `project-description`, `project-accent`, `project-icon`, `project-order`. Шаблон — `projects/_template/index.html` (`_*` в деплой не идёт).

Подробно: [README.md](README.md) (структура, .env, деплой) · [docs/specification.md](docs/specification.md) (требования, API, формулы доступности) · [docs/server.md](docs/server.md) (nginx, SSL, сервер, диагностика).

## Правила

1. **Документация синхронно с кодом.** При изменении кода (требования, конфиг, API, UI) обновлять **все**: `docs/specification.md` (первой — спецификация), затем `docs/server.md`, `README.md` и соответствующие `.env.example`. Для статичных страниц проектов (`projects/**`) при изменении макета/структуры — синхронно обновлять соответствующий навык (`.github/skills/*/SKILL.md`) и `docs/specification.md`. Код корректен, если удовлетворяет критериям приёмки из спецификации. **Перед завершением задачи проверь, что всё перечисленное обновлено синхронно с изменениями; если что-то не обновлялось — явно укажи это в итоге** (что именно не тронуто и почему).
2. **Три независимых пространства `.env`** (реальные `.env` в git не попадают и не переопределяют уже заданные переменные окружения): корень — деплой (`DEPLOY_*`, читает `scripts/deploy.mjs`); `backend/.env` — рантайм (`PORT`, `CORS_ORIGIN`, `NODE_ENV`, `DB_PATH`, `PROJECTS_DIR`); `frontend/.env` — только `VITE_API_BASE_URL`.
3. **`npm run typecheck` — единственный gate.** `noUnusedLocals`/`noUnusedParameters` включены в обоих воркспейсах → неиспользуемые переменные/параметры — ошибки (TS6133); неиспользуемые параметры называть `_req`/`_next`. ESLint в репо нет.
4. **node:sqlite — осторожно:**
   - `db.transaction()` не реализован → ручные `BEGIN`/`COMMIT`/`ROLLBACK`.
   - Строки — `Record<string, SQLOutputValue>` → двойной каст `as unknown as MyRow`.
   - **Конфликт UNIQUE определять по `(err.errcode & 0xff) === 19`** (`isConstraintError`), НЕ по `err.code` (`ERR_SQLITE_ERROR`).
   - `mkdirSync(dirname(dbPath), {recursive:true})` обязателен до `new DatabaseSync()`.
   - Vite оставляет `node:sqlite` external (не инлайнит).
5. **`app.listen` гейтится** в `app.ts`: слушать при `NODE_ENV=production` ЛИБО прямом запуске. Под pm2 `process.argv[1]` — враппер pm2 (не скрипт) → argv-проверка даёт `false`; основной сигнал — `NODE_ENV=production` (ставит деплой-скрипт). В dev Vite монтирует `app` сам — слушать нельзя.
6. **Язык.** Комментарии в коде и строки UI — на русском. Иконки — инлайн SVG-компоненты (`stroke=currentColor`) в `frontend/src/components/icons.tsx`.

## Деплой (кратко)

`scripts/deploy.mjs`: сборка → tar → scp → remote-скрипт (nginx не трогает). На сервере сохраняются: `server/.env`, `server/data/` (SQLite), `.well-known/`, подпапки проектов вне репозитория. Папки проектов перед перезаписью бэкапятся в `/tmp/family-projects-backup-<ts>`. Детали — в [README.md](README.md) «Деплой» и [docs/server.md](docs/server.md).

## Типичные грабли

- **Frontend dev 502:** если порты 3000/5173 заняты старыми инстансами, Vite поднимается на 3001/5174, а proxy всё равно целится в 3000 → 502 (dev-окружение, не код).
- **Новая VPS не видна в UI:** GET-кэш бэкенда 30с → после POST вызывать `onRefresh()` → `fetchVps(true)` (`?refresh=1`).
- **Backend 502 под pm2:** диагностика `ss -ltnp | grep 3000`, `curl -i http://127.0.0.1:3000/api/health`, `pm2 logs family-backend --lines 50 --nostream`. pm2 не в PATH в неинтерактивной сессии — полный путь `~/.nvm/versions/node/v24.19.0/bin/pm2`.
- **Второй хост `itg-ru-gw.rybnikov.su` (пользователь `rybnikov`, passwordless sudo):** деплой проходит успешно, но «бэкенд оффлайн» → те же проверки на хосте: `ss -ltnp | grep 3000`, `curl -i http://127.0.0.1:3000/api/health`, `NODE_ENV=production` и полный путь pm2; SSL — letsencrypt (`/etc/letsencrypt/live/itg-ru-gw.rybnikov.su/`).
- **nginx:** `proxy_pass http://127.0.0.1:3000;` без трейлинг-слэша, иначе срезается `/api` и Express отдаёт 404.
