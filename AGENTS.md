  - общий HTTP-контракт → `docs/layers/api.md` и затронутые домены;
  - изменения связей требований, реализации или проверок → `docs/traceability.md`;
  - изменения связей CJ/FR/NFR/HR, реализации или проверок → `docs/traceability.md`;
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

- **Документы перепланировки «Ремонта»** — вкладки «Решение 33» и «Согласованный проект» в общем `PdfViewerModal`; файлы находятся в `docs/renovation/replanning/`, выдача — `GET /api/renovation/docs/replanning/:file` под авторизацией.
- **Backend** (`backend/src/`): `app.ts` экспортирует `app` (Express); роуты `/api/health`, `/api/auth`, `/api/vps`, `/api/projects`, `/api/renovation`, `/api/diary`, `/api/settings`, `/api/immich` → контроллеры → сервисы. Хранилище VPS — SQLite (`node:sqlite`): `db/database.ts` (синглтон `getDb()`, WAL + foreign_keys), `db/vpsRepository.ts`. Авторизация и прикладные проекты — отдельные SQLite-базы: `db/authDatabase.ts` (`getAuthDb()`, `data/auth.sqlite`/`AUTH_DB_PATH`) и `db/projectsDatabase.ts` (`getProjectsDb()`, `data/projects.sqlite`/`PROJECTS_DB_PATH`). Проверка доступности — `services/vpsChecker.ts` (кэш 30с + in-flight dedup, `?refresh=1` форсирует). **Live-binding:** после INSERT/DELETE VPS всегда вызывать `reloadVpsEntries()` (`config/vps.ts` перечитывает список из БД; работает и в ESM, и в CJS-бандле).
- **Авторизация** — весь портал закрыт входом (SPA + API). Пользователи/сессии — отдельная SQLite-БД `data/auth.sqlite` (`users`/`sessions`, путь `AUTH_DB_PATH`; схема — `db/authDatabase.ts`), пароли — только scrypt; токен в БД — SHA-256, клиенту — httpOnly `SameSite=Lax` cookie `sid`. `requireAuth` на всех защищённых роутах (`/api/vps`, `/api/projects`, `/api/renovation`, `/api/diary`, `/api/settings`, `/api/immich`), `requireAdmin` — на мутациях; `/api/health` и `POST /api/auth/login` — публичны. Bootstrap-админ из `AUTH_BOOTSTRAP_PASSWORD` (при пустой `users`); учётки — `npm run user -w backend` (`backend/scripts/users.mjs`). Фронт: `hooks/useAuth.tsx` + `pages/LoginPage.tsx` + гейт в `App.tsx`; роль `admin` гейтит UI (VPS CRUD, создание проекта).
- **Frontend** (`frontend/src/`): `createHashRouter` (react-router-dom v7) — **hash-роутинг обязателен** (nginx `try_files ... =404`, нет SPA-fallback). HTTP-клиент `api/client.ts` (`VITE_API_BASE_URL ?? '/api'`; dev-прокси `/api`→`:3000`; на 401 рассылает `auth:unauthorized` → `useAuth` показывает вход). Тема light/dark/system — `hooks/useTheme.ts` + CSS-переменные в `styles/tokens.css` + инлайн-скрипт в `index.html` (без «мигания»). Брендинг (заголовки вкладок `document.title`, футер) — динамический домен из `utils/brand.ts` (`APP_DOMAIN = location.hostname`, хелпер `pageTitle()`), без захардкоженных адресов. Стили разбиты на модули `frontend/src/styles/*.css` (`tokens/base/layout/pages/modal/forms/content/responsive/login/renovation`), точка входа — `index.css` с `@import`; новые правила — в соответствующий модуль, без инлайн-`<style>` в компонентах. Тяжёлые страницы (`RenovationPage`, `AdminUsersPage`, `ProfilePage`) грузятся лениво — `React.lazy` + `Suspense` в `App.tsx` (отдельные чанки). **Кликабельная карточка с вложенной кнопкой** (паттерн карточки VPS): `<div role="button" tabIndex={0}>`; вложенная кнопка вызывает `event.stopPropagation()`, чтобы не открывать карточку.
- **Проекты** (`projects/`): история «Ремонта» + архивированные навыки/агенты. Раздел «Проекты» — **прикладной**: встроенный реестр `backend/src/config/appProjects.ts` (например, «Ремонт» и «Мебель») + записи БД `projects` (созданные через UI; отдельная БД `data/projects.sqlite`, путь `PROJECTS_DB_PATH`), `kind: 'app'`. `listProjects` объединяет реестр и БД (скан файловой системы отсутствует). Создание/изменение/удаление — `POST`/`PATCH`/`DELETE /api/projects` (admin): запись в БД (метаданные + markdown-контент), файлы/папки не создаются; встроенные проекты (реестр) — read-only. Страницы проектов — SPA-маршруты `#/projects/<slug>` (`ProjectPage` рендерит markdown; специализированные проекты могут иметь собственную страницу). Локальная папка `projects/` — только история (статичный архив «Ремонта» + архивированные навыки `projects/skills-archive/`); деплой её не зеркалирует и seed из неё не делает.
- **Модуль «Ремонт» (`renovation`) — этапы 1–7 (data-слой + read-API + импорт PDF + доп. соглашения + отчёты + переключение карточки + просмотр документов):** отчётность `projects/renovation/` переносится в отдельную БД `data/renovation.sqlite` (`RENOVATION_DB_PATH`, не путать с `DB_PATH`). Домен — `services/renovation/domain/` (`types.ts` — модели, `money.ts` — деньги/количество в копейках). БД `data/renovation.sqlite` наполняется штатно — через импорт PDF в приложении (`POST /api/renovation/pdf` → черновик → подтверждение); seed из статичных HTML убран. Схема БД — в `db/renovationDatabase.ts`. Read-API — `routes/renovation.ts` + `controllers/renovationController.ts` + `db/renovationRepository.ts` + `services/renovation/overview.ts` (сводка); страница `#/projects/renovation` (`pages/RenovationPage.tsx`, `hooks/useRenovationOverview.ts`, `utils/money.ts`). Импорт PDF (этап 3): `pdfplumber` через subprocess (`scripts/extract_pdf.py`, `services/renovation/import/*`: `pdfExtractor`/`classify`/`draft`/`draftStore`), `POST /api/renovation/pdf` → черновик → `POST /pdf/:id/confirm` (документ с номером: повторная загрузка с тем же номером заменяет предыдущую версию; без номера — идемпотентность тип+дата → 409). Парсер: многостраничные PDF разбираются полностью (подвал «Страница: N / M» не прерывает разбор), строка имени, идущая после полной однострочной позиции, — начало имени новой позиции (в PDF подрядчика номер печатается на строке с цифрами, а имя переносится перед ней); модалка `components/RenovationPdfModal.tsx`. Сохранение загруженных PDF — `services/renovation/import/pdfStore.ts` (каталог `RENOVATION_DOCS_DIR`, по умолчанию `docs/renovation`; сохраняется при деплое), раздача — `GET /api/renovation/docs/:file` (под авторизацией), просмотр — `components/PdfViewerModal.tsx` (pdf.js, ленивый чанк); «Отчёт №N» в «Материалы» и в отчёте «Материалы» — ссылки на исходные PDF. Документ дизайн-проекта (этап 7) — альбом `album-chertezhey-s-razvertkami.pdf` в подпапке `design/`; `GET /api/renovation/docs/design/:file` раздаёт его под авторизацией с path traversal-защитой, а кнопка «Дизайн-проект» сразу открывает PDF в `PdfViewerModal` с `fitToWidth`. Кнопка «Смета» (`components/RenovationEstimateModal.tsx`, версии из БД + «Доп. соглашение» для admin) на странице «Ремонт» открывает модальное окно вместо прямой ссылки на статичный архив. Доп. соглашения (этап 4): движок диффа `services/renovation/addendum.ts` (`normalizeName`/`buildAddendumProposal`/`newItemsAfter`/`historyItemsAfter`/`totalsAfter`, накладные 5%), `POST /estimate/addendum` → предложение, `POST /estimate/addendum/confirm` → версионирование (`applyAddendumVersion` в транзакции: старая `current` → `history` с датой соглашения, удалённые строки — `removed`); модалка `components/AddendumModal.tsx`. Отчёты (этап 5): `services/renovation/reports.ts` (`buildWorkReport` — план vs факт по нормализованному «раздел::имя» (дубликаты имён в разделе распределяются позиционно; `normalizeName` игнорирует «толщиной»/«слоем»), `buildMaterialsReport`), `GET /reports/work` + `GET /reports/materials`, ссылки «Ход работ»/«Закупка материалов» в карточках «Работы»/«Материалы» (открытие отчёта в модальном окне `Modal`) (`components/RenovationWorkReport.tsx`, `RenovationMaterialsReport.tsx`, `hooks/useRenovationReports.ts`); в отчёте «Ход работ» подитоги групп — отдельной строкой после позиций (суммы план/факт), внизу сводка «Итого по работам»/«Накладные расходы 5%»/«Итого» — **правило:** итог план = сумма сметы, итог факт = сумма по всем актам выполненных работ (с накладными); «Экспорт в PDF» в шапке модалки отчёта — печать в PDF через `window.print()` с оверлеем `.print-report` (portal в `body`, print-медиа в `styles/renovation.css`). Переключение карточки (этап 6): прикладные (SPA) проекты — из реестра `backend/src/config/appProjects.ts` (`kind: 'app'`, `url` = внутренний маршрут без `#`); карточка «Ремонт» ведёт в `#/projects/renovation` (SPA), а не в статику. Подробно — `docs/domains/renovation.md`.
- **Модуль «Дневник» (`diary`) — события семьи:** своя БД `data/diary.sqlite` (`DIARY_DB_PATH`, не путать с `DB_PATH`) + изображения на диске в `DIARY_IMAGES_DIR` (по умолчанию `images`; dev — `backend/images/`, сервер — `server/images/`, каталог сохраняется при деплое, как `data/`/`docs/`). Схема БД — `db/diaryDatabase.ts`, CRUD — `db/diaryRepository.ts`, бизнес-логика — `services/diaryService.ts` (валидация, генерация уникальной папки события `evt-<time36>-<hex>`, синхронизация изображений при edit через `keep`/`newIds`, разрешение маркеров `diary-image://`), хранилище файлов — `services/diary/imageStore.ts` (защита от path traversal). Read-API — `routes/diary.ts` + `controllers/diaryController.ts` (`GET /api/diary`, `GET /api/diary/:id`, `GET /api/diary/images/:folder/:file`); мутации (POST/PATCH/DELETE, multipart через `middlewares/uploadImages.ts`) — только `admin`. Страницы — `#/diary` (`pages/DiaryPage.tsx`, макеты «список»/«карточки» кнопками с иконками, по умолчанию «список»), `#/diary/:id` (`pages/DiaryEventPage.tsx` — hero-блок: превью обложки, дата и краткое описание, фотографии в Markdown, галерея оставшихся файлов; admin: кнопки «карандаш»/«описание»/«Фотографии» (иконка `ImagesIcon`) → `DiaryPhotosModal` с мгновенным PATCH) и `#/diary/:id/edit` (`pages/DiaryDescriptionEditPage.tsx` — отдельный редактор подробного описания, admin: split текст + живой предпросмотр с фото, полоска вставки фото из события, иконки «Добавить фото с диска»/«Добавить фото из Immich» с вставкой у курсора, автозакладка черновика в localStorage + подтверждение при уходе; «Сохранить» пишет контент сразу на сервер — двухступенчатого сохранения нет); `DiaryEventModal.tsx` показывает сокращённые блоки описания/фотографий, а `DiaryPhotosModal.tsx` редактирует общий draft фотосета (файлы, обложка, удаление) без отдельного API-вызова; общий набор кнопок добавления фото (диск/Immich) — `DiaryPhotoUploadActions.tsx`; отправка происходит общим сохранением события. Кнопки действий «Дневника» — единый стиль: только иконки `IconButton` с подсказками; на карточке и странице события — по порядку: карандаш «Редактировать событие», документ «Редактировать описание», иконка `ImagesIcon` «Редактировать фотографии» (открывает `DiaryPhotosModal` с мгновенным PATCH), корзина «Удалить»; «Редактировать описание» и «Редактировать фотографии» есть на странице события и в карточке списка. Мгновенный редактор фотосета вынесен в общий хук `hooks/useDiaryPhotosEditor.ts` (используется страницей события и списком). Хуки — `hooks/useDiaryEvents.ts`/`useDiaryEvent.ts`, стили — `styles/diary.css`. URL изображения — `diaryImageUrl()` в `api/client.ts` (превью — `?preview=1`, полный размер — только при открытии на весь экран). Подробно — `docs/domains/diary.md`.
- **Админ-настройки + Immich (шаги 1–2):** общие настройки приложения — таблица `settings` (key-value) в основной БД (`DB_PATH`, схема `db/database.ts`, репозиторий `db/settingsRepository.ts`); сейчас хранит подключение к Immich (`immich.baseUrl`/`immich.apiKey`). API — `routes/settings.ts` + `controllers/immichSettingsController.ts`: `GET /api/settings/immich` (любой авторизованный; адрес нужен для ссылок «Фотоархив»/«Архив», ключ клиенту не возвращается), `POST /api/settings/immich/check` (только `admin`, при успехе сохраняет реквизиты). Проверка соединения — `services/immichService.ts` (`GET <base>/server/about` с `x-api-key`, `normalizeImmichBaseUrl`). Фронт — `pages/AdminSettingsPage.tsx` (`#/admin/settings`, шестерёнка рядом с бейджем «админ» в шапке): адрес + ключ + кнопка «Проверить соединение» (успех → зелёная галочка + сохранение в БД, ошибка → красный крест без сохранения). Адрес инстанса для «Фотоархив» (главная) и «Архив» (футер) — хук `useImmichSettings()` (кэш на сессию, web-адрес без `/api`); без настроенного адреса ссылки скрыты, захардкоженного URL нет. **Шаг 2 (пикер-импорт, вариант B2):** прокси `/api/immich/*` (`routes/immich.ts` + `controllers/immichController.ts` под `requireAdmin`; `searchImmichAssets`/`fetchImmichAssetBinary`/`getImmichCredentials` в `immichService.ts`, `ImmichError` со статусом) — поиск по датам (`POST /search/metadata`), миниатюры и оригиналы потоком (оригинал прокидывает `Content-Length` апстрима — для прогресс-бара); фронт — `components/ImmichPickerModal.tsx` (кнопка «Из Immich» в `DiaryEventModal.tsx`, выбранные фото — как обычные загрузки, прогресс-бар скачивания — общий `components/UploadProgress.tsx`). Справочник/план — `docs/immich.md`.

