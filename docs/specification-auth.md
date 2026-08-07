# Спецификация модуля «Авторизация» (family)

| Поле          | Значение                                                                       |
| ------------- | ------------------------------------------------------------------------------ |
| Тип документа | Модульная спецификация (Specification Driven Development)                      |
| Модуль        | Авторизация (вход/выход, пользователи, роли, сессии)                           |
| Проект        | family.rybnikov.su — семейный портал (монорепозиторий: `frontend` + `backend`) |

---

## 0. Общие положения

Общие сведения о портале, архитектуре, конфигурации окружения (`.env`), темы/роутинге, решениях (ADR), ограничениях и полной карте файлов — в [docs/specification.md](specification.md); справочник API — в [docs/specification-api.md](specification-api.md). Здесь — только функциональная область **авторизации**.

---

## 1. Требования

**FR-11. Авторизация.**

- 11.1 Весь портал (SPA и API) закрыт входом: без действующей сессии фронтенд показывает экран входа, API отвечает 401.
- 11.2 Учётные записи: имя пользователя (`username`, уникальное), отображаемое имя (`name`), пароль, роль (`admin`/`user`). Пароли хранятся только как хэши scrypt (соль + constant-time сравнение).
- 11.3 Вход: `POST /api/auth/login` с `{username, password}`; при успехе сервер создаёт сессию и ставит httpOnly `SameSite=Lax` cookie (`Secure` — в проде).
- 11.4 Выход: `POST /api/auth/logout` удаляет сессию на сервере и cookie; после выхода доступ с тем же cookie — 401.
- 11.5 Текущий пользователь: `GET /api/auth/me` (`{user: {id, username, name, role}}`).
- 11.6 Роли: `user` — чтение портала; `admin` — дополнительно управление VPS (добавление/импорт/удаление) и загрузка PDF в проекты. Бэкенд проверяет роль (`403`), UI скрывает недоступные действия.
- 11.7 Срок жизни сессии — `SESSION_TTL_HOURS` (по умолчанию 168 ч = 7 суток); просроченные сессии удаляются при обращении.
- 11.8 Первый администратор создаётся при старте из env `AUTH_BOOTSTRAP_PASSWORD` (если в БД нет пользователей); дальнейшие учётки — CLI `npm run user -w backend` (add/list/set-role/remove).

**FR-12. Профиль пользователя.**

- 12.1 Любой авторизованный пользователь может изменить своё отображаемое имя (`name`) и/или задать/сменить пароль на отдельной странице «Профиль».
- 12.2 Смена пароля возможна только при подтверждении текущим паролем; новый пароль — не короче 6 символов.
- 12.3 Имя пользователя (`username`) и роль через профиль не меняются (роль — только CLI).

---

## 2. Данные (SQLite: `users` и `sessions`)

В той же БД, что и VPS (`backend/data/vps.sqlite`), хранятся таблицы авторизации (схема — `backend/src/db/database.ts`, создаются автоматически `CREATE TABLE IF NOT EXISTS`):

```sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'user', -- 'admin' | 'user'
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT    NOT NULL UNIQUE, -- SHA-256 от токена (сам токен в БД не храним)
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT    NOT NULL
);
```

**Наполнение.** Пользователи вручную SQL не наполняются:

- **Первый администратор** — bootstrap при старте из env `AUTH_BOOTSTRAP_PASSWORD`, если `users` пуста (имя/отображаемое имя — `AUTH_BOOTSTRAP_USERNAME`/`AUTH_BOOTSTRAP_NAME`). После первого входа переменную рекомендуется убрать.
- **Остальные учётки** — CLI `npm run user -w backend` (`backend/scripts/users.mjs`: `add <username> <name> <admin|user> [--password <пароль>]`, `list`, `set-role <username> <role>`, `remove <username>`). Скрипт использует тот же формат хэша scrypt, работает без сборки. На сервере доступен в `server/scripts/users.mjs` (входит в деплой); в неинтерактивной SSH-сессии запускать полным путём к node.

---

## 3. API модуля

Полный справочник API — в [docs/specification-api.md](specification-api.md) (раздел «Авторизация»). Эндпоинты модуля:

