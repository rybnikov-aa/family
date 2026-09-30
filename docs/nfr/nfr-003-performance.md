# NFR-003: Производительность

- **Статус:** действует
- **Область:** повторные запросы, объемы фото/PDF и загрузка frontend.
- **Источники:** `docs/domains/vps.md`, `docs/domains/diary.md`, `docs/immich.md`, `docs/layers/frontend.md`.

## Требования

- **NFR-003.1** VPS status GET использует 30-секундный cache и in-flight deduplication; пользовательский forced refresh обходит cache.
- **NFR-003.2** Изображения дневника в списках и галереях выдаются как ленивые WebP previews; оригинал загружается при открытии полноразмерного изображения.
- **NFR-003.3** Крупные страницы/модальные features могут загружаться отдельными lazy chunks; критический app shell доступен до их загрузки.
- **NFR-003.4** Immich originals и другие большие файлы по возможности передаются stream-ом с `Content-Length`, чтобы UI мог показывать progress.

## Проверка

Проверять cache/refresh в VPS domain, preview/original request в diary domain, lazy routes в frontend layer и progress передачу в Immich integration.
