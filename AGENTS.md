# AGENTS.md — Family

Монорепозиторий веб-приложения: **frontend** (React 19 + TypeScript + Vite, порт 5173) и **backend** (Node + Express 5 + Vite через `vite-plugin-node`, порт 3000). npm workspaces, общие dev-зависимости в корневом `package.json`. **Node ≥ 22.5** — реальное требование бэкенда (`node:sqlite`), `engines` в корневом `package.json` — `>=22.5.0`; на сервере v24.19.0.

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

- **Backend** (`backend/src/`): `app.ts` экспортирует `app` (Express); роуты `/api/health`, `/api/auth`, `/api/vps`, `/api/projects` → контроллеры → сервисы. Хранилище VPS — SQLite (`node:sqlite`): `db/database.ts` (синглтон `getDb()`, WAL + foreign_keys), `db/vpsRepository.ts`. Проверка доступности — `services/vpsChecker.ts` (кэш 30с + in-flight dedup, `?refresh=1` форсирует). **Live-binding:** после INSERT/DELETE VPS всегда вызывать `reloadVpsEntries()` (`config/vps.ts` перечитывает список из БД; работает и в ESM, и в CJS-бандле).
- **Авторизация** — весь портал закрыт входом (SPA + API). Пользователи/сессии — SQLite (`users`/`sessions`), пароли — только scrypt; токен в БД — SHA-256, клиенту — httpOnly `SameSite=Lax` cookie `sid`. `requireAuth` на роутах `/api/vps` и `/api/projects`, `requireAdmin` — на мутациях (POST/DELETE VPS, импорт, загрузка PDF); `/api/health` и `POST /api/auth/login` — публичны. Bootstrap-админ из `AUTH_BOOTSTRAP_PASSWORD` (при пустой `users`); учётки — `npm run user -w backend` (`backend/scripts/users.mjs`). Фронт: `hooks/useAuth.tsx` + `pages/LoginPage.tsx` + гейт в `App.tsx`; роль `admin` гейтит UI (VPS CRUD, загрузка PDF).
- **Frontend** (`frontend/src/`): `createHashRouter` (react-router-dom v7) — **hash-роутинг обязателен** (nginx `try_files ... =404`, нет SPA-fallback). HTTP-клиент `api/client.ts` (`VITE_API_BASE_URL ?? '/api'`; dev-прокси `/api`→`:3000`; на 401 рассылает `auth:unauthorized` → `useAuth` показывает вход). Тема light/dark/system — `hooks/useTheme.ts` + CSS-переменные в `index.css` + инлайн-скрипт в `index.html` (без «мигания»). **Кликабельная карточка с вложенной кнопкой** (паттерн карточки VPS): `<div role="button" tabIndex={0}>`; вложенная кнопка вызывает `event.stopPropagation()`, чтобы не открывать карточку.
- **Проекты** (`projects/`): статичные страницы, проект = подпапка с `index.html`. Мета-теги в `index.html`: `project-title`, `project-description`, `project-accent`, `project-icon`, `project-order`. Шаблон — `projects/_template/index.html` (`_*` в деплой не идёт).

Подробно: [README.md](README.md) (структура, .env, деплой) · [docs/specification.md](docs/specification.md) (общая спецификация + модульные `specification-{api,vps,projects,auth}.md`) · [docs/server.md](docs/server.md) (nginx, SSL, сервер, диагностика).

## Агенты (`.github/agents/`)

Специализированные роли — выбор в пикере чата. В локальном хранилище сессий интерактивные сессии пишутся как `GitHub Copilot Chat` (факт выбора агента в истории не виден), а реального «спавна» субагентов в этом окружении нет — «делегирование» означает ручной выбор в пикере.

| Задача                                                           | Агент             |
| ---------------------------------------------------------------- | ----------------- |
| Бэкенд (`backend/**`): API, SQLite, VPS-проверки, конфиг         | Backend Dev       |
| Фронтенд (`frontend/**`): UI, хуки, тема, маршруты               | Frontend Dev      |
| Сквозные фичи (бэкенд + фронтенд + синхронизация документации)   | Fullstack Dev     |
| Статичные страницы (`projects/**`), отчётность ремонта, PDF→HTML | Projects Dev      |
| Read-only исследование проектов                                  | Projects Explorer |

Fullstack Dev — **владелец контракта и координатор** сквозных фич: определяет API-контракт первым, сводит типы/хуки/контроллеры, гоняет `typecheck`, синхронно обновляет `docs/`. Для маленького монорепо он **делает работу напрямую** (исторически все сквозные фичи выполнены так, успешно и задеплоены) — субагентов задействовать **точечно**, только для изолированных суб-частей с жёстко заданным контрактом; его инструменты (`edit`/`execute`) не ограничивать.

## Правила

