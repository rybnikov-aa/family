# Сервер: ключевые пути и конфигурация

Справочник по размещению файлов веб-приложения и настроек nginx.

- **Основной хост — `my.rybnikov.su`** (данные мигрированы с прежнего хоста 2026-08-16; прежний домен `family.rybnikov.su` настроен редиректом на `my.rybnikov.su`).
- **Тестовый хост — `test.rybnikov.su`** (отдельный инстанс `family-backend-test` на порту 3001).
- **Конфигурация основного и тестового серверов синхронизируется** (правило 14 в AGENTS.md): любые правки конфигурации применяются к **обоим** хостам; отличия допустимы только по назначению (порт, домен, пути, имя pm2-приложения).

---

## 1. Основной хост: my.rybnikov.su

### 1.1. Веб-приложение

| Что                                           | Путь на сервере                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Фронтенд (статик-файлы, сборка Vite)          | `/var/www/my.rybnikov.su/public_html`                                                     |
| Бэкенд (Express, рантайм + `node_modules`)    | `/var/www/my.rybnikov.su/server`                                                          |
| SQLite-база VPS (runtime, не в git)           | `/var/www/my.rybnikov.su/server/data/vps.sqlite`                                          |
| БД авторизации (users/sessions, runtime)      | `/var/www/my.rybnikov.su/server/data/auth.sqlite`                                         |
| БД прикладных проектов (runtime, не в git)    | `/var/www/my.rybnikov.su/server/data/projects.sqlite`                                     |
| БД «Ремонта» (runtime, не в git)              | `/var/www/my.rybnikov.su/server/data/renovation.sqlite`                                   |
| БД «Дневника» (runtime, не в git)             | `/var/www/my.rybnikov.su/server/data/diary.sqlite`                                        |
| Загруженные PDF «Ремонта» (runtime, не в git) | `/var/www/my.rybnikov.su/server/docs/renovation/` (в т.ч. подпапки `design/` и `legacy/`) |
| Изображения событий «Дневника» (runtime)      | `/var/www/my.rybnikov.su/server/images/<folder>/` (уникальная папка на событие)           |

- Бэкенд слушает `127.0.0.1:3000` (не публичный порт), доступен только через nginx-прокси `/api/`.
- Процесс бэкенда управляется **pm2**, имя приложения: `family-backend`. На хосте других бэкенд-приложений нет.
- **pm2 и стабильный `PM2_HOME`:** Windows-клиент OpenSSH шлёт на сервер `HOME=C:Usersalex`, поэтому для устойчивости задан абсолютный `PM2_HOME=/home/rybnikov/.pm2` (в деплое — через `DEPLOY_PM2_HOME`). Ручное управление: `export PM2_HOME=/home/rybnikov/.pm2; pm2 ...`. Без `PM2_HOME` демон резолвится относительно CWD и нестабилен (деплой делает `start` вместо `restart`, возможен конфликт портов).
- **Автозапуск pm2 при загрузке** — включён на **обоих** хостах: systemd-юнит `pm2-rybnikov.service` (`pm2 startup systemd -u rybnikov --hp /home/rybnikov` + `pm2 save`). После перезагрузки сервера `family-backend`/`family-backend-test` поднимаются автоматически (проверено перезагрузкой 2026-08-16).
- **SQLite-база VPS** (`server/data/vps.sqlite`) — runtime-данные, наполняется через форму добавления VPS в UI (`POST /api/vps`), импорт из JSON (`POST /api/vps/import`), удаление — кнопка-корзина (`DELETE /api/vps/:name`). Путь — `DB_PATH` (по умолчанию `data/vps.sqlite`). Каждый домен — в своей БД: авторизация (`users`/`sessions`) — `server/data/auth.sqlite` (`AUTH_DB_PATH`), прикладные проекты (`projects`) — `server/data/projects.sqlite` (`PROJECTS_DB_PATH`), «Ремонт» — `server/data/renovation.sqlite`, «Дневник» — `server/data/diary.sqlite`. При деплое папки `data/`, `docs/`, `images/` и файл `.env` **не удаляются**.
- **Авторизация** — весь портал (SPA и API) закрыт входом: без действующей сессии API отвечает 401, фронтенд показывает экран входа. Вход/выход/текущий пользователь — `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. Сессия — httpOnly `SameSite=Lax` cookie `sid` (в проде `Secure`), в БД хранится только SHA-256 от токена; срок жизни — `SESSION_TTL_HOURS`. Роли: `admin` (управление VPS + создание проектов) и `user` (чтение). **Первый администратор** создаётся при старте из `AUTH_BOOTSTRAP_PASSWORD` (если в БД нет пользователей); дальнейшие учётки — CLI `npm run user -w backend` (`add`/`list`/`set-role`/`remove`). Скрипт `scripts/users.mjs` входит в деплой, поэтому на сервере его можно запускать прямо из каталога бэкенда. `/api/health` остаётся публичным (для диагностики).
- Для диагностики API, требующего авторизации, в curl нужна cookie сессии: `curl -c ck -X POST http://127.0.0.1:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"…","password":"…"}'`, затем `curl -b ck http://127.0.0.1:3000/api/vps`.