Подробно: [README.md](README.md) · [docs/specification.md](docs/specification.md) · [docs/layers/](docs/layers/) · [docs/domains/](docs/domains/) · [ADR index](docs/adr/index.md) · [docs/immich.md](docs/immich.md) · [docs/backup.md](docs/backup.md) · [docs/server.md](docs/server.md).

## Агенты (`.github/agents/`)

Специализированные роли — выбор в пикере чата. В локальном хранилище сессий интерактивные сессии пишутся как `GitHub Copilot Chat` (факт выбора агента в истории не виден), а реального «спавна» субагентов в этом окружении нет — «делегирование» означает ручной выбор в пикере.

| Задача                                                         | Агент         |
| -------------------------------------------------------------- | ------------- |
| Бэкенд (`backend/**`): API, SQLite, VPS-проверки, конфиг       | Backend Dev   |
| Фронтенд (`frontend/**`): UI, хуки, тема, маршруты             | Frontend Dev  |
| Сквозные фичи (бэкенд + фронтенд + синхронизация документации) | Fullstack Dev |

Fullstack Dev — **владелец контракта и координатор** сквозных фич: определяет API-контракт первым, сводит типы/хуки/контроллеры, гоняет `typecheck`, синхронно обновляет `docs/`. Для маленького монорепо он **делает работу напрямую** (исторически все сквозные фичи выполнены так, успешно и задеплоены) — субагентов задействовать **точечно**, только для изолированных суб-частей с жёстко заданным контрактом; его инструменты (`edit`/`execute`) не ограничивать.

