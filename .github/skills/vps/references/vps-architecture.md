# Архитектура VPS-мониторинга (family)

Справочник по подсистеме VPS. Процедуры и правила — в `../SKILL.md`.

## Хранилище (SQLite, node:sqlite)

- Файл БД: `backend/data/vps.sqlite` (путь — `env.DB_PATH`, по умолчанию `data/vps.sqlite`; в git не попадает, при деплое сохраняется).
- Код: `backend/src/db/database.ts` (singleton `getDb()`, `closeDb()`), `backend/src/db/vpsRepository.ts`.
- PRAGMA при открытии: `journal_mode = WAL`, `foreign_keys = ON`.
- Утилита: [list-vps.mjs](../scripts/list-vps.mjs) — read-only просмотр VPS/сервисов (`--name`, `--json`, `--db`).

Схема (создаётся автоматически `CREATE TABLE IF NOT EXISTS` при первом обращении):

```sql
CREATE TABLE IF NOT EXISTS vps (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  country TEXT    NOT NULL,
  name    TEXT    NOT NULL UNIQUE,   -- естественный ключ, идентификация записи
  ip      TEXT    NOT NULL,
  panel   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS vps_services (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  vps_id  INTEGER NOT NULL REFERENCES vps(id) ON DELETE CASCADE,
  name    TEXT    NOT NULL,
  type    TEXT    NOT NULL,
  address TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vps_services_vps_id ON vps_services(vps_id);
```

В той же БД также таблицы `users` и `sessions` (авторизация: см. `backend/src/services/authService.ts`) — в этот справочник они не входят.

## Типы (`backend/src/config/vps.ts`)

- `VpsServiceConfig` = `{ name, type, address }` (type: `http` | `ocserv` | …).
- `VpsEntry` = `{ country, name, ip, panel, services: VpsServiceConfig[] }`.
- `VpsServiceStatus` = `VpsServiceConfig` + `{ online, latencyMs, error }`.
- `VpsStatus` = `VpsEntry` + `{ online, latencyMs, error, checkedAt, services: VpsServiceStatus[] }`.
- `export let vpsEntries: VpsEntry[] = loadVpsEntries()` — читается из БД при старте; `reloadVpsEntries()` перечитывает после мутаций (live-binding работает в ESM и в CJS-бандле — общая модульная переменная).

## API (`backend/src/routes/vps.ts` → `controllers/vpsController.ts`)

| Метод  | Путь              | Результат                                                                  |
| ------ | ----------------- | -------------------------------------------------------------------------- |
| GET    | `/api/vps`        | `VpsStatus[]`; кэш 30с; `?refresh=1`/`?refresh=true` — мимо кэша           |
| POST   | `/api/vps/import` | `{ imported, skipped, errors }` (201); тело `{vps:[...]}` или голый массив |
| POST   | `/api/vps`        | 201 + созданная запись; 400 (нет country/name/ip); 409 (дубликат `name`)   |
| DELETE | `/api/vps/:name`  | 204; 400 (пустое имя); 404 (не найдено)                                    |

- **Авторизация**: все эндпоинты `/api/vps` требуют действующую сессию (httpOnly-cookie `sid`; без неё — 401). Мутации (POST, import, DELETE) доступны только роли `admin` (иначе 403). UI гейтит админ-действия по `useAuth().user?.role === 'admin'`.
- Валидация — `normalizeEntry()`: trim полей, обязательны `country`/`name`/`ip`; сервисы фильтруются по непустым `name`/`type`/`address`.
- 409 — `isConstraintError(err)`: `(err.errcode & 0xff) === 19` (SQLITE_CONSTRAINT; фактический errcode 2067 = SQLITE_CONSTRAINT_UNIQUE). НЕ полагаться на `err.code` (`ERR_SQLITE_ERROR`).
- После любой мутации (create/import/delete) — `reloadVpsEntries()`.
- Прочие непредвиденные ошибки контроллеры пробрасывают → `errorHandler` (500 `{message:'Internal Server Error'}`).

## Чекер (`backend/src/services/vpsChecker.ts`)

- Константы: `CHECK_TIMEOUT_MS=5000` (http), `IP_TIMEOUT_MS=3000` (IP), `OCSERV_DEFAULT_PORT=443`, `CACHE_TTL_MS=30000`.
- Кэш: модульные `cache` + `inflight` (TTL 30с + in-flight dedup). `getVpsStatuses(force=false)`: при `force` — мимо кэша.
- `checkIp(entry)`:
  - Пробы: базовые TCP 22/443/80 + порты сервисов (`http` — TCP, `ocserv` — TCP и UDP/DTLS), таймаут 3с.
  - `anySucceeds()` — короткое замыкание на первую успешную пробу.
  - Базовые порты НЕ зависят от сервисов → недоступный сервис не даёт 0% (доступность = IP*0.5 + сервисы*0.5).
  - IP недоступен → `online:false`, сервисы НЕ проверяются (каждый получает `error: 'IP недоступен — проверка пропущена'`).