**Управление пользователями на сервере:**

- CLI `server/scripts/users.mjs` (из `backend/scripts/`) входит в деплой — работает прямо на сервере из каталога бэкенда.
- В неинтерактивной SSH-сессии `node`/`pm2` не в PATH на части хостов — использовать полный путь (на основном хосте node в `/usr/bin/node`, pm2 в `/usr/bin/pm2`).
- Примеры (из `/var/www/my.rybnikov.su/server`):
  ```bash
  node scripts/users.mjs add mama Мама user
  node scripts/users.mjs list
  node scripts/users.mjs set-role mama admin
  node scripts/users.mjs remove mama
  ```
- Пароль запрашивается интерактивно (не эхонируется) либо через `--password <пароль>`.
- Первый администратор: `AUTH_BOOTSTRAP_PASSWORD` в `server/.env` → создаётся при рестарте, если таблица `users` пуста; после входа переменную убрать.

**Проекты (раздел «Проекты»):** проект — запись в БД `projects` (созданные через UI) либо встроенный проект из реестра бэкенда (`config/appProjects.ts`, например «Ремонт»). Список отдаёт `GET /api/projects` (реестр + БД, без сканирования файловой системы). Страницы проектов — маршруты приложения (`#/projects/<slug>`), наследуют тему и стиль приложения. Создание/изменение/удаление — через UI (admin) → `POST`/`PATCH`/`DELETE /api/projects`; бэкенд пишет в БД (метаданные + markdown-контент), файлов и папок не создаёт. Встроенные проекты (реестр) редактировать/удалять нельзя.

### 1.2. Файл `.env` бэкенда (`server/.env`)

Конфигурация рантайма, при деплое **сохраняется** (не перезаписывается и не удаляется). Переменные:

- `PORT` — порт API (по умолчанию `3000`);
- `NODE_ENV` — в проде `production` (задаётся скриптом деплоя);
- `CORS_ORIGIN` — в проде `https://my.rybnikov.su`;
- `DB_PATH`, `AUTH_DB_PATH`, `PROJECTS_DB_PATH` — пути к БД (по умолчанию `data/*.sqlite`);
- `AUTH_COOKIE_NAME` — имя cookie сессии (по умолчанию `sid`); `SESSION_TTL_HOURS` — срок жизни сессии (по умолчанию `168`);
- `AUTH_BOOTSTRAP_PASSWORD` (+ `AUTH_BOOTSTRAP_USERNAME`/`AUTH_BOOTSTRAP_NAME`) — первый администратор;
- Модуль «Ремонт»: `RENOVATION_DB_PATH` (`data/renovation.sqlite`), `RENOVATION_DOCS_DIR` (`docs/renovation` → `server/docs/renovation`, сохраняется при деплое), `RENOVATION_PYTHON`, `RENOVATION_EXTRACT_SCRIPT`;
- «Дневник»: `DIARY_DB_PATH` (`data/diary.sqlite`), `DIARY_IMAGES_DIR` (`images` → `server/images`, сохраняется при деплое).

