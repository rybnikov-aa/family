# Спецификация API (family)

| Поле          | Значение                                                                   |
| ------------- | -------------------------------------------------------------------------- |
| Тип документа | Модульная спецификация (Specification Driven Development)                  |
| Модуль        | HTTP API (все эндпоинты приложения)                                        |
| Проект        | my.rybnikov.su — семейный портал (монорепозиторий: `frontend` + `backend`) |

---

## 0. Общие положения

Общие сведения о портале, архитектуре, конфигурации окружения (`.env`), темы/роутинге и решениях (ADR) — в [docs/specification.md](specification.md). Модульные спецификации (требования, критерии приёмки, сценарии) — [docs/specification-vps.md](specification-vps.md), [docs/specification-projects.md](specification-projects.md), [docs/specification-auth.md](specification-auth.md). Здесь — **единый справочник по HTTP API**: все эндпоинты, матрица доступа, форматы ответов и примечания.

---

## 1. Авторизация API

Кроме `/api/health` и `POST /api/auth/login` **все** эндпоинты требуют действующую сессию (httpOnly-cookie `sid`): отсутствие/истёкшая сессия → **401**.

Мутирующие операции (`POST /api/vps`, `POST /api/vps/import`, `DELETE /api/vps/:name`, `POST /api/projects`, а также все эндпоинты `/api/auth/admin/*` и мутации `/api/diary`) доступны только роли `admin`; иначе — **403**.

- **Сессия:** cookie `sid` — httpOnly, `SameSite=Lax`, `Secure` в проде (`NODE_ENV=production`), срок `SESSION_TTL_HOURS` (по умолчанию 168 ч). В БД хранится только SHA-256 от токена.
- **Пароли** проверяются через scrypt (constant-time).

---

## 2. Эндпоинты

### 2.1. Авторизация

| Метод | Путь                | Назначение                            | Параметры                                                                                                                                   |
| ----- | ------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| POST  | `/api/auth/login`   | Вход (публичный)                      | Тело — `{username, password}`; ответ — `{user}`                                                                                             |
| POST  | `/api/auth/logout`  | Выход (авторизованным)                | —; ответ — 204                                                                                                                              |
| GET   | `/api/auth/me`      | Текущий пользователь (авторизованным) | —; ответ — `{user: {id, username, name, role}}`                                                                                             |
| PATCH | `/api/auth/profile` | Обновление профиля (авторизованным)   | Тело — `{name?, currentPassword?, password?}` (имя и/или пароль); смена пароля — с подтверждением `currentPassword`; ответ — `{user}` (200) |

**Админ-панель (только роль `admin`; иначе — 403):**

| Метод  | Путь                                 | Назначение                  | Параметры                                                                                                                |
| ------ | ------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/auth/admin/users`              | Список пользователей        | —; ответ — `{users: [{id, username, name, role, createdAt}]}`                                                            |
| POST   | `/api/auth/admin/users`              | Создание пользователя       | Тело — `{username, name, role: 'admin'\|'user', password}` (пароль ≥ 6 симв.); ответ — `{user}` (201); 409 — логин занят |
| PATCH  | `/api/auth/admin/users/:id/password` | Принудительная смена пароля | Тело — `{password}` (≥ 6 симв.); ответ — 204 (404 — пользователь не найден)                                              |
| DELETE | `/api/auth/admin/users/:id`          | Удаление пользователя       | —; ответ — 204 (404 — не найден; 400 — нельзя удалить собственную учётку; сессии удаляются каскадно)                     |

### 2.2. Проекты

| Метод  | Путь                  | Назначение                                   | Параметры / ответ                                                                                                        |
| ------ | --------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/projects`       | Список проектов (реестр + БД)                | 200 — массив `Project` (без контента); `refresh=1` — для совместимости                                                   |
| GET    | `/api/projects/:slug` | Полные данные проекта (с markdown-контентом) | 200 — `ProjectDetail`; 404 — не найден                                                                                   |
| POST   | `/api/projects`       | Создание проекта (admin)                     | JSON: `{slug, title, description, accent?, icon?, order?, content?}`; 201 — `Project`; 400 — невалидно; 409 — имя занято |
| PATCH  | `/api/projects/:slug` | Обновление проекта (admin)                   | JSON: частичные поля (метаданные и/или `content`); 200 — `ProjectDetail`; 400 — встроенный; 404 — не найден              |
| DELETE | `/api/projects/:slug` | Удаление проекта (admin)                     | 204; 400 — встроенный; 404 — не найден                                                                                   |

