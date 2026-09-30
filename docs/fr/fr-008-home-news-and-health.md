# FR-008: Главная, новости и health status

- **Статус:** частично реализовано; news behavior владеет [FR-015](fr-015-news-management.md)
- **Акторы:** авторизованные пользователи.
- **Источники:** `frontend/src/pages/HomePage.tsx`, `NewsPage.tsx`, `backend/src/routes/health.ts`, [frontend layer](../layers/frontend.md), [API](../layers/api.md).

## Требования

- **FR-008.1** Главная показывает навигационные карточки к реализованным разделам и статусные метрики сервисов; карточка «Планы» ведёт на `#/plans`.
- **FR-008.2** Карточка фотоархива появляется только при настроенном Immich URL; адрес не хранится в frontend source.
- **FR-008.3** Новости доступны отдельным route с датой, тегом, заголовком и текстом; CRUD, публикация и read-receipts описаны в [FR-015](fr-015-news-management.md).
- **FR-008.4** Публичный `GET /api/health` возвращает health/runtime status и используется UI для отображения состояния backend.
- **FR-008.5** Авторизованный пользователь может переключать тему light/dark/system; выбранный режим хранится в клиентском `localStorage`.

## Проверяемость

Маршруты, карточки главной, статическая лента новостей и health endpoint проверяются
по [frontend layer](../layers/frontend.md), [API](../layers/api.md) и критериям CJ-001.
