# Слой Backend

Документ описывает общую архитектуру и эксплуатационный контракт backend. Поведение модулей и критерии приемки находятся в [доменных спецификациях](../domains/); полный HTTP-контракт — в [спецификации API](api.md).

## Стек и границы

- Node.js, Express 5 и Vite через `vite-plugin-node`; исходники — `backend/src/`.
- Backend предоставляет HTTP API и владеет бизнес-логикой, проверкой доступа, доменными хранилищами и файловыми операциями.
- Поток обработки запроса: `routes` → `controllers` → `services` → `db`/repositories. `app.ts` монтирует роутеры; доменная логика не должна попадать в frontend.
- Каждый домен владеет своей схемой и repository; поведение и данные домена описаны в его спецификации.

## Точка входа и запуск

`backend/src/app.ts` собирает Express-приложение, устанавливает CORS и парсеры JSON/urlencoded, монтирует роуты, запускает bootstrap-администратора и обслуживание auth-БД, затем устанавливает обработчики 404 и ошибок.

- В разработке Vite (`vite-plugin-node`) монтирует экспортированный `app`; `app.ts` не должен отдельно слушать порт.
- В production сервер слушает только при `NODE_ENV=production` или при прямом запуске entry point. Под pm2 основным сигналом служит `NODE_ENV=production`.
- Основная проверка типов: `npm run typecheck -w backend`; полный статический gate: `npm run typecheck`.

## Основные компоненты

| Каталог                    | Ответственность                                           |
| -------------------------- | --------------------------------------------------------- |
| `backend/src/config/`      | runtime-конфигурация, типы и реестр встроенных проектов   |
| `backend/src/routes/`      | декларация HTTP-маршрутов и middleware маршрута           |
| `backend/src/controllers/` | адаптация HTTP-запроса/ответа к сервисам                  |
| `backend/src/services/`    | бизнес-правила, интеграции и orchestration                |
| `backend/src/db/`          | схемы SQLite и repositories                               |
| `backend/src/middlewares/` | общие проверки доступа, загрузка файлов, обработка ошибок |
| `backend/scripts/`         | CLI и вспомогательные процессы, поставляемые с backend    |

## Доменная декомпозиция

- [VPS-мониторинг](../domains/vps.md)
- [Проекты](../domains/projects.md)
- [Авторизация](../domains/auth.md)
- [Дневник](../domains/diary.md)
- [Ремонт](../domains/renovation.md)
- [API-контракт](api.md)
- Сквозное применение auth/upload/error middleware описано в [спецификации middleware](middleware.md).

## Конфигурация и данные

Постоянные данные разделены по доменам; runtime-файлы хранятся в `backend/data/` и не коммитятся.

| Домен                 | SQLite / runtime-файлы                                   | Переменные окружения                                        | Владелец схемы             |
| --------------------- | -------------------------------------------------------- | ----------------------------------------------------------- | -------------------------- |
| VPS + общие настройки | `data/vps.sqlite`                                        | `DB_PATH`                                                   | `db/database.ts`           |
| Авторизация           | `data/auth.sqlite`                                       | `AUTH_DB_PATH`                                              | `db/authDatabase.ts`       |
| Проекты               | `data/projects.sqlite`                                   | `PROJECTS_DB_PATH`                                          | `db/projectsDatabase.ts`   |
| Ремонт                | `data/renovation.sqlite`, документы в `docs/renovation/` | `RENOVATION_DB_PATH`, `RENOVATION_DOCS_DIR`, `RENOVATION_*` | `db/renovationDatabase.ts` |
| Дневник               | `data/diary.sqlite`, изображения в `images/`             | `DIARY_DB_PATH`, `DIARY_IMAGES_DIR`                         | `db/diaryDatabase.ts`      |

Есть три независимых env-пространства: корневой `.env` — deploy-скрипты, `backend/.env` — runtime backend, `frontend/.env` — только `VITE_*`. Реальные `.env` не коммитятся; загруженные runtime-данные сохраняются при deploy. Полная конфигурация production — в [server guide](../operations/server.md).