1. **Документация синхронно с кодом — обязательный чек-лист перед завершением.** При изменении кода (требования, конфиг, API, UI) обновлять **все**: модульные спецификации `docs/specification-*.md` (первой — соответствующая модульная спецификация; общий `docs/specification.md` — при изменении общих положений), затем `docs/server.md`, `README.md` и соответствующие `.env.example`, а при изменении команд/правил/граблей — и сам `AGENTS.md`. Для статичных страниц проектов (`projects/**`) при изменении макета/структуры — синхронно обновлять соответствующий навык (`.github/skills/*/SKILL.md`) и `docs/specification-projects.md`. Код корректен, если удовлетворяет критериям приёмки из модульной спецификации. Перед завершением задачи обязательно выполни:
   - `git status` → перечень изменённых файлов;
   - для каждого изменения определи, какие `docs/`, навыки (`.github/skills/*/SKILL.md`), `.env.example` и `AGENTS.md` оно затрагивает;
   - прогони grep по устаревшим маркерам (старые классы, удалённые подписи/поля, прежние числа) — по **всем** источникам (`docs/**`, `README.md`, `AGENTS.md`, `.github/skills/**`, `projects/**`), а не только по редактируемой спецификации (узкий поиск — типичный провал: README/server.md/навыки остаются неактуализированными); ничего не должно остаться;
   - в итоге явно перечисли, что обновлено, а что не тронуто и почему. Это требование, а не пожелание: «забыл» — недопустимо.
   - Не ждать отдельной команды «обнови/актуализируй документацию»: правки `docs/`, навыков
     (`.github/skills/*/SKILL.md`), `.env.example` и `AGENTS.md` входят в ту же задачу, что и код, — сразу после
     изменений прогонять этот чек-лист и вносить недостающее, не оставляя «на потом».
   - После правки самих инструкций (`AGENTS.md`, `.github/skills/*/SKILL.md`) проверять, что
     изменение реально легло в файл: `git diff` или grep по новому маркеру. Если правка не
     применилась — честно сообщить об этом, а не отчитываться о выполненном.
2. **Три независимых пространства `.env`** (реальные `.env` в git не попадают и не переопределяют уже заданные переменные окружения): корень — деплой (`DEPLOY_*`, читает `scripts/deploy.mjs`); `backend/.env` — рантайм (`PORT`, `CORS_ORIGIN`, `NODE_ENV`, `DB_PATH`, `PROJECTS_DIR`); `frontend/.env` — только `VITE_API_BASE_URL`.
3. **`npm run typecheck` — единственный gate.** `noUnusedLocals`/`noUnusedParameters` включены в обоих воркспейсах → неиспользуемые переменные/параметры — ошибки (TS6133); неиспользуемые параметры называть `_req`/`_next`. ESLint в репо нет.
4. **node:sqlite — осторожно:**
   - `db.transaction()` не реализован → ручные `BEGIN`/`COMMIT`/`ROLLBACK`.
   - Строки — `Record<string, SQLOutputValue>` → двойной каст `as unknown as MyRow`.
   - **Конфликт UNIQUE определять по `(err.errcode & 0xff) === 19`** (`isConstraintError`), НЕ по `err.code` (`ERR_SQLITE_ERROR`).
   - `mkdirSync(dirname(dbPath), {recursive:true})` обязателен до `new DatabaseSync()`.
   - Vite оставляет `node:sqlite` external (не инлайнит).
   - Требует Node ≥ 22.5 (`engines` в корневом `package.json` — `>=22.5.0`); на сервере v24.19.0.
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
10. **UI-итерации и позиционирование.** При правках отступов/выравнивания/порядка/размеров элементов:
    - относительные требования («ближе», «на четверть», «пропорции 4 к 3») переводить в конкретные
      значения (px/%) и при неоднозначности уточнять до применения;
    - применять маленькие обратимые шаги, чтобы не ломать соседние элементы (перед «переделкой»
      показывать, что именно меняется);
    - **проверять фактический результат в браузере после каждой правки, не полагаясь на «примерно так».**
      Страницу для проверки открывать самому через `open_browser_page` (статичные проекты —
      `file:///c:/Users/alex/Code/family/...`, приложение — dev-сервер `http://localhost:5173`) и проверять
      по ней, а не по вкладке пользователя (для вкладки пользователя нужен включённый «sharing with agent»);
    - **лестница проверки макета** (идти сверху вниз, пока не получен ответ):
      1. `read_page` — текстовый accessibility-снимок (структура, заголовки, таблицы, ссылки) — работает
         и без зрения модели;
      2. `run_playwright_code` — числовые замеры рендера: `getComputedStyle` (font-size, color, opacity),
         `getBoundingClientRect` (отступы/прижатость), `querySelectorAll` (счётчики элементов), обе темы
         (переключение через radio в шапке) — полная проверка даже без vision;
      3. `screenshot_page` + `view_image` — только если модель реально видит изображения (иначе
         `view_image` вернёт лишь URI без пикселей — см. «Типичные грабли»);
    - **не отказываться от проверки:** нельзя заявлять «инструментов браузерной автоматизации нет» или
      «не могу проверить» и перекладывать проверку на пользователя, пока не испробованы пункты 1–2;
      ошибка одного инструмента («disabled») не означает недоступность остальных — пробовать другие.
