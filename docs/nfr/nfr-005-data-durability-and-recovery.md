# NFR-005: Сохранность данных и восстановление

- **Статус:** действует
- **Область:** persistent databases, imported PDFs, diary images and production deployment.
- **Источники:** `docs/layers/backend.md`, `docs/operations/backup.md`, `docs/operations/server.md`, domain specs.

## Требования

- **NFR-005.1** VPS, auth, projects, renovation и diary используют разделенные доменные SQLite-хранилища с владельцами схем, указанными в backend layer spec.
- **NFR-005.2** Runtime SQLite-файлы, загруженные PDF ремонта и изображения дневника переживают application deployment; исходный код проекта не является источником этих пользовательских данных.
- **NFR-005.3** Backup включает все SQLite базы с WAL/SHM, PDF, изображения и runtime `.env`; архив проверяется checksum.
- **NFR-005.4** Restore поддерживает восстановление runtime state; production database/file mutation не выполняется без явной авторизации и проверки цели согласно guardrails.

## Проверка

Критерии состава и восстановления — `docs/operations/backup.md`; deployment preservation — `docs/operations/server.md`; структура доменных файлов — `docs/layers/backend.md` и соответствующие domain specs.