**Импорт PDF («Ремонт», этап 3):** парсер — `pdfplumber` (Python), Node-бэкенд запускает `server/scripts/extract_pdf.py` как subprocess. Деплой готовит сервер автоматически (шаг «pdf setup», отключается `--no-pdf-setup` или `DEPLOY_PDF_SETUP=0`), но **на новых хостах** из-за грабли `HOME` (см. §1.4) venv ставится вручную: `export HOME=/home/rybnikov; python3 -m venv /home/rybnikov/renov-venv; /home/rybnikov/renov-venv/bin/pip install pdfplumber`, затем в `server/.env`: `RENOVATION_PYTHON=/home/rybnikov/renov-venv/bin/python`, `RENOVATION_EXTRACT_SCRIPT=/var/www/my.rybnikov.su/server/scripts/extract_pdf.py`. Скрипт `extract_pdf.py` входит в деплой вместе с `backend/scripts/`.

**После правки `server/.env` перезапустить бэкенд.** Деплой делает это сам обычным `pm2 restart` (без `--update-env` — dotenv при старте перечитывает `.env`). Вне деплоя:

```bash
export PM2_HOME=/home/rybnikov/.pm2
pm2 restart family-backend
```

Проверка: `curl -s http://127.0.0.1:3000/api/health` (200).

### 1.3. Nginx

| Что                                | Путь на сервере                                |
| ---------------------------------- | ---------------------------------------------- |
| Конфиг vhost (основной)            | `/etc/nginx/sites-available/my.rybnikov.su`    |
| Конфиг редиректов                  | `/etc/nginx/sites-available/redirect-rybnikov` |
| SSL (letsencrypt)                  | `/etc/letsencrypt/live/my.rybnikov.su/`        |
| SSL (family.rybnikov.su, редирект) | `/etc/letsencrypt/live/family.rybnikov.su/`    |
| Access-лог                         | `/var/log/nginx/my.rybnikov.su_access.log`     |
| Error-лог                          | `/var/log/nginx/my.rybnikov.su_error.log`      |

- Vhost включается симлинком в `/etc/nginx/sites-enabled/`. После правки: `sudo nginx -t && sudo systemctl reload nginx`.
- **MIME-тип `.mjs`** — обязателен для pdf.js-воркера (сборка Vite отдаёт `pdf.worker.min-*.mjs`, подгружаемый динамическим `import()`). На **обоих** хостах (основной и тестовый) в `/etc/nginx/mime.types` добавлено `application/javascript mjs;` (бэкап `.bak`) — при пересборке/переустановке nginx проверять, что `mjs` снова на месте.
- `location /api/` — прокси на бэкенд: `proxy_pass http://127.0.0.1:3000;` — **без** завершающего слэша (иначе срезается `/api` → 404).
- Для загрузки фото «Дневника» и импорта PDF в «Ремонт» в `location /api/` задан `client_max_body_size 100m`.
- `http → https` (порт 80 → 301) для основного хоста и редиректов — настроено.

**Конфиг vhost `my.rybnikov.su`** (фактический на сервере):

```nginx
server {
    listen 80;
    server_name my.rybnikov.su;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name my.rybnikov.su;
    root /var/www/my.rybnikov.su/public_html;
    index index.html index.htm;

    ssl_certificate /etc/letsencrypt/live/my.rybnikov.su/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/my.rybnikov.su/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    location / {
        try_files $uri $uri/ =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        client_max_body_size 100m;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    access_log /var/log/nginx/my.rybnikov.su_access.log;
    error_log /var/log/nginx/my.rybnikov.su_error.log;
}
```