- `httpCheck`: `fetch` с `AbortController`, таймаут 5с; любой ответ (в т.ч. 4xx/5xx) = online; `toCheckUrls()` — fallback https→http.
- `ocservCheck`: TCP на host:port (адрес без схемы, `parseOcservAddress`, порт по умолчанию 443); при неудаче — UDP/DTLS-проба (`udpDtlsReachable`): минимальный DTLS ClientHello, любой ответный датаграмм = канал жив.
- `checkService`: диспетчеризация по `service.type`; неизвестный тип → `online:false`, `error: 'Неподдерживаемый тип проверки: …'`.
- `urlPort()`: порт из URL сервиса (явный или по протоколу: https=443, http=80).

## Фронтенд

- `frontend/src/api/client.ts`: `API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'`.
  - `fetchVps(force=false)` — `?refresh=1` при `force`.
  - `createVps(entry)` — POST; из ошибок извлекается `{message}` и бросается `Error(message)`.
  - `importVps({vps})` — POST `/api/vps/import`; ответ `VpsImportResult`.
  - `deleteVps(name)` — DELETE с `encodeURIComponent`.
- `frontend/src/hooks/useVps.ts` → `{ statuses, error, loading, refresh }`; `refresh()` = `fetchVps(true)`.
- `frontend/src/hooks/useServices.ts` → `{ services, vps, loading, refresh }` (агрегирует карточки разделов/проектов/VPS; карточка VPS показывает «%» через `overallAvailability`).
- `frontend/src/utils/availability.ts`:
  - `vpsAvailability(vps)`: `total = ip*0.5 + services*0.5` (ip = 1/0; services = доля доступных).
  - `overallAvailability(statuses)` = сумма `total` / кол-во VPS.
  - `availabilityState(percent)`: 100 → `ok`, (90,100) → `warning`, иначе `error`.
- `frontend/src/utils/countries.ts`: `COUNTRIES` (ISO + русская подпись) для формы, `countryLabel(code)`.
- Импорт из файла: `frontend/src/utils/vpsImport.ts` (`parseVpsImport`) → `importVps()`; результат — баннер `.modal__import-note` (зелёный/красный, автоскрытие 6с).
- Флаг страны: картинка `https://flagcdn.com/{country}.svg` (эмодзи-флаги на Windows показываются как буквы «EU», поэтому нужен ISO-код + CDN).

### UI / модалки

- Карточка VPS на главной — `<div role="button" tabIndex={0}>` (класс `stat-item--clickable`), НЕ `<button>`: внутри можно вложить кнопку «Обновить» (она вызывает `event.stopPropagation()` и не открывает модалку).
- Кнопки «Обновить» (RefreshIcon, спин при loading): на главной — внутри карточки VPS рядом с «%» (`.stat-item__value-row` + компактный `.stat-refresh`), в шапке модалки — `.modal__refresh`.
- `VpsDetailsModal` — детализация: флаг, IP/сервисы, статусы сервисов. Кнопки в `.modal__vps-head-actions`: шестерёнка (панель), корзина (`.modal__vps-delete`, TrashIcon), кнопка импорта (UploadIcon), кнопка «+» (добавление, открывает `VpsAddModal`).
- `VpsAddModal` — форма: Расположение (справочник `countries.ts`), Имя, IP, Панель, поле «Сервисы» (чипы + кнопка с троеточием → редактор `.services-editor`).

## Грабли (кратко)

- **30с GET-кэш** → после любой мутации фронт должен делать `?refresh=1` (`onRefresh()` → `fetchVps(true)`).
- **node:sqlite**: `(errcode & 0xff) === 19` для UNIQUE; ручные `BEGIN`/`COMMIT`/`ROLLBACK`; `as unknown as MyRow`; `mkdirSync` до `new DatabaseSync()`; Vite оставляет `node:sqlite` external.
- **`noUnusedLocals`/`noUnusedParameters`** → неиспользуемые параметры называть `_req`/`_next`, иначе TS6133.
- **Документация**: формулы доступности — в `docs/specification-vps.md`, контракт API — в `docs/specification-api.md`; обновлять вместе с кодом (правило «все документы» из `AGENTS.md`).