### 2.3. VPS

| Метод  | Путь              | Назначение                                 | Параметры                                                                                   |
| ------ | ----------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| GET    | `/api/vps`        | Статусы доступности всех VPS + их сервисов | `refresh=1` — форсированная перепроверка (обход кэша)                                       |
| POST   | `/api/vps`        | Добавить VPS на мониторинг (admin)         | Тело — `VpsEntry` (`{country, name, ip, panel, services[]}`)                                |
| POST   | `/api/vps/import` | Импорт VPS из JSON (admin)                 | Тело — `{ "vps": [VpsEntry, …] }` (или голый массив); ответ — `{imported, skipped, errors}` |
| DELETE | `/api/vps/:name`  | Удалить VPS по имени (admin)               | —; ответ — 204 (404 — если не найдено)                                                      |

### 2.4. Health

| Метод | Путь          | Назначение                   | Параметры |
| ----- | ------------- | ---------------------------- | --------- |
| GET   | `/api/health` | Здоровье бэкенда (публичный) | —         |

### 2.5. Ремонт (renovation)

Модуль «Ремонт» — отчётность из отдельной БД `renovation.sqlite`. Чтение — под `requireAuth`;
мутации (импорт PDF, применение доп. соглашений) — под `requireAdmin`. Подробно о
данных/домене — `docs/specification-renovation.md`.

| Метод | Путь                                        | Назначение                                                        | Параметры/ответ                                                                                                                                                                                                                             |
| ----- | ------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET   | `/api/renovation`                           | Сводка: Работы / Материалы (план/факт, заказы, ведомости)         | —; ответ — `RenovationOverview` (копейки)                                                                                                                                                                                                   |
| GET   | `/api/renovation/estimate/versions`         | Список версий сметы (сводки)                                      | —; ответ — `{versions: EstimateVersion[]}`                                                                                                                                                                                                  |
| GET   | `/api/renovation/estimate`                  | Версия сметы с позициями                                          | `version` — числовой id либо тип `seed\|current\|history\|addendum` (по умолчанию `current`); 404 — не найдена                                                                                                                              |
| GET   | `/api/renovation/docs`                      | Документы: акты работ / заказы материалов                         | `type` — `work_act\|material_order` (необязательно); ответ — `{docs: RenovationDoc[]}`                                                                                                                                                      |
| GET   | `/api/renovation/docs/:file`                | Загруженный PDF «Ремонта» из `RENOVATION_DOCS_DIR`                | `file` — имя сохранённого файла; ответ — PDF (`application/pdf`); 400 — некорректное имя (path traversal), 404 — файл не найден                                                                                                             |
| GET   | `/api/renovation/design`                    | Документы дизайн-проекта (подпапка `design/` каталога документов) | —; ответ — `{docs: {fileName, title, url}[]}` (по заголовку)                                                                                                                                                                                |
| GET   | `/api/renovation/docs/design/:file`         | PDF дизайн-проекта из подпапки `design/`                          | `file` — имя файла (`[a-z0-9._-]`); ответ — PDF (`application/pdf`); 400 — некорректное имя, 404 — файл не найден                                                                                                                           |
| GET   | `/api/renovation/settlements`               | Акты взаиморасчётов                                               | `type` — `works\|materials` (необязательно); ответ — `{acts: SettlementAct[]}`                                                                                                                                                              |
| POST  | `/api/renovation/pdf`                       | Импорт PDF → черновик (admin)                                     | multipart: `name` (имя файла), `file` (PDF); ответ — `{draft}` (201); 400 — не PDF; 413 — файл больше 20 МБ; 422 — не удалось извлечь; PDF сохраняется как pending, при подтверждении переносится в `docs/renovation/` и пишется `pdf_path` |
| POST  | `/api/renovation/pdf/:id/confirm`           | Подтверждение импорта черновика (admin)                           | —; ответ — `{id, type, date}` (201); 409 — документ типа+даты уже есть; 400 — тип/дата не определены; 404 — черновик истёк                                                                                                                  |
| POST  | `/api/renovation/estimate/addendum`         | Предложение применения доп. соглашения (admin)                    | тело — `{addendumId}`; ответ — `{proposal}` (дифф + новый итог); 404 — соглашение/смета не найдены                                                                                                                                          |
| POST  | `/api/renovation/estimate/addendum/confirm` | Применение доп. соглашения (admin)                                | тело — `{addendumId, removeKeys?: string[]}`; ответ — `{currentId, total, totalNoOverhead, overhead, itemsCount}` (201); 400 — нет даты; 404 — не найдено                                                                                   |
| PUT   | `/api/renovation/materials-budget`          | Обновить бюджет на материалы (admin)                              | тело — `{mode: 'percent'\|'amount', percent?, amount?}` (сумма — копейки); ответ — `{budget: MaterialsBudget}` (настройка + действующий `value`); 403 — не admin                                                                            |
| PUT   | `/api/renovation/meta`                      | Обновить реквизиты: адрес и/или дату старта (admin)               | тело — подмножество `{object: string, startDate: 'ГГГГ-ММ-ДД'}` (`object` — непустая строка, пробелы обрезаются; `startDate` — корректная дата); ответ — `{meta: RenovationMeta}`; 400 — пустое/некорректное поле; 403 — не admin           |
| GET   | `/api/renovation/reports/work`              | Отчёт «Ход работ»: план vs факт по позициям сметы                 | —; ответ — `{work: ReportWork}` (секции/строки со статусами, итоги, `asOf`, взаиморасчёты)                                                                                                                                                  |
| GET   | `/api/renovation/reports/materials`         | Отчёт «Материалы»: заказы с позициями и итогами                   | —; ответ — `{materials: ReportMaterials}` (заказы + сводка)                                                                                                                                                                                 |