**Редиректы старых доменов** (`redirect-rybnikov`): `family.rybnikov.su` (CNAME на `my.rybnikov.su` — активен) и `rybnikov.su` → `https://my.rybnikov.su`; порт 80 и (для family.rybnikov.su) 443 с letsencrypt-сертификатом:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name family.rybnikov.su rybnikov.su www.family.rybnikov.su www.rybnikov.su;

    location /.well-known/acme-challenge/ {
        root /var/www/my.rybnikov.su/public_html;
    }
    location / {
        return 301 https://my.rybnikov.su$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name family.rybnikov.su www.family.rybnikov.su;
    ssl_certificate /etc/letsencrypt/live/family.rybnikov.su/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/family.rybnikov.su/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    return 301 https://my.rybnikov.su$request_uri;
}
```

> Для `rybnikov.su` 443-блок не настроен: домен пока резолвится не на этот сервер. После перевода DNS и получения сертификата добавить блок аналогично family.rybnikov.su (в конфиге на сервере оставлен закомментированный пример).

### 1.4. Грабли: Windows OpenSSH передаёт на сервер `HOME=C:Usersalex`

- ssh из Windows-окружения всегда шлёт локальный `HOME=C:Usersalex` → на сервере `$HOME/...`/`~/...` резолвятся **относительно CWD**.
- **Фикс:** в `deploy.mjs` поддержан `DEPLOY_PM2_HOME` (remote-скрипт делает `export PM2_HOME=...`). Задавать абсолютный `DEPLOY_PM2_HOME=/home/rybnikov/.pm2` — тогда демон pm2 стабилен. Без него `PM2_HOME=$CWD/C:Usersalex/.pm2`, демон нестабилен (деплой делает `start` вместо `restart`, возможен конфликт портов).
- `NODE_ENV=production` хранится в env приложения pm2 (задаётся при `pm2 start`), обычный `pm2 restart` его сохраняет. Запуск без `NODE_ENV=production` → процесс online, но порт не слушается (гейт `app.listen` в `backend/src/app.ts`).
- pdf-setup деплоя на новых хостах создаёт venv по битому пути `$SERVER/C:Usersalex/renov-venv` → использовать `--no-pdf-setup` и ставить venv вручную (см. §1.2).

### 1.5. Исторический прямой деплой (конфигурация)

Для обычной публикации используется `npm run pipeline`: прямой `npm run deploy` не является
штатным способом выпуска и оставлен для истории, диагностики и ручных специальных случаев.

Параметры деплоя задаются в корневом `.env` (читает `scripts/deploy.mjs`; шаблон — `.env.example`). **Файл обязателен**: без него скрипт использует дефолт `DEPLOY_USER=root`, тогда как хост деплоится под пользователем `rybnikov`. Рабочая конфигурация основного хоста:

```bash
DEPLOY_HOST=my.rybnikov.su
DEPLOY_USER=rybnikov
DEPLOY_PORT=22
DEPLOY_FRONTEND_DIR=/var/www/my.rybnikov.su/public_html
DEPLOY_BACKEND_DIR=/var/www/my.rybnikov.su/server
DEPLOY_PM2_APP=family-backend
DEPLOY_PM2_HOME=/home/rybnikov/.pm2
DEPLOY_PDF_SETUP=0
```

---

## 2. Дополнительный (тестовый) хост: test.rybnikov.su

### 2.1. Пошаговая публикация

Для публикации через тестовый сервер используется `npm run pipeline`. Скрипт сначала выполняет
обычный деплой на `test.rybnikov.su`, затем останавливает его pm2-приложение, очищает `data/` и
распаковывает туда архив с основного сервера. После перезапуска выполняются sanity-тесты
`/api/health`, вход, `/api/auth/me`, `/api/projects`, `/api/vps`, `/api/renovation` и `/api/diary`.
Основной сервер обновляется только при успешном завершении всех этих шагов.

```powershell
npm run pipeline
```

Перед sanity pipeline создаёт на тестовом сервере временных пользователей `test` (`admin`,
`test123456`) и `user` (`user`, `user123456`). Тесты выполняются под обоими пользователями,
после чего записи удаляются. Для переопределения используются `PIPELINE_TEST_ADMIN_*` и
`PIPELINE_TEST_USER_*`; пароли не обязательны в `.env` и могут быть переданы только окружением.

По умолчанию синхронизируется только `server/data/`, включая SQLite-файлы `-wal` и `-shm`.
Опциональные загруженные файлы (`server/docs/` и `server/images/`) копируются при
`PIPELINE_SYNC_FILES=1`. Пароль не хранится в репозитории.

#### Состав sanity-тестов

`scripts/sanity-test.mjs` выполняет 7 read-only проверок на тестовом URL под каждым из двух
пользователей: `test` проверяет административную учётку, `user` — обычную роль. Итого pipeline
выполняет 14 проверок.

1. `GET /api/health` имеет успешный HTTP-статус и `status: "ok"`.
2. В health-ответе окружение равно `production`.
3. `POST /api/auth/login` с переданными pipeline credentials завершается успешно.
4. Login возвращает ожидаемого пользователя и cookie сессии.
5. `GET /api/auth/me` с этой cookie возвращает того же пользователя.
6. `GET /api/projects`, `GET /api/vps` и `GET /api/diary` с авторизацией возвращают массивы.
7. `GET /api/renovation` с авторизацией возвращает объект.

При любом сетевом сбое, статусе не `2xx`, отсутствии cookie или несоответствии формата команда
завершается с ненулевым кодом. В этом случае шаг публикации на `my.rybnikov.su` не запускается.

| Что               | Путь на сервере                                  |
| ----------------- | ------------------------------------------------ |
| Конфиг vhost      | `/etc/nginx/sites-available/test.rybnikov.su`    |
| SSL (letsencrypt) | `/etc/letsencrypt/live/test.rybnikov.su/`        |
| Фронтенд/бэкенд   | `/var/www/test.rybnikov.su/{public_html,server}` |

- Сервер `31.76.227.98`, пользователь `rybnikov` (passwordless `sudo`), node v24.18.1 `/usr/bin/node`, pm2 7.0.3 `/usr/bin/pm2`, CPU E5-2697 v4 (AVX2).
- **Только одно бэкенд-приложение — `family-backend-test`** на `127.0.0.1:3001` (`server/.env`: `PORT=3001`, `CORS_ORIGIN=https://test.rybnikov.su`). nginx `location /api/` → `proxy_pass http://127.0.0.1:3001;` (+ `client_max_body_size 100m`, фикс mime `.mjs` — как на основном).
- **Автозапуск pm2 включён** (2026-08-16, `pm2-rybnikov.service` + `pm2 save`): после перезагрузки `family-backend-test` поднимается автоматически (проверено перезагрузкой 2026-08-16). Инстанс — один (дубли удалены).
- **Данные «аналогичны» основному** (синхронизированы 2026-08-16): `data/` (5 БД), `docs/` (PDF «Ремонта»), `images/` (фото «Дневника») скопированы с `my.rybnikov.su`; содержимое БД (пользователи, VPS, «Ремонт», «Дневник») совпадает с основным. Учётка `admin` в БД есть; вход — заново.
- **venv PDF-импорта:** `/home/rybnikov/renov-venv` (на этом хосте собран на Python 3.8; `pdfplumber` установлен и работает) — путь `RENOVATION_PYTHON` в `server/.env`.
- **Прежний тестовый инстанс удалён** (2026-08-16): в `/var/www` остался только `test.rybnikov.su` (прежний тестовый каталог и дефолтный `/var/www/html` удалены).
- Деплой (переменные окружения, приоритетнее `.env`):
  ```powershell
  $env:DEPLOY_HOST = "test.rybnikov.su"; $env:DEPLOY_USER = "rybnikov"
  $env:DEPLOY_FRONTEND_DIR = "/var/www/test.rybnikov.su/public_html"
  $env:DEPLOY_BACKEND_DIR = "/var/www/test.rybnikov.su/server"
  $env:DEPLOY_PM2_APP = "family-backend-test"; $env:DEPLOY_PM2_HOME = "/home/rybnikov/.pm2"
  npm run deploy -- --no-pdf-setup
  ```
- Предупреждение: в `location /api/` НЕ ставить завершающий слэш у `proxy_pass` (см. §1.3).

---

## 3. Полезные команды для диагностики

```bash
# Проверка конфига nginx и перезагрузка
sudo nginx -t && sudo systemctl reload nginx

# Бэкенд слушает 3000? (тестовый хост — 3001)
ss -ltnp | grep 3000

# Health-чек напрямую (минуя nginx)
curl -i http://127.0.0.1:3000/api/health

# pm2 (стабильный PM2_HOME)
export PM2_HOME=/home/rybnikov/.pm2
pm2 ls
pm2 logs family-backend --lines 50 --nostream
pm2 describe family-backend

# Health через домен
curl -i https://my.rybnikov.su/api/health
curl -i https://test.rybnikov.su/api/health
```
