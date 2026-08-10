# Family — Web Application

Монорепозиторий веб-приложения: фронтенд на **React + TypeScript + Vite** и бэкенд на **Node.js + Express + Vite**. Управление зависимостями — через **npm workspaces** (общие dev-зависимости вынесены в корневой `package.json`).

## Структура проекта

```mermaid
graph TD
  A[package.json<br/>npm workspaces + общие dev-зависимости] --> B[frontend/]
  A --> C[backend/]
  B --> D[React + TypeScript + Vite]
  C --> E[Node + Express + Vite]
```

```
.
├── package.json              # npm workspaces, общие скрипты и dev-зависимости
├── tsconfig.base.json        # общая конфигурация TypeScript
├── .prettierrc.json          # единый стиль кода
├── .gitignore
├── AGENTS.md                 # инструкции для ИИ-агентов (команды, правила, грабли)
├── .github/                  # кастомизации для ИИ-агентов
│   ├── agents/               # агенты (специализированные роли, выбор в чате)
│   │   ├── frontend-dev.agent.md     # фронтенд-разработчик (React/TS/Vite)
│   │   ├── backend-dev.agent.md      # бэкенд-разработчик (Express/SQLite)
│   │   └── fullstack-dev.agent.md    # сквозные фичи (бэкенд + фронтенд)
│   └── skills/               # скиллы (загружаются по запросу)
│       # Навыки project-renovation-* архивированы: projects/skills-archive/ (история)
│       ├── vps/              # VPS-мониторинг: SKILL.md, справочник, scripts/list-vps.mjs
│       ├── deploy/           # деплой и диагностика сервера: SKILL.md, справочник
│       ├── project-import/   # создание проекта (через UI/БД, не статика)
│       └── parse-pdf/        # конвертация PDF → HTML (общий, для любых проектов)
│       # Навыки project-renovation-* архивированы: projects/skills-archive/ (история)
├── README.md
├── docs/                     # спецификация и справочники (см. «Документация»)
│   ├── specification.md      # общая спецификация (SDD) + модульные specification-{vps,projects,auth}.md
│   └── server.md             # справочник по серверу/nginx/SSL/деплою
│
├── projects/                 # история «Ремонта» + архивированные навыки/агенты (приложением не используется)
│   ├── styles.css            # общий дизайн/тема статичных страниц проектов (история)
│   ├── theme.js              # тема (light/dark/system) для статичных страниц проектов (история)
│   ├── icon-sprite.svg       # общий SVG-спрайт иконок (история)
│   ├── renovation/           # статичный архив «Ремонта»: сметы, акты, заказы (история)
│   │   ├── index.html        # главная страница статичного архива (сводка: Работы/Материалы + Примечания)
│   │   ├── estimate_seed.html # исходная смета (никогда не меняется)
│   │   ├── estimate.html     # актуальная смета (обновляется по доп. соглашениям)
│   │   ├── estimate_*.html   # исторические копии сметы (по датам доп. соглашений)
│   │   ├── Reports/          # отчёты: report_work, report_materials (итоговый — на index.html)
│   │   ├── Materials/        # заказы материалов (report_*.html) + взаиморасчёты по материалам
│   │   └── Works/            # акты работ (act_*.html) + взаиморасчёты по работам
│   ├── skills-archive/       # архивированные навыки project-renovation-* (история)
│   └── agents-archive/       # архивированные агенты Projects Dev/Explorer (история)
│
├── frontend/                 # React + TypeScript + Vite
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts        # dev-порт 5173, proxy /api -> :3000
│   ├── index.html
│   ├── .env.example
│   └── src/
│       ├── main.tsx          # точка входа React
│       ├── App.tsx           # корневой компонент
│       ├── index.css         # глобальные стили
│       ├── api/              # HTTP-клиент (fetch к /api)
│       ├── components/       # переиспользуемые UI-компоненты
│       ├── hooks/            # пользовательские React-хуки (в т.ч. useAuth — авторизация)
│       ├── pages/            # страницы приложения (в т.ч. LoginPage — экран входа)
│       └── vite-env.d.ts
│
└── backend/                  # Node + Express + Vite
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts        # dev-порт 3000, HMR через vite-plugin-node
    ├── .env.example
    ├── scripts/              # CLI: users.mjs (учётки), extract_pdf.py (импорт PDF «Ремонта»)
    └── src/
        ├── app.ts            # Express-приложение (экспорт app + автостарт при прямом запуске)
        ├── config/           # конфигурация окружения + типы VPS
        ├── db/               # SQLite (node:sqlite): соединение + репозиторий VPS
        ├── routes/           # маршруты API (в т.ч. auth — вход/выход/me)
        ├── controllers/      # обработчики запросов
        ├── services/         # бизнес-логика (VPS, авторизация; renovation/domain — данные «Ремонта»)
        └── middlewares/      # middleware (ошибки, 404, requireAuth/requireAdmin)
```

