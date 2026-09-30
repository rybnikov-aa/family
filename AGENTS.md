# AGENTS.md — Family

Монорепозиторий веб-приложения: **frontend** (React 19 + TypeScript + Vite, порт 5173) и **backend** (Node + Express 5 + Vite через `vite-plugin-node`, порт 3000). npm workspaces, общие dev-зависимости в корневом `package.json`. **Node ≥ 22.5** — реальное требование бэкенда (`node:sqlite`), `engines` в корневом `package.json` — `>=22.5.0`; на сервере v24.19.0.

> ⚠️ **`renovation_source/` удалена** (была временной, исключённой из анализа и деплоя). Рабочие данные «Ремонта» живут в БД `data/renovation.sqlite` (через импорт PDF); статичный архив `projects/renovation/` — только история (см. правило 7).

## Команды

| Команда                    | Что делает                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`              | Фронтенд + бэкенд одновременно (concurrently)                                                                                                                                                    |
| `npm run build`            | Сборка frontend (`tsc --noEmit && vite build`) + backend (`vite build`)                                                                                                                          |
| `npm run typecheck`        | `tsc --noEmit` во всех воркспейсах — **единственный статический gate** (lint/тестов нет)                                                                                                         |
| `npm run format`           | Prettier (`.prettierrc.json`: singleQuote, semi, printWidth 100, trailingComma all)                                                                                                              |
| `npm run start -w backend` | Запуск собранного бэкенда (`node dist/app.cjs`) — `start` есть только в backend-воркспейсе                                                                                                       |
| `npm run deploy`           | Публикация на `my.rybnikov.su`; флаги: `--no-build`, `--no-restart`, `--no-pdf-setup`, `--print-script`, `--print-config`                                                                        |
| `npm run backup`           | Полный бэкап runtime-данных основного сервера (`data/`+`docs/`+`images/`+`.env` + справочные nginx/SSL); флаги: `--local`, `--remote-only`, `--install-cron`, `--print-script`, `--print-config` |
| `npm run restore`          | Восстановление сайта из бэкапа на целевой сервер (цель — `DEPLOY_HOST`/`--host`, каталог/имя — `RESTORE_*`); флаги: `--no-env`, `--dry-run`, `--skip-health`, `--print-script`                   |
| `npm run sanity:test`      | Набор API sanity-тестов; URL и credentials через `SANITY_*`                                                                                                                                      |

## Архитектура (кратко)

- Структура backend и общий request flow описаны в [backend layer](docs/layers/backend.md), сквозная auth/upload/error обработка — в [middleware layer](docs/layers/middleware.md), HTTP-контракты — в [API layer](docs/layers/api.md).
- Frontend-маршрутизация, состояние и API-клиент описаны в [frontend layer](docs/layers/frontend.md); UI-токены и примитивы — в [design system](docs/layers/design-system.md).
- Поведение, данные и критерии приемки модулей описаны в соответствующих [domain specs](docs/domains/); внешние интеграции и production-процедуры имеют отдельные владельцы, перечисленные в [specification index](docs/specification.md).

Подробно: [README.md](README.md) · [docs/specification.md](docs/specification.md) · [docs/layers/](docs/layers/) · [docs/domains/](docs/domains/) · [ADR index](docs/adr/index.md) · [Immich integration](docs/integrations/immich.md) · [backup](docs/operations/backup.md) · [server operations](docs/operations/server.md).

## Агенты (`.github/agents/`)

| Задача                                                         | Агент         |
| -------------------------------------------------------------- | ------------- |
| Бэкенд (`backend/**`): API, SQLite, VPS-проверки, конфиг       | Backend Dev   |
| Фронтенд (`frontend/**`): UI, хуки, тема, маршруты             | Frontend Dev  |
| Сквозные фичи (бэкенд + фронтенд + синхронизация документации) | Fullstack Dev |

## Харнесс и память репозитория

- **Обязательные ограничения** собраны в [.github/harness/guardrails.md](.github/harness/guardrails.md) и действуют для всех ролей и навыков.
- Долговременный контекст проекта хранится в Git. `.github/harness/repo-memory.md` — необязательный, версионируемый владелец только уникальных операционных фактов без другого владельца в спецификациях, навыках или runbooks.
- **Маршрут восстановления контекста:** начни с `docs/specification.md`; затем открой владельца задачи в `docs/domains/`, `docs/layers/`, `docs/integrations/`, `docs/operations/` или `docs/policies/`. Для связей требований, реализации и проверок используй `docs/traceability.md`, для решений — `docs/adr/index.md`; выбери процедуру из `.github/skills/` и проверь описанные факты по исходникам.
- README — обзор и пользовательская точка входа; нормативные факты хранятся в связанных документах-владельцах.
- **Каркас харнесса для нового проекта — навык `.github/skills/harness-init/`** и его версионируемые шаблоны `references/*`; `.github/prompts/init-harness.prompt.md` — обертка, запускающая этот навык.

## Правила

1. **Документация синхронно с кодом — обязательный чек-лист перед завершением.** Обновляй документы по фактическому влиянию изменения:
  - поведение, данные или UI-макет домена → соответствующую `docs/domains/<домен>.md`;
  - общая архитектура или карта документов → `docs/layers/<слой>.md` и при изменении общих положений `docs/specification.md`;
  - общий HTTP-контракт → `docs/layers/api.md` и затронутые домены;
  - изменения связей CJ/FR/NFR/HR, владельцев реализации или проверок → `docs/traceability.md` и затронутые индексы;
  - frontend-токены, примитивы и общая процедура визуальной проверки → `docs/layers/design-system.md`;
  - внешняя интеграция → `docs/integrations/<сервис>.md`; эксплуатационные runbooks → `docs/operations/`;
  - внешняя ценовая или модельная политика → `docs/policies/`;
  - переменные окружения → соответствующие `.env.example` и документацию конфигурации;
  - деплой, production-инфраструктура или серверные операции → `docs/operations/server.md`;
  - команды установки/запуска, пользовательский обзор или публикация → соответствующий раздел `README.md`;
  - общие конвенции, команды или подтвержденные грабли → `AGENTS.md`; специализированная процедура → соответствующий навык;
  - значимое архитектурное решение → отдельный ADR-файл в `docs/adr/` с записью в `docs/adr/index.md`.

   Не меняй документы, которых изменение не касается; в итоговом сообщении укажи, что обновлено и что не требовало обновления. Код, меняющий поведение модуля, принимается по его критериям из спецификации. Перед завершением:
   - проверь `git status` и определи затронутые документы;
   - ищи устаревшие маркеры во всех относящихся к изменению источниках (`docs/**`, `README.md`, `AGENTS.md`, `.github/skills/**`, `projects/**`);
   - после изменения инструкций или шаблонов проверь, что текст действительно обновлен.

   Синхронизация является частью завершения задачи. Не откладывай нужные документационные изменения до отдельного запроса.

2. **Три независимых пространства `.env`** (реальные `.env` в git не попадают и не переопределяют уже заданные переменные окружения): корень — деплой (`DEPLOY_*`, читает `scripts/deploy.mjs`); `backend/.env` — рантайм (`PORT`, `CORS_ORIGIN`, `NODE_ENV`, `DB_PATH`, `RENOVATION_*`, `DIARY_*`); `frontend/.env` — только `VITE_API_BASE_URL`.
3. **`npm run typecheck` — единственный gate.** `noUnusedLocals`/`noUnusedParameters` включены в обоих воркспейсах → неиспользуемые переменные/параметры — ошибки (TS6133); неиспользуемые параметры называть `_req`/`_next`. ESLint в репо нет.
4. **node:sqlite — осторожно:**
   - `db.transaction()` не реализован → ручные `BEGIN`/`COMMIT`/`ROLLBACK`.
   - Строки — `Record<string, SQLOutputValue>` → двойной каст `as unknown as MyRow`.
   - **Конфликт UNIQUE определять по `(err.errcode & 0xff) === 19`** (`isConstraintError`), НЕ по `err.code` (`ERR_SQLITE_ERROR`).
   - `mkdirSync(dirname(dbPath), {recursive:true})` обязателен до `new DatabaseSync()`.
   - Vite оставляет `node:sqlite` external (не инлайнит).
   - `db.exec(sql)` **не принимает параметры** (в отличие от `prepare().run(...)`): `exec('DELETE … WHERE id = ?', id)` тихо ничего не удаляет (знак `?` трактуется буквально) — использовать `prepare().run(id)`.
   - Требует Node ≥ 22.5 (`engines` в корневом `package.json` — `>=22.5.0`); на сервере v24.19.0.
5. **`app.listen` гейтится** в `app.ts`: слушать при `NODE_ENV=production` ЛИБО прямом запуске. Под pm2 `process.argv[1]` — враппер pm2 (не скрипт) → argv-проверка даёт `false`; основной сигнал — `NODE_ENV=production` (ставит деплой-скрипт). В dev Vite монтирует `app` сам — слушать нельзя.

- Грабли импорта PDF и решения парсера описаны в `docs/domains/renovation.md` §5.1; здесь не дублируются.

6. **Язык.** Комментарии в коде и строки UI — на русском. Иконки — инлайн SVG-компоненты (`stroke=currentColor`) в `frontend/src/components/icons.tsx`.
7. **Модуль «Ремонт» (`renovation`): данные ведутся в приложении, seed из статичных HTML убран.**
   - Новые документы добавляются через импорт PDF (admin, модалка «Импорт PDF»):
     `POST /api/renovation/pdf` → черновик → подтверждение; документ с номером при повторной
     загрузке с тем же номером заменяется (удаляется предыдущая версия), иначе —
     идемпотентность тип+дата → 409.
     PDF, уже сохранённые в БД и не имеющие номера (а также ведомости/доп. соглашения),
     повторно не импортировать.
   - Документы сметы и дизайн-проекта — модалки «Смета»/«Дизайн-проект» (данные из БД и
     хранилища `docs/renovation/`); просмотр PDF — встроенным просмотрщиком `PdfViewerModal`.
   - Статичные HTML `projects/renovation/**` и старые навыки `project-renovation-*` — только
     история: архив `projects/skills-archive/`; не использовать, не править, не загружать как навыки.
8. **Конфиденциальность в документах «Ремонта».** Ограничения на персональные данные, блоки
   подписей и имена PDF заданы в [.github/harness/guardrails.md](.github/harness/guardrails.md).
9. **Многошаговые задачи.** При сериях команд со ссылками на пункты («выполни пункт N»,
   «далее…», «после этого…») фиксировать план в todo-списке и сверяться с ним на каждом шаге.
   Перед откатом/возвратом «как было» показать, что именно будет изменено, и подтвердить.
   - **Контроль контекста в длинных задачах:** вести видимый актуальный todo, фиксировать
     долговременные решения/факты в их Git-трекнутых документах и при возобновлении следовать
     маршруту восстановления контекста выше. Не допускать бесконечных повторов
     («продолжай»/«Continue to iterate?»/«Try Again» по кругу): если ход зациклился или задача
     разрослась — остановиться, сжать контекст и предложить новую сессию или сузить scope.
   - **Проактивное управление контекстом:** при длинной сессии (сотни ходов) или подозрении на потерю
     контекста (не удаётся найти файл, повторно решается одна проблема) — перечитать источники по
     маршруту выше и проверить их по коду; если контекст раздут или ход зациклен — **предложить
     `/compact` или новую сессию**, а не продолжать повтор.
10. **UI-позиционирование и визуальная проверка.** Неоднозначные относительные размеры уточнять;
    новые элементы оформлять по [дизайн-системе](docs/layers/design-system.md), а фактический рендер
    проверять по описанной там процедуре. Не удалять и не перемещать существующие элементы без
    запроса пользователя (см. `.github/harness/guardrails.md`).
11. **Единый источник конвенций — без дублирования инструкций.** Общие конвенции живут в
    `AGENTS.md`, обязательные ограничения — в `.github/harness/guardrails.md`, поведение и критерии
    приемки — в спецификациях. Навыки и агенты содержат только специализированные процедуры,
    область роли и настройки инструментов. **Не создавать `.github/instructions/`** с копией
    общих конвенций.
12. **Сообщения коммитов — Conventional Commits, на английском, в нижнем регистре.**
    Формат: `type: краткое описание` (императив, без точки в конце, ≤ ~72 символов).
    Типы: `feat` (новая возможность), `fix` (исправление), `docs` (документация),
    `refactor` (рефакторинг без изменения поведения), `chore` (обслуживание: зависимости,
    скрипты, конфиги), `style` (форматирование), `test`, `perf`, `build`, `ci`, `revert`.
    Примеры: `feat: add admin panel for user management`, `fix: update deployment process...`,
    `docs: update documentation checklist...`. Merge-коммиты (`Merge: ...`) — как есть, генерирует git.
    История переписывается только по явному запросу; опубликованную историю не менять.
13. **PDF-ссылки — только через `PdfLink`.** Ссылка, открывающая просмотр PDF (встроенный
    просмотрщик `PdfViewerModal`), оформляется компонентом `PdfLink`
    (`frontend/src/components/PdfLink.tsx`): иконка документа перед текстом обязательна
    (дизайн-правило, задокументировано в `docs/layers/design-system.md`). Применять во всех списках
    документов «Ремонта» (карточки-сводки «Работы»/«Материалы», ведомости взаиморасчётов,
    отчёты, модалки «Смета»/«Дизайн-проект»); новые PDF-ссылки — только через него, без ручных
    `renov-link`-кнопок с PDF.
14. **Конфигурация production-сервера.** `my.rybnikov.su` — единственная управляемая цель
    публикации. Правки nginx, `server/.env`, pm2 и зависимостей проверять на production-хосте
    командами health, порт и `nginx -t`. Справочник — `docs/operations/server.md`.
15. **DeepSeek pricing gate.** При выборе модели DeepSeek до анализа выполняй процедуру и условия
    подтверждения из [DeepSeek pricing policy](docs/policies/deepseek-pricing.md); актуализация цен и окна ведется там же.
16. **Зависимости.** Не добавлять npm-зависимости без явного запроса пользователя.
17. **Именование записей ADR/CJ/FR/NFR/HR.** Каждая запись хранится отдельным файлом в каталоге
  своей категории: `docs/adr/adr-xxx-short-name.md`, `docs/cj/cj-xxx-short-name.md`,
  `docs/fr/fr-xxx-short-name.md`, `docs/nfr/nfr-xxx-short-name.md`,
  `docs/hr/hr-xxx-short-name.md`. `xxx` — следующий порядковый номер с нулями слева
  (`001`–`999` отдельно для каждого префикса; номера не переиспользуются). `short-name` — короткое
  имя на английском языке, строчными латинскими буквами (`a`–`z`), слова разделяются дефисами;
  цифры, кириллица и иные символы запрещены. В каждой папке `index.md` — индекс записей.

## Деплой (кратко)

`scripts/deploy.mjs`: сборка → tar → scp → remote-скрипт (nginx не трогает), публикация —
только на `my.rybnikov.su` через `npm run deploy`. На сервере сохраняются `server/.env`,
`server/data/` (SQLite), `server/docs/` (загруженные PDF «Ремонта»), `server/images/`
(изображения «Дневника») и `.well-known/`. Статичные страницы проектов не зеркалируются;
`projects/` репозитория — история и на сервер не копируется. Бэкап runtime-данных
(`data/` + `docs/` + `images/` + `.env`) — `npm run backup`; восстановление — `npm run restore`
(подробно — `docs/operations/backup.md`). `DEPLOY_PM2_HOME=/home/rybnikov/.pm2` задаёт стабильный путь pm2;
автозапуск обеспечен systemd `pm2-rybnikov.service` и `pm2 save`. Подробности — [README.md](README.md)
и [server operations](docs/operations/server.md).

## Типичные грабли

- **Frontend dev 502:** если порты 3000/5173 заняты старыми инстансами, Vite поднимается на 3001/5174, а proxy всё равно целится в 3000 → 502 (dev-окружение, не код).
- **Зависшие dev-процессы на портах 3000/5173:** перед `npm run dev` проверять, что порты свободны: `Get-NetTCPConnection -LocalPort 5173,3000 -State Listen -ErrorAction SilentlyContinue | Select LocalPort, OwningProcess`; остановить зависший процесс: `Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object -Expand OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }` (повторить для 3000).
- **curl к защищённым API (`/api/vps`, `/api/projects`):** без сессии — 401 «Требуется авторизация». Сначала логин с сохранением cookie: `curl -c ck -X POST .../api/auth/login -H 'Content-Type: application/json' -d '{"username":"…","password":"…"}'`, затем `curl -b ck ...`. Мутации — только `admin` (403 «Недостаточно прав»). В PowerShell JSON передавать `--data-raw '{"username":...}'` (без `\"`).
- **Проверка сервера:** при подозрении на production-проблему проверять факты командами, а не делать вывод по симптомам; процедуры и целевые команды — в [server operations](docs/operations/server.md) и [deploy skill](.github/skills/deploy/SKILL.md).
- **VPS-специфичные симптомы** (кэш, 409/400/404, формулы) — в [VPS skill](.github/skills/vps/SKILL.md) и [VPS specification](docs/domains/vps.md).
- **Совместимость браузеров/PDF и фактическая UI-проверка** — в [design system](docs/layers/design-system.md).
- **Сбой edit-инструмента (`oldString` не найден/не совпал) = устаревший контекст:** перечитать файл
  заново и повторить правку по свежему содержимому, не гадать по старым версиям и не перебирать
  варианты вслепую. В длинных сессиях файл, прочитанный давно (много правок/компактов назад),
  перечитывать непосредственно перед каждой правкой.
