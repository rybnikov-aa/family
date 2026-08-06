---
description: 'Use when changing backend code in backend/src/**: Express-роуты, контроллеры, сервисы, SQLite (node:sqlite), конфигурация env, обработка ошибок. Покрывает слои routes→controllers→services→db, грабли node:sqlite (транзакции, UNIQUE), live-binding reloadVpsEntries, гейтинг app.listen, кэши, конвенции TypeScript/Prettier.'
name: 'Backend Conventions'
applyTo:
  ['backend/src/**', 'backend/vite.config.ts', 'backend/tsconfig.json', 'backend/.env.example']
---

# Backend Conventions (family)

## Слои

- Поток вызовов: routes (`backend/src/routes/*.ts`) → controllers (`backend/src/controllers/*.ts`) → services (`backend/src/services/*.ts`) → SQLite (`backend/src/db/*`). Роутеры монтируются в `app.ts` под `/api`.

## SQLite (node:sqlite)

- `db.transaction()` не реализован → ручные `BEGIN`/`COMMIT`/`ROLLBACK`.
- Строки возвращаются как `Record<string, SQLOutputValue>` → двойной каст `as unknown as MyRow`.
- **Конфликт UNIQUE определять по `(err.errcode & 0xff) === 19`** (`isConstraintError`), НЕ по `err.code` (`ERR_SQLITE_ERROR`).
- `mkdirSync(dirname(dbPath), { recursive: true })` обязателен до `new DatabaseSync()`.
- Vite оставляет `node:sqlite` external (не инлайнит) — это нормально.

## Live-binding

- После INSERT/DELETE VPS всегда вызывать `reloadVpsEntries()` (`config/vps.ts` перечитывает список из БД; работает и в ESM, и в CJS-бандле).

## app.listen (гейтинг)

- В `app.ts` слушать только при `NODE_ENV=production` ЛИБО прямом запуске. Под pm2 `process.argv[1]` — враппер pm2 (не скрипт), поэтому основной сигнал — `NODE_ENV=production`. В dev Vite монтирует `app` сам — слушать нельзя.

## Кэши

- `GET /api/vps` кэшируется 30с (`services/vpsChecker.ts`), `GET /api/projects` — 60с (`services/projectsService.ts`). Сохранять обход `?refresh=1`/force там, где он есть.

## Ошибки и статусы

- Контроллеры сами маппят валидацию → 400 и дубликат имени → 409; непредвиденные ошибки пробрасывать в `errorHandler` (500). 404 — `notFoundHandler`.
- Сообщения API (400/409/500) — на русском.

## Конфигурация

- Env-переменные — только через `config/env.ts` (`PORT`, `NODE_ENV`, `CORS_ORIGIN`, `DB_PATH`, `PROJECTS_DIR`). Реальные `.env` не переопределяют уже заданные переменные окружения.
- `.env.example`: документированный шаблон; `backend/.env` — рантайм (в git не попадает).

## Конфигурация (backend/)

- `vite.config.ts`: dev-порт 3000, `vite-plugin-node` (adapter `express`, `appPath: './src/app.ts'`, `exportName: 'app'`) — не менять без явной задачи.
- `tsconfig.json`: расширяет `tsconfig.base.json`; `strict`, `noUnusedLocals`, `noUnusedParameters` не ослаблять.

## TypeScript и форматирование

- `noUnusedLocals`/`noUnusedParameters` включены → неиспользуемые переменные/параметры — ошибки (TS6133); неиспользуемые параметры называть `_req`/`_next` (как в `errorHandler.ts`).
- Prettier: singleQuote, semi, printWidth 100, trailingComma all.

## Язык

- Комментарии в коде и сообщения API — на русском.
