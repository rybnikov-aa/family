# FR-001: Аутентификация и сессии

- **Статус:** реализовано
- **Область:** весь портал, кроме явно публичных endpoint.
- **Источники:** [domain auth](../domains/auth.md), [middleware](../layers/middleware.md), [API](../layers/api.md).

## Требования

- **FR-001.1** Приложение должно проверять сессию при открытии SPA; при загрузке показывать промежуточное состояние, при отсутствии действующей сессии — экран входа.
- **FR-001.2** `POST /api/auth/login` должен принимать username/password; успех устанавливает httpOnly cookie-сессию, неверные credentials возвращают 401.
- **FR-001.3** Все API, кроме health и login, должны требовать действующую сессию и возвращать 401 при ее отсутствии/истечении.
- **FR-001.4** Пароли должны хэшироваться scrypt; в БД хранится SHA-256 hash session token, cookie использует `SameSite=Lax` и `Secure` в production.
- **FR-001.5** Срок сессии задается `SESSION_TTL_HOURS` (default 168); logout удаляет сессию.
- **FR-001.6** Роль `user` дает чтение; административные мутации защищаются backend-проверкой `requireAdmin` и дают 403 без роли admin.

## Проверяемость

Login/logout/me/profile и точная матрица доступа — [API](../layers/api.md); поведение учетных записей — [auth domain](../domains/auth.md).
