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

- **Backend** (`backend/src/`): `app.ts` экспортирует `app` (Express); роуты `/api/health`, `/api/auth`, `/api/vps`, `/api/projects` → контроллеры → сервисы. Хранилище VPS — SQLite (`node:sqlite`): `db/database.ts` (синглтон `getDb()`, WAL + foreign_keys), `db/vpsRepository.ts`. Проверка доступности — `services/vpsChecker.ts` (кэш 30с + in-flight dedup, `?refresh=1` форсирует).
- **Авторизация** — весь портал закрыт входом (SPA + API). Пользователи/сессии — SQLite (`users`/`sessions`), пароли — только scrypt; токен в БД — SHA-256, клиенту — httpOnly `SameSite=Lax` cookie `sid`. `requireAuth` на роутах `/api/vps` и `/api/projects`, `requireAdmin` — на мутациях (POST/DELETE VPS, импорт, загрузка PDF); `/api/health` и `POST /api/auth/login` — публичны. Bootstrap-админ из `AUTH_BOOTSTRAP_PASSWORD` (при пустой `users`); учётки — `npm run user -w backend` (`backend/scripts/users.mjs`). Фронт: `hooks/useAuth.tsx` + `pages/LoginPage.tsx` + гейт в `App.tsx`; роль `admin` гейтит UI (VPS CRUD, загрузка PDF).
- **Frontend** (`frontend/src/`): `createHashRouter` (react-router-dom v7) — **hash-роутинг обязателен** (nginx `try_files ... =404`, нет SPA-fallback). HTTP-клиент `api/client.ts` (`VITE_API_BASE_URL ?? '/api'`; dev-прокси `/api`→`:3000`; на 401 рассылает `auth:unauthorized` → `useAuth` показывает вход). Тема light/dark/system — `hooks/useTheme.ts` + CSS-переменные в `index.css` + инлайн-скрипт в `index.html` (без «мигания»).
- **Проекты** (`projects/`): статичные страницы, проект = подпапка с `index.html`. Мета-теги в `index.html`: `project-title`, `project-description`, `project-accent`, `project-icon`, `project-order`. Шаблон — `projects/_template/index.html` (`_*` в деплой не идёт).

Подробно: [README.md](README.md) (структура, .env, деплой) · [docs/specification.md](docs/specification.md) (требования, API, формулы доступности) · [docs/server.md](docs/server.md) (nginx, SSL, сервер, диагностика).

## Правила

1. **Документация синхронно с кодом — обязательный чек-лист перед завершением.** При изменении кода (требования, конфиг, API, UI) обновлять **все**: `docs/specification.md` (первой — спецификация), затем `docs/server.md`, `README.md` и соответствующие `.env.example`. Для статичных страниц проектов (`projects/**`) при изменении макета/структуры — синхронно обновлять соответствующий навык (`.github/skills/*/SKILL.md`) и `docs/specification.md`. Код корректен, если удовлетворяет критериям приёмки из спецификации. Перед завершением задачи обязательно выполни:
   - `git status` → перечень изменённых файлов;
   - для каждого изменения определи, какие `docs/`, навыки (`.github/skills/*/SKILL.md`) и `.env.example` оно затрагивает;
   - прогони grep по устаревшим маркерам (старые классы, удалённые подписи/поля, прежние числа) — ничего не должно остаться;
   - в итоге явно перечисли, что обновлено, а что не тронуто и почему. Это требование, а не пожелание: «забыл» — недопустимо.
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
7. **Проект «Ремонт» (`projects/renovation/**`): работа начинается с загрузки навыков**
   `project-renovation-update-from-pdf` и `project-renovation-build-reports` (`.github/skills/`).
   - Строго соблюдать этапы: сначала PDF → HTML (навык `project-renovation-update-from-pdf`),
     затем отчёты — **только из исходных HTML** (навык `project-renovation-build-reports`).
     Не обновлять отчёты одновременно с распознаванием PDF.
   - **Уже импортированные PDF повторно не распознавать** — сверять по типу и дате с
     существующими `estimate*.html`, `Works/*.html`, `Materials/*.html`, `*_settlement.html`;
     повторное распознавание только по явному запросу пользователя.
   - Каждый исходный HTML обязан содержать блок `.doc-sources` со ссылкой на исходный PDF.
8. **Конфиденциальность на публикуемых страницах ремонта (`projects/renovation/**`).**
   - Не публиковать персональные данные заказчика: ФИО — ни в тексте, ни в `<title>`, ни в
     подписях; в ролевых блоках — только роль («Заказчик», «Подрядчик») без имени.
   - Не выводить блоки подписей (`signatures`, `approval`) — они бессмысленны в HTML.
   - Имена PDF-файлов на сервере (`projects/renovation/pdf/**`) не должны содержать ФИО
     заказчика; при обнаружении — переименовать и обновить ссылки.
9. **Многошаговые задачи.** При сериях команд со ссылками на пункты («выполни пункт N»,
   «далее…», «после этого…») фиксировать план в todo-списке и сверяться с ним на каждом шаге.
   Перед откатом/возвратом «как было» показать, что именно будет изменено, и подтвердить.

## Деплой (кратко)

`scripts/deploy.mjs`: сборка → tar → scp → remote-скрипт (nginx не трогает). На сервере сохраняются: `server/.env`, `server/data/` (SQLite), `.well-known/`, подпапки проектов вне репозитория. Бэкап папок проектов не выполняется. Детали — в [README.md](README.md) «Деплой» и [docs/server.md](docs/server.md).

## Типичные грабли

- **Frontend dev 502:** если порты 3000/5173 заняты старыми инстансами, Vite поднимается на 3001/5174, а proxy всё равно целится в 3000 → 502 (dev-окружение, не код).
- **Новая VPS не видна в UI:** GET-кэш бэкенда 30с → после POST вызывать `onRefresh()` → `fetchVps(true)` (`?refresh=1`).
- **curl к защищённым API (`/api/vps`, `/api/projects`):** без сессии — 401 «Требуется авторизация». Сначала логин с сохранением cookie: `curl -c ck -X POST .../api/auth/login -H 'Content-Type: application/json' -d '{"username":"…","password":"…"}'`, затем `curl -b ck ...`. Мутации — только `admin` (403 «Недостаточно прав»). В PowerShell JSON передавать `--data-raw '{"username":...}'` (без `\"`).
- **`users.mjs`/`node` на сервере:** в неинтерактивной SSH-сессии node/pm2 не в PATH — полный путь `/home/rybnikov/.nvm/versions/node/v24.19.0/bin/node` (например `.../node scripts/users.mjs add ...` из `$SERVER`).
- **Backend 502 под pm2:** диагностика `ss -ltnp | grep 3000`, `curl -i http://127.0.0.1:3000/api/health`, `pm2 logs family-backend --lines 50 --nostream`. pm2 не в PATH в неинтерактивной сессии — полный путь `~/.nvm/versions/node/v24.19.0/bin/pm2`.
- **Второй хост `itg-ru-gw.rybnikov.su` (пользователь `rybnikov`, passwordless sudo):** деплой проходит успешно, но «бэкенд оффлайн» → те же проверки на хосте: `ss -ltnp | grep 3000`, `curl -i http://127.0.0.1:3000/api/health`, `NODE_ENV=production` и полный путь pm2; SSL — letsencrypt (`/etc/letsencrypt/live/itg-ru-gw.rybnikov.su/`).
- **nginx:** `proxy_pass http://127.0.0.1:3000;` без трейлинг-слэша, иначе срезается `/api` и Express отдаёт 404.