### 2.6. Дневник (diary)

Раздел «Дневник» — события семьи в отдельной БД `diary.sqlite`; изображения — в каталоге
`DIARY_IMAGES_DIR` (`images/<folder>/`, уникальная папка на событие; каталог сохраняется при деплое).
Чтение — под `requireAuth`; мутации (создание/изменение/удаление) — под `requireAdmin`. В `content`
можно использовать маркеры `![подпись](diary-image://имя-файла)` (отображаются сеткой на 2 столбца на всю ширину);
на странице события они показываются в тексте и не дублируются в нижней галерее.
Подробно — `docs/specification-diary.md`.

| Метод  | Путь                              | Назначение                                   | Параметры/ответ                                                                                                                                                                                                                                                                                                                                               |
| ------ | --------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/diary`                      | Список событий (сводки, без контента)        | —; ответ — массив `DiaryEventSummary` (`{id, title, dateStart, dateEnd, summary, folder, cover, images[]}`); сортировка — по `dateStart` (свежие раньше)                                                                                                                                                                                                      |
| GET    | `/api/diary/:id`                  | Полные данные события (с markdown-контентом) | —; ответ — `DiaryEventDetail` (сводка + `content`); 404 — не найдено                                                                                                                                                                                                                                                                                          |
| POST   | `/api/diary` (admin)              | Создание события                             | multipart: `title`, `dateStart`, `dateEnd?`, `summary`, `content` (маркеры новых фото используют `diary-image://<new-id>`), `images` (файлы, поле `images`), `newIds` (JSON-массив клиентских id), `keep` (JSON-массив, пустой), `cover` (id нового файла); 201 — `DiaryEventDetail`; 400 — невалидно; 413 — файл > 10 МБ; 400 — не-изображение / > 30 файлов |
| PATCH  | `/api/diary/:id` (admin)          | Обновление события                           | multipart: те же поля; `keep` — имена сохраняемых файлов (остальные удаляются), новые файлы — в `images`, `cover` — id нового файла либо имя существующего; 200 — `DiaryEventDetail`; 400/413; 404 — не найдено                                                                                                                                               |
| DELETE | `/api/diary/:id` (admin)          | Удаление события (+ папка изображений)       | —; 204; 404 — не найдено                                                                                                                                                                                                                                                                                                                                      |
| GET    | `/api/diary/images/:folder/:file` | Изображение события из `images/<folder>/`    | `folder`/`file` — имена (`[a-z0-9._-]`, без выхода за каталог). Без параметра — оригинал в полном размере (открытие на весь экран); `?preview=1` — уменьшенная копия (WebP, подпапка `thumbs/`, генерируется лениво, `Cache-Control: private, max-age=31536000, immutable`); 400 — некорректный путь (path traversal), 404 — не найдено                       |

---

## 3. Форматы ответов

### 3.1. `GET /api/vps`

