---
name: vps
description: 'VPS-мониторинг в проекте family. Use when: изменение VPS-кода (backend: db/vpsRepository, services/vpsChecker, controllers/vpsController, config/vps; frontend: useVps, useServices, api/client, модалки VPS), добавление/импорт/удаление VPS или сервисов, новый тип проверки (http/ocserv), диагностика «VPS не видна» / кэша 30с, ошибки 409/400/404, формулы доступности, layout модалки детализации.'
argument-hint: 'VPS'
user-invocable: true
---

# VPS-мониторинг (family)

Подсистема проверки доступности VPS: конфигурация в SQLite (`node:sqlite`), API `/api/vps`, фоновая проверка IP + сервисов с кэшем 30с, виджеты на главной и модалка детализации.

## Когда использовать

- Правка любого кода VPS на бэкенде (`backend/src/db/`, `backend/src/services/vpsChecker.ts`, `backend/src/controllers/vpsController.ts`, `backend/src/config/vps.ts`) или фронтенде (`frontend/src/hooks/useVps.ts`, `useServices.ts`, `api/client.ts`, `VpsAddModal`, `VpsDetailsModal`).
- Добавление / импорт / удаление VPS или сервисов.
- Добавление нового типа проверки сервиса (сейчас есть `http` и `ocserv`).
- Диагностика статусов, «VPS не видна в UI», ошибок 409/400/404.

## Конвенции

Общие конвенции и правила — в [AGENTS.md](../../../AGENTS.md): документация синхронно с кодом
(правило 1), `npm run typecheck` — единственный gate (правило 3), node:sqlite-грабли (правило 4),
авторизация (раздел «Авторизация»), live-binding VPS (раздел «Backend»). VPS-специфичное здесь:

- **Кэш 30с**: `GET /api/vps` кэшируется на 30с. Чтобы UI сразу увидел изменения — `fetchVps(true)` (`?refresh=1`), обычно через `onRefresh()`.
- **curl к защищённым API**: сначала логин с cookie (`curl -c ck -X POST http://127.0.0.1:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"…","password":"…"}'`), затем `curl -b ck …`; мутации (`POST /api/vps`, импорт, `DELETE`) — только `admin` (иначе 403).

## Процедуры

### Добавить VPS

1. Данные: `country` (ISO-код, справочник `frontend/src/utils/countries.ts`), `name` (уникален, регистронезависимо), `ip`, `panel`, `services[]` (`name`, `type`, `address`).
2. Вставка: `insertVpsEntry(entry)` (`db/vpsRepository.ts`, транзакция BEGIN/COMMIT/ROLLBACK) → `reloadVpsEntries()`.
3. Контроллер `POST /api/vps`: валидация `normalizeEntry()` (обязательны country/name/ip, иначе 400); дубликат `name` → 409 по `isConstraintError`.
4. Фронт: `createVps()` (`api/client.ts`) → после успеха `onRefresh()` → `fetchVps(true)`.
5. Импорт из JSON: `POST /api/vps/import` — тело `{vps:[...]}` или голый массив; ответ `{imported, skipped, errors}` (201). Дубликаты имён (в т.ч. внутри файла) и невалидные записи — пропускаются.

### Добавить новый тип проверки сервиса

1. `services/vpsChecker.ts`: добавить ветку в `checkService()` (диспетчеризация по `service.type`).
2. Если нужны новые пробы портов — добавить их в `checkIp()` (`addTcp`/`addUdpDtls`; базовые порты «машина жива» 22/443/80 уже есть, они НЕ зависят от сервисов).
3. `VpsServiceStatus`/`VpsStatus` уже универсальны (`online`/`latencyMs`/`error`) — менять типы обычно не нужно.
4. Обновить `docs/specification-vps.md` (таблица типов проверки) и README при необходимости.

### Диагностика статусов VPS

- «VPS добавлена, но не видна в UI» → GET-кэш 30с; вызвать `fetchVps(true)` (`?refresh=1`).
- «Сервис оффлайн, хотя работает» → проверить `address`: для `http` — полный URL (fallback https→http); для `ocserv` — host[:port] без схемы (порт по умолчанию 443); таймауты: http 5с, IP 3с.
- 409 «уже существует» → `(errcode & 0xff) === 19` (SQLITE_CONSTRAINT_UNIQUE на `name`).
- Доступность: VPS = ip*0.5 + доля доступных сервисов*0.5; общая = среднее по всем VPS; состояние: 100%→ok, (90,100)→warning, иначе error (`frontend/src/utils/availability.ts`).

### Просмотр БД (что в SQLite)

```bash
node .github/skills/vps/scripts/list-vps.mjs [--name <имя>] [--json] [--db <путь>]
```

Read-only просмотр VPS и их сервисов из SQLite (по умолчанию `backend/data/vps.sqlite`). Удобно для сверки содержимого БД с API/UI и диагностики «запись не добавлена».

## Справочник

- [Архитектура VPS](./references/vps-architecture.md) — схема БД, типы, все эндпоинты, логика чекера (http/ocserv/DTLS), фронтенд-хуки, layout модалок, грабли.
