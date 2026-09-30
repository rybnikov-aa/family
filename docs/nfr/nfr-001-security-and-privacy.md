# NFR-001: Безопасность и приватность

- **Статус:** действует
- **Область:** все API, учетные данные, пользовательские файлы и данные ремонта.
- **Источники:** `docs/layers/middleware.md`, `docs/domains/auth.md`, `docs/adr/adr-012-cookie-session-auth.md`, `docs/adr/adr-024-persisted-pdf-documents.md`, `docs/guardrails.md`.

## Требования

- **NFR-001.1** Все непубличные endpoint должны требовать действующую сессию; административные мутации должны проверять роль на backend независимо от состояния UI.
- **NFR-001.2** Пароли хранятся в виде scrypt hashes; session token хранится в БД только как SHA-256 hash. Cookie должна быть httpOnly, SameSite=Lax и Secure в production.
- **NFR-001.3** Immich API key не возвращается клиенту; вызовы внешнего Immich API выполняются backend proxy с server-side credentials.
- **NFR-001.4** Имена файлов и folder parameters проверяются против path traversal; файлы выдаются только через защищенные routes.
- **NFR-001.5** Upload endpoints проверяют тип и ограничивают размер/количество; PDF и изображения не сохраняются до предусмотренного доменом подтверждения.
- **NFR-001.6** В публичных материалах ремонта не публикуются идентифицирующие данные заказчика; реальные production credentials не попадают в source, logs, docs или user output.

## Проверка

Матрица доступа и cookie/security behavior — `docs/layers/api.md` и `docs/domains/auth.md`; файловые ограничения — `docs/layers/middleware.md` и domain specs; privacy gate — `docs/guardrails.md`.