```json
[
  {
    "country": "nl",
    "name": "jhnl",
    "ip": "150.251.139.253",
    "panel": "https://my.justhost.asia/",
    "online": true,
    "latencyMs": 85,
    "error": null,
    "checkedAt": "2026-08-05T…",
    "services": [
      {
        "name": "3x-ui",
        "type": "http",
        "address": "…",
        "online": true,
        "latencyMs": 456,
        "error": null
      }
    ]
  }
]
```

### 3.2. `GET /api/projects`

```json
[
  {
    "slug": "renovation",
    "title": "Ремонт квартиры",
    "description": "Отчётность по ремонту: смета, внесённые средства, отчёты о работах и материалах.",
    "accent": "#e8872e",
    "icon": "renovation",
    "kind": "app",
    "url": "/projects/renovation",
    "order": 0,
    "editable": false
  }
]
```

`GET /api/projects/:slug` возвращает те же поля + `content` (markdown) для созданных через UI
проектов (`content: ''` — у встроенных).

### 3.3. `GET /api/renovation`

Все суммы/количество — **целые копейки (×100)**. Поля: `meta`, `estimate`, `works`
(`planTotal`/`factTotal`/`percent`/`acts[]`), `materials` (`ordersTotal`/`orders[]`),
`settlements` (`works`/`materials` — последний акт на тип, `null` если нет; каждый объект
содержит `pdfPath` — URL исходного PDF ведомости для ссылки-просмотра, и `foremenAmount` —
сумма «подотчётные прораба» в ведомости, копейки, `null` если нет), `materialsBudget`
(настройка бюджета на материалы: `mode` `percent`/`amount`, `percent`/`amount`, и
действующий `value` — `percent`% от актуальной сметы либо явная сумма).

```json
{
  "meta": {
    "object": "г. Ростов-на-Дону, пр-кт Сиверса, д. 8, стр. 2.3, кв. 100, этаж 7",
    "contractNo": "№6124",
    "contractDate": "2025-12-26",
    "contractor": "ООО «А-сервис»",
    "startDate": "2026-06-30",
    "deadlineDays": 200,
    "area": "91,91 м²"
  },
  "estimate": {
    "id": 61,
    "total": 204001048,
    "totalNoOverhead": 194286712,
    "overhead": 9714336,
    "itemsCount": 62
  },
  "works": {
    "planTotal": 204001048,
    "factTotal": 14112788,
    "percent": 6.9,
    "acts": [
      {
        "id": 51,
        "number": null,
        "date": "2026-07-26",
        "title": "Акт приемки выполненных работ",
        "totalWithOverhead": 14112788
      }
    ]
  },
  "materials": {
    "ordersTotal": 43372480,
    "orders": [
      {
        "id": 52,
        "number": "1",
        "date": "2026-07-17",
        "title": "Заказ материалов №1",
        "total": 10873204
      }
    ]
  },
  "settlements": {
    "works": {
      "date": "2026-07-26",
      "paidIn": 30187600,
      "used": 14112780,
      "balance": 16074820,
      "pdfPath": "/api/renovation/docs/settlement_works_2026-07-26.pdf",
      "foremenAmount": null
    },
    "materials": {
      "date": "2026-08-06",
      "paidIn": 40000000,
      "used": 42283280,
      "balance": -2283280,
      "pdfPath": "/api/renovation/docs/settlement_materials_2026-08-06.pdf",
      "foremenAmount": 5000000
    }
  },
  "materialsBudget": {
    "mode": "percent",
    "percent": 100,
    "amount": null,
    "value": 204001048
  }
}
```

---

## 4. Примечания

- **Кэширование:** `GET /api/vps` — 30 с (`?refresh=1` — мимо кэша). У `GET /api/projects` кэша сканирования больше нет — данные читаются из БД/реестра (`?refresh=1` принимается для обратной совместимости).
- **Проекты** — встроенный реестр `config/appProjects.ts` (`editable: false`) + записи БД `projects` (`editable: true`). Создание/изменение/удаление (`POST`/`PATCH`/`DELETE`) — только для записей БД, admin; встроенные проекты редактировать/удалять нельзя (400). `slug` — латиница, цифры и дефисы (без `_`/`.` в начале); занятое имя → 409. Бэкенд НЕ создаёт файлов/папок — проект хранится в SQLite.
- **Коды ошибок:** валидация → 400, дубликат имени VPS → 409, нет/истёкшая сессия → 401, недостаточно прав → 403, не найдено → 404, непредвиденные → 500 (`{message: 'Внутренняя ошибка сервера'}`).
- Сообщения об ошибках API — на русском.
