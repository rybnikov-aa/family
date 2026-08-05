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
├── README.md
├── docs/                     # спецификация и справочники (см. «Документация»)
│   ├── specification.md      # спецификация (Specification Driven Development)
│   └── server.md             # справочник по серверу/nginx/SSL/деплою
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
│       ├── hooks/            # пользовательские React-хуки
│       ├── pages/            # страницы приложения
│       └── vite-env.d.ts
│
└── backend/                  # Node + Express + Vite
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts        # dev-порт 3000, HMR через vite-plugin-node
    ├── .env.example
    └── src/
        ├── app.ts            # Express-приложение (экспорт app + автостарт при прямом запуске)
        ├── config/           # конфигурация окружения
        ├── routes/           # маршруты API
        ├── controllers/      # обработчики запросов
        ├── services/         # бизнес-логика
        ├── models/           # модели данных
        └── middlewares/      # middleware (ошибки, 404 и т.д.)
```

## Установка

Требуется Node.js **20+** и npm **10+**.

```bash
npm install
```

## Запуск

| Команда                | Описание                                           |
| ---------------------- | -------------------------------------------------- |
| `npm run dev`          | Запуск фронтенда и бэкенда одновременно            |
| `npm run dev:frontend` | Только фронтенд (http://localhost:5173)            |
| `npm run dev:backend`  | Только бэкенд (http://localhost:3000)              |
| `npm run build`        | Сборка фронтенда и бэкенда                         |
| `npm start`            | Запуск собранного бэкенда (`backend/dist/app.cjs`) |
| `npm run typecheck`    | Проверка типов во всех воркспейсах                 |
| `npm run format`       | Форматирование кода через Prettier                 |

## Как это работает

- **Фронтенд** запускается через Vite dev-сервер на порту `5173`. Запросы к `/api/*` проксируются на бэкенд (`vite.config.ts`), поэтому в разработке не нужен CORS.
- **Бэкенд** запускается через Vite c плагином `vite-plugin-node` — Express-приложение получает горячую перезагрузку при изменении кода. Приложение экспортируется из `src/app.ts`; при прямом запуске собранного `dist/app.cjs` (`npm start`) оно само стартует сервер на порту из `PORT`.
- **Общие dev-зависимости** (`typescript`, `vite`, `@vitejs/plugin-react`, `vite-plugin-node`, `@types/*`, `prettier`, `concurrently`) подняты в корневой `package.json`, рантайм-зависимости лежат в `frontend/` и `backend/` соответственно.

## Документация

Актуальные документы находятся в каталоге `docs/`:

| Файл                    | Назначение                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/specification.md` | Спецификация (Specification Driven Development): требования, архитектура, формулы доступности, критерии приёмки + Given/When/Then сценарии |
| `docs/server.md`        | Справочник по серверу: пути, nginx, SSL, деплой, диагностика                                                                               |

**Правило:** при внесении изменений в код (требования, схема конфига, API, поведение UI) необходимо **синхронно актуализировать документацию** в `docs/`: сначала обновляется спецификация, затем код. Код считается корректным, если удовлетворяет критериям приёмки из `docs/specification.md`.

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
- `/var/www/family.rybnikov.su/server` — папка не удаляется, содержимое очищается, **`.env` сохраняется** (не перезаписывается и не удаляется).

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
# cannot auto-detect them (e.g. /home/rybnikov/.nvm/versions/node/v20.19.0/bin)
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