| Метод | Путь                | Назначение                            | Параметры                                                                                                 |
| ----- | ------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| POST  | `/api/auth/login`   | Вход (публичный)                      | Тело — `{username, password}`; ответ — `{user}`                                                           |
| POST  | `/api/auth/logout`  | Выход (авторизованным)                | —; ответ — 204                                                                                            |
| GET   | `/api/auth/me`      | Текущий пользователь (авторизованным) | —; ответ — `{user: {id, username, name, role}}`                                                           |
| PATCH | `/api/auth/profile` | Обновление профиля (авторизованным)   | Тело — `{name?, currentPassword?, password?}`; смена пароля — с `currentPassword`; ответ — `{user}` (200) |

**Матрица доступа и параметры сессии** (401 без сессии, 403 для не-`admin` на мутациях; cookie `sid` httpOnly `SameSite=Lax`, `Secure` в проде, scrypt) — в [docs/specification-api.md](specification-api.md), раздел «Авторизация API».

---

## 4. Бэкенд

- **`services/authService.ts`** — пользователи, хэширование scrypt (формат `scrypt$N$r$p$<salt>$<hash>`), сессии (создание/поиск/удаление, очистка просроченных), `ensureBootstrapAdmin()` (первый админ из `AUTH_BOOTSTRAP_PASSWORD` при пустой `users`).
- **`middlewares/auth.ts`** — `requireAuth` (401 без действующей сессии; читает cookie без cookie-parser), `requireAdmin` (403 для роли не `admin`); заполняют `req.user`.
- **`controllers/authController.ts`, `routes/auth.ts`** — вход/выход/текущий пользователь.
- **Применение:** `requireAuth` на роутах `/api/vps` и `/api/projects` (в `app.ts`), `requireAdmin` на мутациях VPS и загрузке PDF; `/api/health` и `POST /api/auth/login` — публичны; `ensureBootstrapAdmin()` вызывается при старте.
- **CLI:** `backend/scripts/users.mjs` (`npm run user -w backend`).

---

## 5. Фронтенд

Инвентарь хуков/компонентов/иконок — в общем разделе [docs/specification.md](specification.md). Относящиеся к модулю:

- **Контекст/хук:** `useAuth` (`hooks/useAuth.tsx`) — `{user, loading, login, logout}`; при старте проверяет сессию (`GET /api/auth/me`); на событие `auth:unauthorized` сбрасывает пользователя к экрану входа. `AuthProvider` оборачивает приложение в `main.tsx`.
- **Гейт:** `AuthGate` в `App.tsx` — пока сессия не подтверждена — `LoginPage`, иначе — приложение.
- **Экран входа:** `LoginPage` — карточка с формой (имя пользователя/пароль), сообщение об ошибке, переключатель темы.
- **API-клиент:** `apiFetch` в `api/client.ts` на 401 рассылает `auth:unauthorized`; `login()` событие не рассылает (401 там = неверные данные); функции `login`/`logout`/`fetchMe`.
- **Шапка:** блок пользователя с иконкой `UserIcon`, именем/ролью и кнопкой «Выйти» (`PageLayout.tsx`, классы `.user*`). Имя — ссылка на страницу «Профиль» (`ROUTES.profile`).
- **Страница профиля:** `ProfilePage` — карточка «Имя и учётные данные» (логин/роль read-only, редактирование `name`) и карточка «Пароль» (текущий + новый пароль, подтверждение текущим); сообщения об успехе/ошибке; после сохранения контекст `useAuth` обновляет пользователя.
- **Роль-гейты UI:** `user?.role === 'admin'` скрывает «+»/импорт/корзину VPS (`VpsDetailsModal`) и «Загрузить PDF» (`ProjectsPage`).
- **Иконки:** `LockIcon` (экран входа и карточка «Пароль»), `UserIcon` (карточка «Имя», страница профиля), `LogoutIcon` (кнопка «Выйти»).

### Поведение (UX)

- Без действующей сессии фронтенд показывает экран входа; вход с верными данными открывает портал, с неверными — понятная ошибка (401).
- Выход по кнопке «Выйти» в шапке удаляет сессию на сервере и cookie, приложение возвращается к экрану входа.
- При истечении сессии (любой 401 в API) пользователь автоматически возвращается к экрану входа.

---

## 6. Критерии приёмки