## Харнесс и память репозитория

- **Обязательные ограничения** собраны в [.github/harness/guardrails.md](.github/harness/guardrails.md) и действуют для всех ролей и навыков.
- Источником истины для проекта является Git-репозиторий: важные факты, требования и процедуры должны храниться в версионируемых файлах.
- `.github/harness/` — часть харнесса. `repo-memory.md` предназначен только для уникальных операционных заметок, которые еще не принадлежат спецификации, навыку или справочнику.
- **Каркас харнесса для нового проекта — навык `.github/skills/harness-init/`** (процедура + шаблоны `references/*`: `guardrails.md`, `AGENTS.md`, спецификация, ADR, `SKILL.md`, `*.agent.md`, `repo-memory.md`, `README`/`.env.example`) и промпт-обёртка `.github/prompts/init-harness.prompt.md` (её копия лежит в профиле пользователя и доступна в произвольном проекте).
- Ограничения на использование локальной памяти репозитория описаны в `.github/harness/guardrails.md`; долговременные факты размещать в профильных версионируемых документах.

## Правила

1. **Документация синхронно с кодом — обязательный чек-лист перед завершением.** Обновляй документы по фактическому влиянию изменения:
  - поведение, данные или UI-макет домена → соответствующую `docs/domains/<домен>.md`;
  - общая архитектура или карта документов → `docs/layers/<слой>.md` и при изменении общих положений `docs/specification.md`;
  - общий HTTP-контракт → `docs/layers/api.md` и затронутые домены;
   - переменные окружения → соответствующие `.env.example` и документацию конфигурации;
   - деплой, production-инфраструктура или серверные операции → `docs/server.md`;
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
   - **Контроль контекста в длинных задачах:** при многошаговой работе фиксировать промежуточный
     прогресс (актуальный todo + краткая заметка в память сессии — `/memories/session/`), чтобы при
     перезапуске сессии «восстановить контекст» без потерь. Не допускать бесконечных повторов
     («продолжай»/«Continue to iterate?»/«Try Again» по кругу): если ход зациклился или задача
     разрослась — остановиться, сжать контекст и предложить новую сессию или сузить scope.
   - **Проактивное управление контекстом:** при длинной сессии (сотни ходов) или подозрении на потерю
     контекста (не удаётся найти файл, модель «запуталась», повторное решение одной проблемы) — не
    «продавливать»: перечитать авторитетные источники (`AGENTS.md`, `docs/layers/`, `docs/domains/`, ключевые
     файлы) и **предложить `/compact` или новую сессию** для новой подзадачи, а не продолжать раздутый
     контекст (в прошлом модель «запуталась» на ~300-м ходе, пришлось менять модель).