11. **Единый источник конвенций — без дублирования инструкций.** Конвенции кода живут **только** в
    `AGENTS.md`; навыки (`.github/skills/*/SKILL.md`) и агенты (`.github/agents/*.agent.md`) — только для
    специализированных процедур и ролей. **Не создавать `.github/instructions/`** — это дублирует
    `AGENTS.md` (в прошлом такие файлы удалялись как избыточные).
12. **Сообщения коммитов — Conventional Commits, на английском, в нижнем регистре.**
    Формат: `type: краткое описание` (императив, без точки в конце, ≤ ~72 символов).
    Типы: `feat` (новая возможность), `fix` (исправление), `docs` (документация),
    `refactor` (рефакторинг без изменения поведения), `chore` (обслуживание: зависимости,
    скрипты, конфиги), `style` (форматирование), `test`, `perf`, `build`, `ci`, `revert`.
    Примеры: `feat: add admin panel for user management`, `fix: update deployment process...`,
    `docs: update documentation checklist...`. Merge-коммиты (`Merge: ...`) — как есть, генерирует git.
    История переписывается только по явному запросу; опубликованную историю не менять.

## Деплой (кратко)

`scripts/deploy.mjs`: сборка → tar → scp → remote-скрипт (nginx не трогает). На сервере сохраняются: `server/.env`, `server/data/` (SQLite), `.well-known/`, подпапки проектов вне репозитория. Бэкап папок проектов не выполняется. Детали — в [README.md](README.md) «Деплой» и [docs/server.md](docs/server.md).

## Типичные грабли

- **Frontend dev 502:** если порты 3000/5173 заняты старыми инстансами, Vite поднимается на 3001/5174, а proxy всё равно целится в 3000 → 502 (dev-окружение, не код).
- **Зависшие dev-процессы на портах 3000/5173:** перед `npm run dev` проверять, что порты свободны: `Get-NetTCPConnection -LocalPort 5173,3000 -State Listen -ErrorAction SilentlyContinue | Select LocalPort, OwningProcess`; остановить зависший процесс: `Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object -Expand OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }` (повторить для 3000).
- **Новая VPS не видна в UI:** GET-кэш бэкенда 30с → после POST вызывать `onRefresh()` → `fetchVps(true)` (`?refresh=1`).
- **curl к защищённым API (`/api/vps`, `/api/projects`):** без сессии — 401 «Требуется авторизация». Сначала логин с сохранением cookie: `curl -c ck -X POST .../api/auth/login -H 'Content-Type: application/json' -d '{"username":"…","password":"…"}'`, затем `curl -b ck ...`. Мутации — только `admin` (403 «Недостаточно прав»). В PowerShell JSON передавать `--data-raw '{"username":...}'` (без `\"`).
- **`users.mjs`/`node` на сервере:** в неинтерактивной SSH-сессии node/pm2 не в PATH — полный путь `/home/rybnikov/.nvm/versions/node/v24.19.0/bin/node` (например `.../node scripts/users.mjs add ...` из `$SERVER`).
- **Backend 502 под pm2:** диагностика `ss -ltnp | grep 3000`, `curl -i http://127.0.0.1:3000/api/health`, `pm2 logs family-backend --lines 50 --nostream`. pm2 не в PATH в неинтерактивной сессии — полный путь `~/.nvm/versions/node/v24.19.0/bin/pm2`.
- **Второй хост `itg-ru-gw.rybnikov.su` (пользователь `rybnikov`, passwordless sudo):** деплой проходит успешно, но «бэкенд оффлайн» → те же проверки на хосте: `ss -ltnp | grep 3000`, `curl -i http://127.0.0.1:3000/api/health`, `NODE_ENV=production` и полный путь pm2; SSL — letsencrypt (`/etc/letsencrypt/live/itg-ru-gw.rybnikov.su/`).
- **nginx:** `proxy_pass http://127.0.0.1:3000;` без трейлинг-слэша, иначе срезается `/api` и Express отдаёт 404.
- **Модель без vision (Vision Proxy):** если `view_image` возвращает только URI без пикселей, а открытая
  вкладка приходит как «(not visible)» — у модели нет доступа к изображениям (настройка
  `github.copilot.chat.visionProxy` или модель с vision). Это **не повод** отказываться от проверки:
  работают `read_page` (текстовый снимок) и Playwright-замеры (`run_playwright_code`, computed
  styles/offsets) — см. лестницу проверки в правиле 10.
- **Один инструмент «disabled» ≠ браузер недоступен:** ошибка у одного инструмента (например
  `run_playwright_code` → «currently disabled by the user») не значит, что недоступны остальные
  (`open_browser_page`, `read_page`, `screenshot_page`) — пробовать их, прежде чем сдаться и просить
  пользователя проверить вручную.