- 6.1 Без действующей сессии фронтенд показывает экран входа (`LoginPage`), API отвечает 401.
- 6.2 Вход с верными учётными данными открывает портал; с неверными — понятная ошибка (401), вход не выполняется.
- 6.3 Выход удаляет сессию на сервере и cookie; после выхода доступ с той же cookie — 401.
- 6.4 Пользователь с ролью `user` не видит админ-действий (добавление/импорт/удаление VPS, загрузка PDF) и получает 403 при прямом вызове API.
- 6.5 Пользователь с ролью `admin` видит и может выполнять админ-действия.
- 6.6 Сессия имеет срок жизни; после истечения пользователь возвращается к экрану входа (следующий запрос — 401).
- 6.7 Пользователь может изменить имя (`name`) в профиле; после сохранения новое имя отображается в шапке.
- 6.8 Пользователь может сменить пароль только с верным текущим паролем; новый пароль короче 6 символов или неверный текущий — отклоняются с понятной ошибкой (400).

---

## 7. Поведенческие сценарии (Given/When/Then)

**S16. Вход с верными учётными данными.**

- Given: на экране входа введены корректные username и password
- When: пользователь нажимает «Войти»
- Then: отправляется `POST /api/auth/login`, сервер ставит cookie сессии, открывается портал

**S17. Неверные учётные данные.**

- Given: на экране входа введены некорректные username/password
- When: пользователь нажимает «Войти»
- Then: сервер отвечает 401, на экране входа показывается ошибка, вход не выполняется

**S18. Выход.**

- Given: пользователь авторизован, в шапке есть кнопка «Выйти»
- When: пользователь нажимает «Выйти»
- Then: `POST /api/auth/logout` удаляет сессию, cookie очищается, приложение возвращается к экрану входа; доступ с прежней сессией — 401

**S19. Ограничение по ролям.**

- Given: пользователь с ролью `user` открывает портал
- Then: в UI нет админ-действий («+», импорт, корзина VPS, «Загрузить PDF»); прямой вызов мутирующего API (например `POST /api/vps`) → 403

**S20. Профиль: смена имени и пароля.**

- Given: пользователь авторизован, в шапке кликает на своё имя
- When: на странице «Профиль» меняет отображаемое имя и сохраняет
- Then: `PATCH /api/auth/profile` обновляет `name`, в шапке показывается новое имя
- And: при смене пароля с верным текущим паролем — пароль обновляется; с неверным текущим или коротким новым — понятная ошибка (400), пароль не меняется

---

## 8. Трассируемость требований модуля

| Требование        | Критерии приёмки | Реализация                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-11 Авторизация | §6               | `backend/services/authService.ts`, `backend/middlewares/auth.ts`, `backend/controllers/authController.ts`, `backend/routes/auth.ts`, `backend/db/database.ts`, `backend/scripts/users.mjs`, `frontend/hooks/useAuth.tsx`, `frontend/pages/LoginPage.tsx`, `frontend/App.tsx`, `frontend/main.tsx`, `frontend/api/client.ts`, `PageLayout.tsx`, `VpsDetailsModal.tsx`, `ProjectsPage.tsx`, `icons.tsx`, `index.css`                                          |
| FR-12 Профиль     | §6.7–6.8         | `backend/controllers/authController.ts` (`updateProfileController`), `backend/routes/auth.ts` (`PATCH /api/auth/profile`), `backend/services/authService.ts` (`updateUserProfile`), `frontend/pages/ProfilePage.tsx`, `frontend/routes.ts`, `frontend/App.tsx`, `frontend/hooks/useAuth.tsx` (`updateProfile`), `frontend/api/client.ts` (`updateProfile`), `frontend/components/PageLayout.tsx`, `frontend/components/icons.tsx` (`UserIcon`), `index.css` |

---

## 9. Управление пользователями (справка)

Команды CLI (локально, из корня репозитория):

```bash
npm run user -w backend -- add mama Мама user --password 'пароль'
npm run user -w backend -- add papa Папа admin
npm run user -w backend -- list
npm run user -w backend -- set-role mama admin
npm run user -w backend -- remove mama
```

На сервере (скрипт входит в деплой — `server/scripts/users.mjs`; в неинтерактивной SSH-сессии node не в PATH, поэтому полным путём):

```bash
cd /var/www/family.rybnikov.su/server
/home/rybnikov/.nvm/versions/node/v24.19.0/bin/node scripts/users.mjs add mama Мама user
```