10. **UI-позиционирование и визуальная проверка.** Неоднозначные относительные размеры уточнять;
    новые элементы оформлять по [дизайн-системе](docs/frontend-design.md), а фактический рендер
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
    (дизайн-правило, задокументировано в `docs/frontend-design.md`). Применять во всех списках
    документов «Ремонта» (карточки-сводки «Работы»/«Материалы», ведомости взаиморасчётов,
    отчёты, модалки «Смета»/«Дизайн-проект»); новые PDF-ссылки — только через него, без ручных
    `renov-link`-кнопок с PDF.
14. **Конфигурация production-сервера.** `my.rybnikov.su` — единственная управляемая цель
    публикации. Правки nginx, `server/.env`, pm2 и зависимостей проверять на production-хосте
    командами health, порт и `nginx -t`. Справочник — `docs/server.md`.
15. **DeepSeek pricing gate.** При выборе модели DeepSeek до анализа выполняй процедуру и условия
    подтверждения из [docs/pricing.md](docs/pricing.md); актуализация цен и окна ведется там же.
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
(подробно — `docs/backup.md`). `DEPLOY_PM2_HOME=/home/rybnikov/.pm2` задаёт стабильный путь pm2;
автозапуск обеспечен systemd `pm2-rybnikov.service` и `pm2 save`. Подробности — [README.md](README.md)
и [docs/server.md](docs/server.md).

