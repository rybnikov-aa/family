# AGENTS.md — Family

Монорепозиторий веб-приложения: **frontend** (React 19 + TypeScript + Vite, порт 5173) и **backend** (Node + Express 5 + Vite через `vite-plugin-node`, порт 3000). npm workspaces, общие dev-зависимости в корневом `package.json`. **Node ≥ 22.5** — реальное требование бэкенда (`node:sqlite`), `engines` в корневом `package.json` — `>=22.5.0`; на сервере v24.19.0.

> ⚠️ **`renovation_source/` — временная папка, исключена.** Не править, не учитывать в анализе и не деплоить. Рабочий проект ремонта — `projects/renovation/`.

## Команды

| Команда                    | Что делает                                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`              | Фронтенд + бэкенд одновременно (concurrently)                                                                                                 |
| `npm run build`            | Сборка frontend (`tsc --noEmit && vite build`) + backend (`vite build`)                                                                       |
| `npm run typecheck`        | `tsc --noEmit` во всех воркспейсах — **единственный статический gate** (lint/тестов нет)                                                      |
| `npm run format`           | Prettier (`.prettierrc.json`: singleQuote, semi, printWidth 100, trailingComma all)                                                           |
| `npm run start -w backend` | Запуск собранного бэкенда (`node dist/app.cjs`) — `start` есть только в backend-воркспейсе                                                    |
| `npm run pipeline`         | **Основной способ публикации:** тестовый сервер → синхронизация `data/` → sanity-тесты → основной сервер; credentials через `PIPELINE_TEST_*` |
| `npm run deploy`           | Исторический прямой деплой; флаги: `--no-build`, `--no-restart`, `--print-script`, `--print-config`                                           |
| `npm run sanity:test`      | Набор API sanity-тестов; URL и credentials через `SANITY_*`                                                                                   |

## Архитектура (кратко)

- **Backend** (`backend/src/`): `app.ts` экспортирует `app` (Express); роуты `/api/health`, `/api/auth`, `/api/vps`, `/api/projects`, `/api/renovation`, `/api/diary` → контроллеры → сервисы. Хранилище VPS — SQLite (`node:sqlite`): `db/database.ts` (синглтон `getDb()`, WAL + foreign_keys), `db/vpsRepository.ts`. Авторизация и прикладные проекты — отдельные SQLite-базы: `db/authDatabase.ts` (`getAuthDb()`, `data/auth.sqlite`/`AUTH_DB_PATH`) и `db/projectsDatabase.ts` (`getProjectsDb()`, `data/projects.sqlite`/`PROJECTS_DB_PATH`). Проверка доступности — `services/vpsChecker.ts` (кэш 30с + in-flight dedup, `?refresh=1` форсирует). **Live-binding:** после INSERT/DELETE VPS всегда вызывать `reloadVpsEntries()` (`config/vps.ts` перечитывает список из БД; работает и в ESM, и в CJS-бандле).
- **Авторизация** — весь портал закрыт входом (SPA + API). Пользователи/сессии — отдельная SQLite-БД `data/auth.sqlite` (`users`/`sessions`, путь `AUTH_DB_PATH`; схема — `db/authDatabase.ts`), пароли — только scrypt; токен в БД — SHA-256, клиенту — httpOnly `SameSite=Lax` cookie `sid`. `requireAuth` на роутах `/api/vps` и `/api/projects`, `requireAdmin` — на мутациях (POST/DELETE VPS, импорт, создание проекта); `/api/health` и `POST /api/auth/login` — публичны. Bootstrap-админ из `AUTH_BOOTSTRAP_PASSWORD` (при пустой `users`); учётки — `npm run user -w backend` (`backend/scripts/users.mjs`). Фронт: `hooks/useAuth.tsx` + `pages/LoginPage.tsx` + гейт в `App.tsx`; роль `admin` гейтит UI (VPS CRUD, создание проекта).
- **Frontend** (`frontend/src/`): `createHashRouter` (react-router-dom v7) — **hash-роутинг обязателен** (nginx `try_files ... =404`, нет SPA-fallback). HTTP-клиент `api/client.ts` (`VITE_API_BASE_URL ?? '/api'`; dev-прокси `/api`→`:3000`; на 401 рассылает `auth:unauthorized` → `useAuth` показывает вход). Тема light/dark/system — `hooks/useTheme.ts` + CSS-переменные в `styles/tokens.css` + инлайн-скрипт в `index.html` (без «мигания»). Брендинг (заголовки вкладок `document.title`, футер) — динамический домен из `utils/brand.ts` (`APP_DOMAIN = location.hostname`, хелпер `pageTitle()`), без захардкоженных адресов. Стили разбиты на модули `frontend/src/styles/*.css` (`tokens/base/layout/pages/modal/forms/content/responsive/login/renovation`), точка входа — `index.css` с `@import`; новые правила — в соответствующий модуль, без инлайн-`<style>` в компонентах. Тяжёлые страницы (`RenovationPage`, `AdminUsersPage`, `ProfilePage`) грузятся лениво — `React.lazy` + `Suspense` в `App.tsx` (отдельные чанки). **Кликабельная карточка с вложенной кнопкой** (паттерн карточки VPS): `<div role="button" tabIndex={0}>`; вложенная кнопка вызывает `event.stopPropagation()`, чтобы не открывать карточку.
- **Проекты** (`projects/`): источник данных «Ремонта» + общие ассеты его статичного архива. Раздел «Проекты» — **прикладной**: встроенный реестр `backend/src/config/appProjects.ts` (например, «Ремонт`) + записи БД `projects`(созданные через UI; отдельная БД`data/projects.sqlite`, путь `PROJECTS_DB_PATH`), `kind: 'app'`. `listProjects`объединяет реестр и БД (скан файловой системы отсутствует). Создание/изменение/удаление —`POST`/`PATCH`/`DELETE /api/projects`(admin): запись в БД (метаданные + markdown-контент), файлы/папки не создаются; встроенные проекты (реестр) — read-only. Страницы проектов — SPA-маршруты`#/projects/<slug>` (`ProjectPage`рендерит markdown). Локальная папка `projects/`— только история (статичный архив «Ремонта» + архивированные навыки`projects/skills-archive/`); деплой её не зеркалирует и seed из неё не делает.
- **Модуль «Ремонт» (`renovation`) — этапы 1–7 (data-слой + read-API + импорт PDF + доп. соглашения + отчёты + переключение карточки + модалки документов):** отчётность `projects/renovation/` переносится в отдельную БД `data/renovation.sqlite` (`RENOVATION_DB_PATH`, не путать с `DB_PATH`). Домен — `services/renovation/domain/` (`types.ts` — модели, `money.ts` — деньги/количество в копейках). БД `data/renovation.sqlite` наполняется штатно — через импорт PDF в приложении (`POST /api/renovation/pdf` → черновик → подтверждение); seed из статичных HTML убран. Схема БД — в `db/renovationDatabase.ts`. Read-API — `routes/renovation.ts` + `controllers/renovationController.ts` + `db/renovationRepository.ts` + `services/renovation/overview.ts` (сводка); страница `#/projects/renovation` (`pages/RenovationPage.tsx`, `hooks/useRenovationOverview.ts`, `utils/money.ts`). Импорт PDF (этап 3): `pdfplumber` через subprocess (`scripts/extract_pdf.py`, `services/renovation/import/*`: `pdfExtractor`/`classify`/`draft`/`draftStore`), `POST /api/renovation/pdf` → черновик → `POST /pdf/:id/confirm` (идемпотентность тип+дата → 409); модалка `components/RenovationPdfModal.tsx`. Сохранение загруженных PDF — `services/renovation/import/pdfStore.ts` (каталог `RENOVATION_DOCS_DIR`, по умолчанию `docs/renovation`; сохраняется при деплое), раздача — `GET /api/renovation/docs/:file` (под авторизацией), просмотр — `components/PdfViewerModal.tsx` (pdf.js, ленивый чанк); «Отчёт №N» в «Материалы» и в отчёте «Материалы» — ссылки на исходные PDF. Документы дизайн-проекта (этап 7) — подпапка `design/` каталога документов (`listDesignDocs`/`designPdfUrl`/`resolveStoredDesignPdf` в `pdfStore.ts`), список — `GET /api/renovation/design`, раздача — `GET /api/renovation/docs/design/:file`; кнопки «Дизайн-проект» (`components/RenovationDesignModal.tsx`) и «Смета» (`components/RenovationEstimateModal.tsx`, версии из БД + «Доп. соглашение» для admin) на странице «Ремонт» открывают модальные окна вместо прямых ссылок на статичный архив. Доп. соглашения (этап 4): движок диффа `services/renovation/addendum.ts` (`normalizeName`/`buildAddendumProposal`/`newItemsAfter`/`historyItemsAfter`/`totalsAfter`, накладные 5%), `POST /estimate/addendum` → предложение, `POST /estimate/addendum/confirm` → версионирование (`applyAddendumVersion` в транзакции: старая `current` → `history` с датой соглашения, удалённые строки — `removed`); модалка `components/AddendumModal.tsx`. Отчёты (этап 5): `services/renovation/reports.ts` (`buildWorkReport` — план vs факт по `normalizeName`, `buildMaterialsReport`), `GET /reports/work` + `GET /reports/materials`, ссылки «Ход работ»/«Закупка материалов» в карточках «Работы»/«Материалы» (открытие отчёта в модальном окне `Modal`) (`components/RenovationWorkReport.tsx`, `RenovationMaterialsReport.tsx`, `hooks/useRenovationReports.ts`). Переключение карточки (этап 6): прикладные (SPA) проекты — из реестра `backend/src/config/appProjects.ts` (`kind: 'app'`, `url` = внутренний маршрут без `#`); карточка «Ремонт» ведёт в `#/projects/renovation` (SPA), а не в статику. Подробно — `docs/specification-renovation.md`.
- **Модуль «Дневник» (`diary`) — события семьи:** своя БД `data/diary.sqlite` (`DIARY_DB_PATH`, не путать с `DB_PATH`) + изображения на диске в `DIARY_IMAGES_DIR` (по умолчанию `images`; dev — `backend/images/`, сервер — `server/images/`, каталог сохраняется при деплое, как `data/`/`docs/`). Схема БД — `db/diaryDatabase.ts`, CRUD — `db/diaryRepository.ts`, бизнес-логика — `services/diaryService.ts` (валидация, генерация уникальной папки события `evt-<time36>-<hex>`, синхронизация изображений при edit через `keep`/`newIds`, разрешение маркеров `diary-image://`), хранилище файлов — `services/diary/imageStore.ts` (защита от path traversal). Read-API — `routes/diary.ts` + `controllers/diaryController.ts` (`GET /api/diary`, `GET /api/diary/:id`, `GET /api/diary/images/:folder/:file`); мутации (POST/PATCH/DELETE, multipart через `middlewares/uploadImages.ts`) — только `admin`. Страницы — `#/diary` (`pages/DiaryPage.tsx`, макеты «список»/«карточки» кнопками с иконками, по умолчанию «список») и `#/diary/:id` (`pages/DiaryEventPage.tsx`, фотографии в Markdown и галерея оставшихся файлов); форма — `components/DiaryEventModal.tsx` (загрузка фото, выбор обложки, период дат, вставка фото в markdown), хуки — `hooks/useDiaryEvents.ts`/`useDiaryEvent.ts`, стили — `styles/diary.css`. URL изображения — `diaryImageUrl()` в `api/client.ts` (превью — `?preview=1`, полный размер — только при открытии на весь экран). Подробно — `docs/specification-diary.md`.
- **Админ-настройки + Immich (шаги 1–2):** общие настройки приложения — таблица `settings` (key-value) в основной БД (`DB_PATH`, схема `db/database.ts`, репозиторий `db/settingsRepository.ts`); сейчас хранит подключение к Immich (`immich.baseUrl`/`immich.apiKey`). API — `routes/settings.ts` + `controllers/immichSettingsController.ts`: `GET /api/settings/immich` (любой авторизованный; адрес нужен для ссылок «Фотоархив»/«Архив», ключ клиенту не возвращается), `POST /api/settings/immich/check` (только `admin`, при успехе сохраняет реквизиты). Проверка соединения — `services/immichService.ts` (`GET <base>/server/about` с `x-api-key`, `normalizeImmichBaseUrl`). Фронт — `pages/AdminSettingsPage.tsx` (`#/admin/settings`, шестерёнка рядом с бейджем «админ» в шапке): адрес + ключ + кнопка «Проверить соединение» (успех → зелёная галочка + сохранение в БД, ошибка → красный крест без сохранения). Адрес инстанса для «Фотоархив» (главная) и «Архив» (футер) — хук `useImmichSettings()` (кэш на сессию, web-адрес без `/api`); без настроенного адреса ссылки скрыты, захардкоженного URL нет. **Шаг 2 (пикер-импорт, вариант B2):** прокси `/api/immich/*` (`routes/immich.ts` + `controllers/immichController.ts` под `requireAdmin`; `searchImmichAssets`/`fetchImmichAssetBinary`/`getImmichCredentials` в `immichService.ts`, `ImmichError` со статусом) — поиск по датам (`POST /search/metadata`), миниатюры и оригиналы потоком; фронт — `components/ImmichPickerModal.tsx` (кнопка «Из Immich» в `DiaryEventModal.tsx`, выбранные фото — как обычные загрузки). Справочник/план — `docs/immich.md`.

Подробно: [README.md](README.md) (структура, .env, деплой) · [docs/specification.md](docs/specification.md) (общая спецификация + модульные `specification-{api,vps,projects,auth,renovation,diary}.md`) · [docs/immich.md](docs/immich.md) (интеграция с Immich: API, варианты, шаг 1 — админ-настройки) · [docs/server.md](docs/server.md) (nginx, SSL, сервер, диагностика).

## Агенты (`.github/agents/`)

Специализированные роли — выбор в пикере чата. В локальном хранилище сессий интерактивные сессии пишутся как `GitHub Copilot Chat` (факт выбора агента в истории не виден), а реального «спавна» субагентов в этом окружении нет — «делегирование» означает ручной выбор в пикере.

| Задача                                                         | Агент         |
| -------------------------------------------------------------- | ------------- |
| Бэкенд (`backend/**`): API, SQLite, VPS-проверки, конфиг       | Backend Dev   |
| Фронтенд (`frontend/**`): UI, хуки, тема, маршруты             | Frontend Dev  |
| Сквозные фичи (бэкенд + фронтенд + синхронизация документации) | Fullstack Dev |

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
   - **Синхронизация — часть определения «задача завершена»:** задача считается готовой только после
     прохождения чек-листа документации (`docs/`, навыки, README, `.env.example`). Не объявлять задачу
     выполненной, пока в списке остались непокрытые правки; если правка кода затронула требования/
     макет/контракт — соответствующий документ обязан измениться в этой же задаче.
   - После правки самих инструкций (`AGENTS.md`, `.github/skills/*/SKILL.md`) проверять, что
     изменение реально легло в файл: `git diff` или grep по новому маркеру. Если правка не
     применилась — честно сообщить об этом, а не отчитываться о выполненном.
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
   - Импорт PDF (этап 3): python-скрипт (`extract_pdf.py`) на Windows пишет в stdout в консольную кодировку (cp1251) — принудительно `sys.stdout.reconfigure(encoding='utf-8')`, иначе Node читает «кракозябры». JS `\b` не считает кириллицу word-char: `/\bитого\b/i` не матчит «Итого» — использовать без `\b`.
6. **Язык.** Комментарии в коде и строки UI — на русском. Иконки — инлайн SVG-компоненты (`stroke=currentColor`) в `frontend/src/components/icons.tsx`.
7. **Модуль «Ремонт» (`renovation`): данные ведутся в приложении, seed из статичных HTML убран.**
   - Новые документы добавляются через импорт PDF (admin, модалка «Импорт PDF»):
     `POST /api/renovation/pdf` → черновик → подтверждение; идемпотентность тип+дата → 409.
     PDF, уже сохранённые в БД (тип+дата), повторно не импортировать.
   - Документы сметы и дизайн-проекта — модалки «Смета»/«Дизайн-проект» (данные из БД и
     хранилища `docs/renovation/`); просмотр PDF — встроенным просмотрщиком `PdfViewerModal`.
   - Статичные HTML `projects/renovation/**` и старые навыки `project-renovation-*` — только
     история: архив `projects/skills-archive/`; не использовать, не править, не загружать как навыки.
8. **Конфиденциальность в документах «Ремонта».**
   - Не публиковать персональные данные заказчика: ФИО — ни в тексте документов, ни в
     заголовках, ни в подписях; в ролевых блоках — только роль («Заказчик», «Подрядчик»)
     без имени.
   - Блоки подписей (`signatures`, `approval`) не выводить — они бессмысленны в электронном виде.
   - Имена PDF-файлов в хранилище документов (`server/docs/renovation/**`) не должны содержать
     ФИО заказчика; при обнаружении — переименовать и обновить ссылки в БД.
9. **Многошаговые задачи.** При сериях команд со ссылками на пункты («выполни пункт N»,
   «далее…», «после этого…») фиксировать план в todo-списке и сверяться с ним на каждом шаге.
   Перед откатом/возвратом «как было» показать, что именно будет изменено, и подтвердить.
   - **Контроль контекста в длинных задачах:** при многошаговой работе фиксировать промежуточный
     прогресс (актуальный todo + краткая заметка в память сессии — `/memories/session/`), чтобы при
     перезапуске сессии «восстановить контекст» без потерь. Не допускать бесконечных повторов
     («продолжай»/«Continue to iterate?»/«Try Again» по кругу): если ход зациклился или задача
     разрослась — остановиться, сжать контекст и предложить новую сессию или сузить scope.
10. **UI-итерации и позиционирование.** При правках отступов/выравнивания/порядка/размеров элементов:
    - относительные требования («ближе», «на четверть», «пропорции 4 к 3») переводить в конкретные
      значения (px/%) и при неоднозначности уточнять до применения;
    - применять маленькие обратимые шаги, чтобы не ломать соседние элементы (перед «переделкой»
      показывать, что именно меняется);
    - **не удалять/не переносить существующее без запроса:** правка не даёт права удалять,
      переименовывать или переносить существующие элементы, если это не было явно запрошено
      («сделай блок X» ≠ «удали блок Y»); если реализация требует удаления/изменения существующего
      элемента — сначала сообщить об этом и при неоднозначности подтвердить у пользователя;
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
13. **PDF-ссылки — только через `PdfLink`.** Ссылка, открывающая просмотр PDF (встроенный
    просмотрщик `PdfViewerModal`), оформляется компонентом `PdfLink`
    (`frontend/src/components/PdfLink.tsx`): иконка документа перед текстом обязательна
    (дизайн-правило, задокументировано в `docs/frontend-design.md`). Применять во всех списках
    документов «Ремонта» (карточки-сводки «Работы»/«Материалы», ведомости взаиморасчётов,
    отчёты, модалки «Смета»/«Дизайн-проект»); новые PDF-ссылки — только через него, без ручных
    `renov-link`-кнопок с PDF.
14. **Синхронизация конфигурации серверов (основной ↔ тестовый).** Конфигурация основного
    (`my.rybnikov.su`) и тестового (`test.rybnikov.su`) серверов должна **совпадать**: любые
    правки конфигурации (nginx-vhost'ы, `server/.env`, pm2, автозапуск `pm2-rybnikov.service`,
    версии/зависимости, фиксы nginx — `.mjs`/`client_max_body_size` и т.п.) применяются
    **синхронно к обоим хостам**. Отличия допустимы только там, где они неизбежны по назначению
    хоста: `PORT` (3000/3001), `CORS_ORIGIN` и домен, пути `/var/www/<host>/`, имя pm2-приложения
    (`family-backend`/`family-backend-test`). После правки на одном хосте — сразу применить на
    другом и проверить (health, порт, nginx). Справочник — `docs/server.md`.
15. **Проверка ценовой политики перед анализом (см. `docs/pricing.md`).** Если выбрана
    одна из моделей DeepSeek — перед началом анализа запроса пользователя проверять текущую
    ценовую политику DeepSeek API: актуальные цены и действующее окно peak/off-peak
    (пиковые часы — **01:00–04:00 и 06:00–10:00 UTC**, все остальные — off-peak; полные
    таблицы цен — `docs/pricing.md`). Если действует **peak-тариф** (цены вдвое выше
    off-peak) — вывести пользователю предупреждение о повышенной стоимости обработки
    запроса и **продолжать работу только после явного подтверждения** пользователя.
    При off-peak или при модели не из DeepSeek предупреждение не требуется.
    Ценовая политика может меняться: **периодически (не реже раза в неделю)
    актуализировать** `docs/pricing.md` из первоисточника
    (https://api-docs.deepseek.com/quick_start/pricing/) — сверять модели, цены
    (peak/off-peak, cache hit/miss, выход) и лимиты конкурентности, обновлять дату
    снимка; при изменении окна peak/off-peak — синхронно править текст правила
    и `docs/pricing.md`.

## Деплой (кратко)

`scripts/deploy.mjs`: сборка → tar → scp → remote-скрипт (nginx не трогает). На сервере сохраняются: `server/.env`, `server/data/` (SQLite), `server/docs/` (загруженные PDF «Ремонта»), `server/images/` (изображения событий «Дневника»), `.well-known/`. Статичные страницы проектов не зеркалируются, `projects/` репозитория на сервер не копируется (папка — история; seed «Ремонта» убран). Бэкап папок проектов не выполняется. Хосты: основной `my.rybnikov.su` (данные мигрированы с прежнего хоста 2026-08-16; прежний домен редиректится), тестовый `test.rybnikov.su` (инстанс `family-backend-test` на порту 3001). `DEPLOY_PM2_HOME=/home/rybnikov/.pm2` задаёт стабильный путь pm2 (обязательно из-за грабли `HOME`). Автозапуск pm2 при загрузке включён на **обоих** хостах (systemd `pm2-rybnikov.service`, `pm2 save`). Конфигурация основного и тестового серверов синхронизируется (правило 14). Детали — в [README.md](README.md) «Деплой» и [docs/server.md](docs/server.md).

## Типичные грабли

- **Frontend dev 502:** если порты 3000/5173 заняты старыми инстансами, Vite поднимается на 3001/5174, а proxy всё равно целится в 3000 → 502 (dev-окружение, не код).
- **Зависшие dev-процессы на портах 3000/5173:** перед `npm run dev` проверять, что порты свободны: `Get-NetTCPConnection -LocalPort 5173,3000 -State Listen -ErrorAction SilentlyContinue | Select LocalPort, OwningProcess`; остановить зависший процесс: `Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object -Expand OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }` (повторить для 3000).
- **Новая VPS не видна в UI:** GET-кэш бэкенда 30с → после POST вызывать `onRefresh()` → `fetchVps(true)` (`?refresh=1`).
- **curl к защищённым API (`/api/vps`, `/api/projects`):** без сессии — 401 «Требуется авторизация». Сначала логин с сохранением cookie: `curl -c ck -X POST .../api/auth/login -H 'Content-Type: application/json' -d '{"username":"…","password":"…"}'`, затем `curl -b ck ...`. Мутации — только `admin` (403 «Недостаточно прав»). В PowerShell JSON передавать `--data-raw '{"username":...}'` (без `\"`).
- **`users.mjs`/`node` на сервере:** в неинтерактивной SSH-сессии node/pm2 не в PATH — полный путь `/home/rybnikov/.nvm/versions/node/v24.19.0/bin/node` (например `.../node scripts/users.mjs add ...` из `$SERVER`).
- **Нет «тестового пароля» в документации:** пароли — только scrypt-хэши (не восстанавливаются), в dev `backend/.env` нет. Для проверки UI есть локальные учётки: `test` / `test123456` (роль admin) и `user` / `user123456` (роль user — вид не-админа, например на странице «Ремонт» нет карандаша «Изменить адрес объекта»), БД авторизации `backend/data/auth.sqlite`; пересоздать — `$env:AUTH_DB_PATH='backend/data/auth.sqlite'; node backend/scripts/users.mjs add test Тестовый admin --password test123456` (аналогично `add user User user --password user123456`; подробно — `docs/frontend-design.md` → «Проверка интерфейса (локально)»). Браузер при входе может автозаполнять поле пароля реальной учётки — очищать его.
- **Backend 502 под pm2:** диагностика `ss -ltnp | grep 3000`, `curl -i http://127.0.0.1:3000/api/health`, `pm2 logs family-backend --lines 50 --nostream`. pm2 не в PATH в неинтерактивной сессии — полный путь `~/.nvm/versions/node/v24.19.0/bin/pm2`.
- **Тестовый хост `test.rybnikov.su` (сервер 31.76.227.98, пользователь `rybnikov`, passwordless sudo):** отдельный инстанс `family-backend-test` на `127.0.0.1:3001` (`server/.env`: `PORT=3001`, `CORS_ORIGIN=https://test.rybnikov.su`), nginx `proxy_pass http://127.0.0.1:3001;`. Деплой — env `DEPLOY_HOST=test.rybnikov.su`, `DEPLOY_PM2_APP=family-backend-test`, `DEPLOY_PM2_HOME=/home/rybnikov/.pm2`. При «бэкенд оффлайн» — проверки `ss -ltnp | grep 3001`, `curl -i http://127.0.0.1:3001/api/health`, `NODE_ENV=production`; SSL — letsencrypt `/etc/letsencrypt/live/test.rybnikov.su/`.
- **Windows OpenSSH шлёт на сервер `HOME=C:Usersalex` (все хосты):** на сервере `$HOME/...`/`~/...` резолвятся относительно CWD. **Фикс:** `deploy.mjs` поддерживает `DEPLOY_PM2_HOME` (remote-скрипт делает `export PM2_HOME=...`) — задавать абсолютный `DEPLOY_PM2_HOME=/home/rybnikov/.pm2`, тогда демон стабилен. Без него PM2_HOME=$CWD/C:Usersalex/.pm2, демон нестабилен (деплой делает `start` вместо `restart`, возможен конфликт портов). Ручное управление pm2 — `export PM2_HOME=/home/rybnikov/.pm2; pm2 ...`. `NODE_ENV=production` хранится в env pm2 (задаётся при `pm2 start`), обычный `pm2 restart` его сохраняет; запуск без него → процесс online, но порт не слушается (гейт `app.listen`). На новых хостах pdf-setup деплоя создаёт venv по битому пути `$SERVER/C:Usersalex/renov-venv`→`--no-pdf-setup` + ручная установка venv (см. docs/server.md §4.1).
- **nginx:** `proxy_pass http://127.0.0.1:3000;` без трейлинг-слэша, иначе срезается `/api` и Express отдаёт 404.
- **pdf.js worker «Setting up fake worker failed: Failed to fetch dynamically imported module»:** `.mjs`-ассеты сборки Vite (в т.ч. `pdf.worker.min-*.mjs`) nginx отдаёт как `application/octet-stream`, пока в `/etc/nginx/mime.types` нет `application/javascript mjs;` — браузер отклоняет модуль. Проверять `curl -sI .../assets/*.mjs` → `Content-Type: application/javascript`. Фикс уже внесён (mime.types, бэкап `.bak`); при переустановке/пересборке nginx — проверить снова.
- **pdf.js v6 в Samsung Browser: `this[#t].getOrInsertComputed is not a function`** — pdf.js v6 использует `Map.prototype.getOrInsertComputed` (ES2025), отсутствующий в Samsung Internet (Chromium < 130) и части старых WebView. Полифилл — `frontend/src/utils/pdfPolyfills.ts` (`installPdfPolyfills`), вызывается в `PdfViewerModal.tsx` до использования pdf.js. При апгрейде `pdfjs-dist` проверять необходимость полифиллов новых API (`Promise.withResolvers` — Chrome 119+/Safari 17.4+; для старых браузеров может понадобиться).
- **`sharp` (превью изображений «Дневника»):** на новых серверах (`my.rybnikov.su` — Xeon Platinum 8260, `test.rybnikov.su` — E5-2697 v4; у обоих AVX2) работает **последняя `~0.35.3`** (`backend/package.json`). Прежний пин `~0.33.5` был нужен из-за слабого CPU старого сервера (QEMU x86-64-v1, без SSE4.2/POPCNT/AVX) — там sharp ≥0.34 падал с `Unsupported CPU` и давал 502 на весь API. **Правило:** перед апгрейдом sharp проверять CPU целевого сервера (`lscpu | grep -oE 'sse4_2|popcnt|avx|avx2'`) и `node -e "require('sharp')()..."`. Быстрый фикс при поломке: `cd $SERVER && npm install --omit=dev sharp@~0.33.5 && pm2 restart family-backend`.
- **Модель без vision (Vision Proxy):** если `view_image` возвращает только URI без пикселей, а открытая
  вкладка приходит как «(not visible)» — у модели нет доступа к изображениям (настройка
  `github.copilot.chat.visionProxy` или модель с vision). Это **не повод** отказываться от проверки:
  работают `read_page` (текстовый снимок) и Playwright-замеры (`run_playwright_code`, computed
  styles/offsets) — см. лестницу проверки в правиле 10.
- **Один инструмент «disabled» ≠ браузер недоступен:** ошибка у одного инструмента (например
  `run_playwright_code` → «currently disabled by the user») не значит, что недоступны остальные
  (`open_browser_page`, `read_page`, `screenshot_page`) — пробовать их, прежде чем сдаться и просить
  пользователя проверить вручную.
- **Сбой edit-инструмента (`oldString` не найден/не совпал) = устаревший контекст:** перечитать файл
  заново и повторить правку по свежему содержимому, не гадать по старым версиям и не перебирать
  варианты вслепую. В длинных сессиях файл, прочитанный давно (много правок/компактов назад),
  перечитывать непосредственно перед каждой правкой.