## Установка

Требуется Node.js **20+** и npm **10+**.

```bash
npm install
```

## Запуск

| Команда                   | Описание                                                                    |
| ------------------------- | --------------------------------------------------------------------------- |
| `npm run dev`             | Запуск фронтенда и бэкенда одновременно                                     |
| `npm run dev:frontend`    | Только фронтенд (http://localhost:5173)                                     |
| `npm run dev:backend`     | Только бэкенд (http://localhost:3000)                                       |
| `npm run build`           | Сборка фронтенда и бэкенда                                                  |
| `npm start`               | Запуск собранного бэкенда (`backend/dist/app.cjs`)                          |
| `npm run typecheck`       | Проверка типов во всех воркспейсах                                          |
| `npm run format`          | Форматирование кода через Prettier                                          |
| `npm run user -w backend` | Управление пользователями авторизации (`add`, `list`, `set-role`, `remove`) |

## Как это работает

- **Фронтенд** запускается через Vite dev-сервер на порту `5173`. Запросы к `/api/*` проксируются на бэкенд (`vite.config.ts`), поэтому в разработке не нужен CORS.
- **Бэкенд** запускается через Vite c плагином `vite-plugin-node` — Express-приложение получает горячую перезагрузку при изменении кода. Приложение экспортируется из `src/app.ts`; при прямом запуске собранного `dist/app.cjs` (`npm start`) оно само стартует сервер на порту из `PORT`.
- **Хранилище VPS** — SQLite (встроенный `node:sqlite`, без новых зависимостей). Файл БД — `backend/data/vps.sqlite` (путь через `DB_PATH`), наполняется вручную, через форму добавления VPS в UI (`POST /api/vps`), импортом из JSON-файла структуры `vps.json` (`POST /api/vps/import`) или удаляется через кнопку-корзину в детализации (`DELETE /api/vps/:name`); схема таблиц создаётся автоматически при первом обращении. В git не попадает, при деплое не затирается.
- **Раздел «Проекты»** — все проекты прикладные (`kind: 'app'`): встроенный реестр `backend/src/config/appProjects.ts` («Ремонт») + записи БД `projects` (созданные через UI). Список динамический: `GET /api/projects` = реестр + БД (без сканирования файловой системы). Страницы проектов — маршруты приложения (`#/projects/<slug>`), наследуют стиль и тему приложения.
- **Данные «Ремонта» (этапы 1–7)** — отчётность в отдельной БД `backend/data/renovation.sqlite` (путь — `RENOVATION_DB_PATH`, не путать с `DB_PATH` — это базы разных модулей; обе сохраняются при деплое). Домен — `backend/src/services/renovation/domain/` (чистые типы + деньги в копейках). Наполнение — **штатное, через импорт PDF в приложении** (`POST /api/renovation/pdf` → черновик → подтверждение); seed из статичных HTML убран. Просмотр — read-API `/api/renovation/*` и страница `#/projects/renovation` (сводка Работы /
  Материалы + отчёты по ссылкам «Ход работ»/«Закупка материалов» — открываются в модальном окне). Импорт PDF (этап 3) — кнопка «Импорт PDF» на странице «Ремонт» (admin): `pdfplumber` через Python-subprocess, черновик → подтверждение; подтверждённый PDF сохраняется в `RENOVATION_DOCS_DIR` (по умолчанию `docs/renovation`, на сервере — `server/docs/renovation`, сохраняется при деплое) и раздаётся через `GET /api/renovation/docs/:file`; «Отчёт №N» в «Блоке 2. Материалы» и в отчёте «Материалы» — ссылки на исходные PDF, просмотр — встроенный pdf.js (`PdfViewerModal`). Доп. соглашения (этап 4) — кнопка «Доп. соглашение» (admin): дифф по наименованиям (было/стало, добавление/удаление), подтверждение → старая смета `current` замораживается как `history`, создаётся новая `current` с пересчитанными итогами (см. `docs/specification-renovation.md`).
- **Создание/изменение/удаление проектов** — на странице «Проекты» (admin): «Создать проект» → `POST /api/projects` (JSON `{slug, title, description, accent?, icon?, order?, content?}`); редактирование и удаление — `PATCH`/`DELETE /api/projects/:slug` (кнопки на карточке/странице, только для созданных через UI). Бэкенд пишет в БД `projects` (метаданные + markdown-контент), **файлов и папок не создаёт** — проект сразу появляется в списке и открывается по `#/projects/<slug>`, без деплоя. Встроенные проекты (реестр) редактировать/удалять нельзя.
- **Авторизация** — весь портал (SPA и API) закрыт входом: без сессии фронтенд показывает экран входа, API отвечает 401. Учётные записи хранятся в SQLite (таблицы `users` + `sessions`), пароли — только хэши scrypt; вход/выход по httpOnly `SameSite=Lax` cookie (`sid`, в проде `Secure`). Роли: `admin` (управление VPS, создание проектов, управление пользователями) и `user` (чтение). Первый администратор создаётся при старте из `AUTH_BOOTSTRAP_PASSWORD` (если в БД нет пользователей), дальнейшие учётки — `npm run user -w backend` или админ-панель в приложении (по клику на бейдж «админ» в шапке). CLI входит в деплой (`server/scripts/users.mjs`), поэтому учётками можно управлять и прямо на сервере. Эндпоинты: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `PATCH /api/auth/profile`, админ-эндпоинты `/api/auth/admin/users*`. Имя и пароль своей учётки пользователь меняет сам на странице «Профиль» (по клику на имя в шапке).
- **Общие dev-зависимости** (`typescript`, `vite`, `@vitejs/plugin-react`, `vite-plugin-node`, `@types/*`, `prettier`, `concurrently`) подняты в корневой `package.json`, рантайм-зависимости лежат в `frontend/` и `backend/` соответственно.

## Управление пользователями

Портал закрыт авторизацией: учётные записи хранятся в SQLite (таблицы `users` + `sessions`), пароли — хэши scrypt (без новых зависимостей, `node:crypto`). Роли: `admin` (управление VPS, создание проектов, управление пользователями) и `user` (чтение). Отображаемое имя и пароль своей учётки пользователь меняет на странице «Профиль» (`PATCH /api/auth/profile`; смена пароля — с подтверждением текущим).

**Первый администратор** создаётся автоматически при старте бэкенда, если в `users` нет записей и в `.env` задан `AUTH_BOOTSTRAP_PASSWORD` (учётка `admin`; имя/отображаемое имя — `AUTH_BOOTSTRAP_USERNAME`/`AUTH_BOOTSTRAP_NAME`). После первого входа переменную рекомендуется убрать.

**Остальные учётки** — двумя способами:

1. **Админ-панель в приложении** — по клику на бейдж «админ» в шапке открывается страница «Пользователи» (`#/admin/users`, только для роли `admin`): список учётных записей, добавление пользователя (логин/имя/роль/пароль), принудительная смена пароля и удаление (кроме собственной учётки). API — `/api/auth/admin/users*`.
2. **CLI** `npm run user -w backend` (скрипт `backend/scripts/users.mjs`, работает без сборки, тот же формат хэша):

| Команда                                                     | Что делает                                                              |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| `add <username> <name> <admin\|user> [--password <пароль>]` | Создать пользователя (пароль можно ввести интерактивно, не эхонируется) |
| `list`                                                      | Список пользователей (username, имя, роль, дата создания)               |
| `set-role <username> <admin\|user>`                         | Сменить роль                                                            |
| `remove <username>`                                         | Удалить пользователя                                                    |

Пример (локально, из корня репозитория):

```bash
npm run user -w backend -- add mama Мама user --password 'пароль'
npm run user -w backend -- add papa Папа admin
npm run user -w backend -- list
```

**На сервере** скрипт входит в деплой (`server/scripts/users.mjs`). В неинтерактивной SSH-сессии `node` нет в PATH, поэтому запускайте полным путём:

```bash
cd /var/www/family.rybnikov.su/server
/home/rybnikov/.nvm/versions/node/v24.19.0/bin/node scripts/users.mjs add mama Мама user
```

## Конфигурация окружения (файлы `.env`)

В проекте три независимых «пространства» переменных окружения. У каждого есть шаблон `.env.example` (в git, документированный) и, при необходимости, реальный `.env` (в git не попадает). Реальные `.env` не переопределяют уже заданные переменные окружения процесса.

| Файл            | Кто читает                                  | Переменные                                                                                                                     |
| --------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Корневой `.env` | `scripts/deploy.mjs` (деплой)               | `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PORT`, `DEPLOY_FRONTEND_DIR`, `DEPLOY_BACKEND_DIR`, `DEPLOY_PM2_APP`, `DEPLOY_NODE_PATH` |
| `backend/.env`  | Бэкенд (`src/config/env.ts` через `dotenv`) | `PORT`, `CORS_ORIGIN`, `NODE_ENV`, `DB_PATH`, `AUTH_COOKIE_NAME`, `SESSION_TTL_HOURS`, `AUTH_BOOTSTRAP_*`, `RENOVATION_*`      |
| `frontend/.env` | Vite (только `VITE_*`)                      | `VITE_API_BASE_URL`                                                                                                            |

- **Корневой `.env` / `.env.example`** — конфигурация **деплоя** (SSH-хост, пользователь, пути на сервере, имя pm2-приложения). Загружается `scripts/deploy.mjs` собственным мини-загрузчиком. Шаблон — `.env.example` в корне.
- **`backend/.env.example`** — конфигурация **рантайма бэкенда**: порт API (`PORT`), разрешённый CORS-origin (`CORS_ORIGIN`), окружение (`NODE_ENV`), путь к SQLite-базе (`DB_PATH`, по умолчанию `data/vps.sqlite`; в той же БД — таблица `projects`), а также авторизация: `AUTH_COOKIE_NAME` (имя cookie сессии, `sid`), `SESSION_TTL_HOURS` (срок жизни сессии, 168 ч), `AUTH_BOOTSTRAP_PASSWORD`/`AUTH_BOOTSTRAP_USERNAME`/`AUTH_BOOTSTRAP_NAME` (создание первого администратора при старте, если в БД нет пользователей). Модуль «Ремонт» — `RENOVATION_DB_PATH`/`RENOVATION_DOCS_DIR` (каталог загруженных PDF)/`RENOVATION_PYTHON`/`RENOVATION_EXTRACT_SCRIPT`. В dev подхватывается `dotenv` из `backend/.env`; в проде — из `server/.env`, который сохраняется при деплое. Переменной `PROJECTS_DIR` больше нет — проекты хранятся в БД.
- **`frontend/.env.example`** — конфигурация **фронтенда**: только переменные с префиксом `VITE_`. `VITE_API_BASE_URL` задаёт базовый URL API (пусто → Vite dev-прокси `/api` → `:3000`), используется в `src/api/client.ts`.

Общее правило: `.env.example` — документированный шаблон в git; реальный `.env` — локальный/серверный, в git не попадает (см. `.gitignore`).

## Документация

Актуальные документы находятся в каталоге `docs/`:

| Файл                               | Назначение                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `docs/specification.md`            | Общая спецификация (SDD): обзор, архитектура, конфигурация, ADR, карта файлов + указатель на модульные |
| `docs/specification-api.md`        | Спецификация API: все эндпоинты, матрица доступа, форматы ответов, коды ошибок                         |
| `docs/specification-vps.md`        | Спецификация модуля VPS-мониторинг (FR-1…FR-9, критерии, сценарии)                                     |
| `docs/specification-projects.md`   | Спецификация модуля «Проекты» (FR-10, критерии, сценарии, проект «Ремонт»)                             |
| `docs/specification-auth.md`       | Спецификация модуля «Авторизация» (FR-11, критерии, сценарии, управление пользователями)               |
| `docs/specification-renovation.md` | Спецификация data-слоя модуля «Ремонт» (домен, отдельная БД, seed-импорт, верификация)                 |
| `docs/server.md`                   | Справочник по серверу: пути, nginx, SSL, деплой, диагностика                                           |

Помимо `docs/`, в корне есть `AGENTS.md` — инструкции для ИИ-агентов (команды, правила, типичные грабли). Специализированные рабочие процессы вынесены в `.github/`: скиллы `.github/skills/` (например, `vps` — VPS-мониторинг, `deploy` — деплой и диагностика сервера) и агенты `.github/agents/` (например, `frontend-dev`, `backend-dev` и `fullstack-dev` — разработка фронтенда, бэкенда и сквозных фич). Все конвенции кода (фронтенд/бэкенд) сосредоточены в `AGENTS.md`.

**Правило:** при внесении изменений в код (требования, схема конфига, API, поведение UI) необходимо **синхронно актуализировать документацию** в `docs/`: сначала обновляется соответствующая модульная спецификация (`docs/specification-*.md`; общий `docs/specification.md` — при изменении общих положений), затем код. Код считается корректным, если удовлетворяет критериям приёмки из модульной спецификации. Новые или изменившиеся конвенции и скиллы для агентов отражать также в `AGENTS.md` и `.github/skills/`.

## Проверка

После `npm run dev` откройте http://localhost:5173 — страница покажет статус бэкенда (ответ `/api/health`).

## Деплой на family.rybnikov.su

Публикация выполняется скриптом `scripts/deploy.mjs` (команда `npm run deploy`). Он собирает проект, загружает файлы по SSH (scp) и разворачивает их на сервере:

| Что                                      | Куда на сервере                           |
| ---------------------------------------- | ----------------------------------------- |
| Фронтенд (`frontend/dist`)               | `/var/www/family.rybnikov.su/public_html` |
| Бэкенд (`backend/dist` + `package.json`) | `/var/www/family.rybnikov.su/server`      |

После загрузки скрипт на сервере: обновляет файлы, ставит production-зависимости (`npm install --omit=dev`) и перезапускает приложение под `pm2` (`pm2 restart family-backend`, при первом запуске — `pm2 start dist/app.cjs`). Если `pm2` на сервере не установлен (или не виден в PATH), скрипт сам найдёт его в типовых местах либо установит глобально (`npm install -g pm2`).

**Очистка каталогов на сервере:**

- `/var/www/family.rybnikov.su/public_html` — сама папка **никогда не удаляется**. При деплое удаляются только файлы верхнего уровня (`index.html` и т.п.) и подпапка `assets/` (результат сборки Vite), а прочие подпапки (например `.well-known`) сохраняются.
- `/var/www/family.rybnikov.su/server` — папка не удаляется, содержимое очищается, **`.env`, `data/` (SQLite-базы) и `docs/` (загруженные PDF «Ремонта») сохраняются** (не перезаписываются и не удаляются).
- **`projects/` репозитория** (история «Ремонта» + архивированные навыки) на сервер не копируется; `server/renovation-source/` и seed «Ремонта» упразднены. Статичные страницы проектов деплой не зеркалирует (все проекты живут в приложении); статичный архив `public_html/projects/` на сервере удалён.

Посмотреть, что именно выполняется на сервере, без деплоя:

```bash
node scripts/deploy.mjs --print-script
```

```bash
npm run deploy                  # сборка + публикация + рестарт
npm run deploy -- --no-build    # без локальной сборки
npm run deploy -- --no-restart  # без перезапуска pm2
```

### Настройка

Параметры задаются в корневом файле `.env` (загружается скриптом автоматически, в git не коммитится). Шаблон — `.env.example`:

```bash
DEPLOY_HOST=family.rybnikov.su   # SSH host
DEPLOY_USER=rybnikov             # SSH user
DEPLOY_PORT=22                   # SSH port
DEPLOY_FRONTEND_DIR=/var/www/family.rybnikov.su/public_html
DEPLOY_BACKEND_DIR=/var/www/family.rybnikov.su/server
DEPLOY_PM2_APP=family-backend    # pm2 app name

# Optional: bin directory with node/npm ON THE SERVER, if the remote script
# cannot auto-detect them (e.g. /home/rybnikov/.nvm/versions/node/v24.19.0/bin)
# DEPLOY_NODE_PATH=
```

В неинтерактивной SSH-сессии PATH часто минимален, поэтому Node.js, установленный через nvm или в нестандартный каталог, может быть не виден. Серверный скрипт сам ищет `node`/`npm`: подключает профили пользователя (`~/.profile`, `~/.bashrc`, `nvm.sh`) и проверяет типовые пути (`~/.nvm/...`, `/usr/local/bin`, `/usr/bin` и др.). Если этого мало — задайте `DEPLOY_NODE_PATH` (каталог с `node`/`npm` на сервере).

Проверить итоговую конфигурацию без деплоя:

```bash
node scripts/deploy.mjs --print-config
```

Пример с другим пользователем и портом (PowerShell, переменные окружения имеют приоритет над `.env`):

```powershell
$env:DEPLOY_USER = "ubuntu"; $env:DEPLOY_PORT = "2222"; npm run deploy
```

### Требования

- На машине разработки установлен OpenSSH-клиент (`ssh`/`scp`) — встроен в Windows 10+.
- Рекомендуется настроить **SSH-ключ** (`ssh-keygen` + `ssh-copy-id`), чтобы деплой шёл без запросов пароля. Пароль/ключ нигде не хранятся — скрипт только вызывает ssh/scp.
- На сервере установлены `node`/`npm` и `pm2`, а также `.env` в `/var/www/family.rybnikov.su/server` с нужными значениями (`PORT`, `CORS_ORIGIN=https://family.rybnikov.su` и т.д.).
- Для отдачи статики фронтенда и проксирования `/api` на порт бэкенда на сервере должен быть настроен веб-сервер (например, nginx).