## Типичные грабли

- **Frontend dev 502:** если порты 3000/5173 заняты старыми инстансами, Vite поднимается на 3001/5174, а proxy всё равно целится в 3000 → 502 (dev-окружение, не код).
- **Зависшие dev-процессы на портах 3000/5173:** перед `npm run dev` проверять, что порты свободны: `Get-NetTCPConnection -LocalPort 5173,3000 -State Listen -ErrorAction SilentlyContinue | Select LocalPort, OwningProcess`; остановить зависший процесс: `Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object -Expand OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }` (повторить для 3000).
- **Новая VPS не видна в UI:** GET-кэш бэкенда 30с → после POST вызывать `onRefresh()` → `fetchVps(true)` (`?refresh=1`).
- **curl к защищённым API (`/api/vps`, `/api/projects`):** без сессии — 401 «Требуется авторизация». Сначала логин с сохранением cookie: `curl -c ck -X POST .../api/auth/login -H 'Content-Type: application/json' -d '{"username":"…","password":"…"}'`, затем `curl -b ck ...`. Мутации — только `admin` (403 «Недостаточно прав»). В PowerShell JSON передавать `--data-raw '{"username":...}'` (без `\"`).
- **`users.mjs`/`node` на сервере:** на текущих хостах node в PATH (`/usr/bin/node`) и доступен даже в неинтерактивной SSH-сессии; если на новом хосте node не в PATH — полный путь до бинаря (например `.../node scripts/users.mjs add ...` из `$SERVER`).
- **Нет «тестового пароля» в документации:** пароли — только scrypt-хэши (не восстанавливаются), в dev `backend/.env` нет. Для проверки UI есть локальные учётки: `test` / `test123456` (роль admin) и `user` / `user123456` (роль user — вид не-админа, например на странице «Ремонт» нет карандаша «Изменить адрес объекта»), БД авторизации `backend/data/auth.sqlite`; пересоздать — `$env:AUTH_DB_PATH='backend/data/auth.sqlite'; node backend/scripts/users.mjs add test Тестовый admin --password test123456` (аналогично `add user User user --password user123456`; подробно — `docs/frontend-design.md` → «Проверка интерфейса (локально)»). Браузер при входе может автозаполнять поле пароля реальной учётки — очищать его.
- **Backend 502 под pm2:** диагностика `ss -ltnp | grep 3000`, `curl -i http://127.0.0.1:3000/api/health`, `pm2 logs family-backend --lines 50 --nostream`. На текущих хостах pm2 в `/usr/bin/pm2` (в PATH и в неинтерактивной сессии); при нестандартной установке — полный путь до pm2.
- **`pm2 update` после апгрейда node (apt install nodejs):** `pm2 update` (перезапуск демона под новым node) может оставить приложение в `stopping`/выкинуть из списка из-за гонки с SQLite-локом (новый процесс стартует, пока старый ещё держит БД). После `apt-get install nodejs` надёжнее обычный `pm2 restart <app>`; если приложение пропало из `pm2 ls` — запустить вручную `pm2 start dist/app.cjs --name family-backend --cwd $SERVER` и `pm2 save`.
- **Диагностика сервера — проверять утверждения реальными командами:** перед выводом «сервер не умеет X /
  окружение сломано» проверять каждый факт командой (`ls -la`, `which python`, `python -c "import …"`,
  путь venv, `node -e "require('…')"`). Если вывод противоречит заведомо рабочей настройке — перепроверить
  путь/команду, а не делать поспешный вывод (в прошлом модель по ошибке проверила не тот путь Python и
  заключила, что сервер не парсит PDF).
