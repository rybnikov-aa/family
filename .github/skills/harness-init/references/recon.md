# Разведка монорепозитория (шаг 0)

Цель — собрать фактическую картину проекта **до** написания документов. Только чтение:
не мутировать файлы, не запускать деплой, миграции, `install`, не коммитить.

## Что определить

| Что                      | Где смотреть                                                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout монорепа          | `package.json` → `workspaces`, `pnpm-workspace.yaml`, `lerna.json`, `turbo.json`, `nx.json`, `go.work`, `Cargo.toml` (`[workspace]`), `settings.gradle`, `pom.xml` (`<modules>`) |
| Пакетный менеджер        | lock-файл: `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` / `bun.lockb` / `uv.lock` / `poetry.lock` / `go.sum`                                                             |
| Версия рантайма          | `engines` в `package.json`, `.nvmrc`, `.tool-versions`, `go.mod`, `rust-toolchain.toml`, `pyproject.toml` (`requires-python`)                                                    |
| Скрипты и команды        | все `package.json` → `scripts`; `Makefile`, `justfile`, `Taskfile.yml` — выписать **точные** строки запуска                                                                      |
| Статический гейт         | какой скрипт является единственной обязательной проверкой (`typecheck`/`build`/`lint`); есть ли тесты и линтер                                                                   |
| Порты и точки входа      | `PORT` в env-примерах, `listen(`, `vite.config.*`, `docker-compose.yml`, `docker-compose.override.yml`                                                                           |
| Слои и модули            | структура `src/` каждой рабочей области: `routes`/`controllers`/`services`/`db` или `pages`/`components`/`hooks`/`api`                                                           |
| Хранилища данных         | драйверы БД в зависимостях, файлы `*.sqlite`, каталоги данных, миграции, ORM-схемы, `docker-compose` volumes                                                                     |
| Окружение                | `.env*`, `.env.example`, `.gitignore`, CI-секреты — **сколько независимых пространств** и кто их читает                                                                          |
| Деплой и публикация      | `scripts/*.{mjs,sh,py}`, `.github/workflows/*`, `Dockerfile`, `*.service` (systemd), nginx-конфиги, `Procfile`                                                                   |
| Внешние интеграции       | клиенты сторонних API, ключи в env-примерах, разделы `docs/`                                                                                                                     |
| Уже существующий харнесс | `AGENTS.md`, `README.md`, `docs/**`, `.github/**`, `CONTRIBUTING.md`, `SECURITY.md`, `CODEOWNERS`                                                                                |

## Примеры команд (read-only)

```powershell
Get-ChildItem -Force | Select-Object Mode, Name
(Get-Content package.json -Raw | ConvertFrom-Json).workspaces
Get-ChildItem -Recurse -Filter package.json -Depth 2 | ForEach-Object { $_.FullName }
```

Поиск по коду (те же цели в любом инструменте/ОС):

- порты и запуск: `listen\(|PORT|serve\(|WebApplication\.CreateBuilder`
- слои: `routes/|controllers/|services/|repositories/|db/`
- хранилища: `sqlite|postgres|mongoose|prisma|typeorm|redis`
- окружение: `process\.env\.|import\.meta\.env\.|os\.environ`
- деплой: `ssh|scp|rsync|pm2|docker compose|kubectl`

## Результат шага

Инвентарь (5–15 строк), в котором:

1. перечислены рабочие области с их стеком, ролью и портами;
2. перечислены точные команды (`dev`, `build`, гейт, тесты, деплой, бэкап) с указанием, откуда взяты;
3. перечислены **модули-кандидаты** для `docs/specification-<модуль>.md` (по роутам, каталогам, таблицам);
4. перечислены пространства `.env` и их потребители;
5. честно указано, что проверить не удалось (`TODO(verify)`).

Список модулей и стек подтвердить у пользователя одним коротким сообщением.

## Грабля

Разведка «по памяти о похожем проекте» — главный источник выдуманных команд и путей. Всё, что
не подтверждено файлом в **этом** репозитории, в документы не попадает.