- **Windows OpenSSH шлёт на сервер `HOME=C:Usersalex` (все хосты):** на сервере `$HOME/...`/`~/...` резолвятся относительно CWD. **Фикс:** `deploy.mjs` поддерживает `DEPLOY_PM2_HOME` (remote-скрипт делает `export PM2_HOME=...`) — задавать абсолютный `DEPLOY_PM2_HOME=/home/rybnikov/.pm2`, тогда демон стабилен. Без него PM2_HOME=$CWD/C:Usersalex/.pm2, демон нестабилен (деплой делает `start` вместо `restart`, возможен конфликт портов). Ручное управление pm2 — `export PM2_HOME=/home/rybnikov/.pm2; pm2 ...`. `NODE_ENV=production` хранится в env pm2 (задаётся при `pm2 start`), обычный `pm2 restart` его сохраняет; запуск без него → процесс online, но порт не слушается (гейт `app.listen`). На новых хостах pdf-setup деплоя создаёт venv по битому пути `$SERVER/C:Usersalex/renov-venv`→`--no-pdf-setup` + ручная установка venv (см. docs/server.md §1.4).
- **Windows-пути в Linux remote-командах:** не использовать `path.join()` для сборки команд, уходящих на
  сервер (даёт `\`, Linux ломается) — использовать относительные пути и `/` (`deploy.mjs` отправляет
  remote shell-скрипт на сервер).
- **nginx:** `proxy_pass http://127.0.0.1:3000;` без трейлинг-слэша, иначе срезается `/api` и Express отдаёт 404.
- **pdf.js worker «Setting up fake worker failed: Failed to fetch dynamically imported module»:** `.mjs`-ассеты сборки Vite (в т.ч. `pdf.worker.min-*.mjs`) nginx отдаёт как `application/octet-stream`, пока в `/etc/nginx/mime.types` нет `application/javascript mjs;` — браузер отклоняет модуль. Проверять `curl -sI .../assets/*.mjs` → `Content-Type: application/javascript`. Фикс уже внесён (mime.types, бэкап `.bak`); при переустановке/пересборке nginx — проверить снова.
- **pdf.js v6 в Samsung Browser: `this[#t].getOrInsertComputed is not a function`** — pdf.js v6 использует `Map.prototype.getOrInsertComputed` (ES2025), отсутствующий в Samsung Internet (Chromium < 130) и части старых WebView. Полифилл — `frontend/src/utils/pdfPolyfills.ts` (`installPdfPolyfills`), вызывается в `PdfViewerModal.tsx` до использования pdf.js. При апгрейде `pdfjs-dist` проверять необходимость полифиллов новых API (`Promise.withResolvers` — Chrome 119+/Safari 17.4+; для старых браузеров может понадобиться).
- **`sharp` (превью изображений «Дневника»):** на production-сервере (`my.rybnikov.su`, Xeon Platinum 8260, AVX2) работает последняя `~0.35.3` (`backend/package.json`). Прежний пин `~0.33.5` был нужен из-за слабого CPU старого сервера (QEMU x86-64-v1, без SSE4.2/POPCNT/AVX) — там sharp ≥0.34 падал с `Unsupported CPU` и давал 502 на весь API. Перед апгрейдом проверять CPU целевого сервера (`lscpu | grep -oE 'sse4_2|popcnt|avx|avx2'`) и `node -e "require('sharp')()..."`. Быстрый фикс при поломке: `cd $SERVER && npm install --omit=dev sharp@~0.33.5 && pm2 restart family-backend`.
- **Модель без vision (Vision Proxy):** если `view_image` возвращает только URI без пикселей, а открытая
  вкладка приходит как «(not visible)» — у модели нет доступа к изображениям (настройка
  `github.copilot.chat.visionProxy` или модель с vision). Это **не повод** отказываться от проверки:
  работают `read_page` (текстовый снимок) и Playwright-замеры (`run_playwright_code`, computed
  styles/offsets) — см. «Проверка макетных изменений» в `docs/frontend-design.md`.
- **Не пытаться открывать внешний браузер через MCP-Playwright (`mcp_playwright_*`):** Chrome на этой
  машине не установлен и не будет — такие попытки всегда проваливаются (пустая трата ходов). Сразу
  проверять во встроенном браузере (`open_browser_page`, `read_page`, `click_element`, `type_in_page`,
  `navigate_page`); MCP-браузер к `localhost:5173` всё равно не достучится.
- **Один инструмент «disabled» ≠ браузер недоступен:** ошибка у одного инструмента (например
  `run_playwright_code` → «currently disabled by the user») не значит, что недоступны остальные
  (`open_browser_page`, `read_page`, `screenshot_page`) — пробовать их, прежде чем сдаться и просить
  пользователя проверить вручную.
- **Сбой edit-инструмента (`oldString` не найден/не совпал) = устаревший контекст:** перечитать файл
  заново и повторить правку по свежему содержимому, не гадать по старым версиям и не перебирать
  варианты вслепую. В длинных сессиях файл, прочитанный давно (много правок/компактов назад),
  перечитывать непосредственно перед каждой правкой.
