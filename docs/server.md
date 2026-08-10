# VPS: ключевые пути на сервере

Справочник по размещению файлов веб-приложения и настроек nginx на сервере.
Актуально для хоста **family.rybnikov.su** (и второго хоста **itg-ru-gw.rybnikov.su**).

---

## 1. Веб-приложение

| Что                                            | Путь на сервере                                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Фронтенд (статик-файлы, сборка Vite)           | `/var/www/family.rybnikov.su/public_html`                                                     |
| Бэкенд (Express, рантайм + `node_modules`)     | `/var/www/family.rybnikov.su/server`                                                          |
| SQLite-база VPS и проектов (runtime, не в git) | `/var/www/family.rybnikov.su/server/data/vps.sqlite`                                          |
| БД «Ремонта» (runtime, не в git)               | `/var/www/family.rybnikov.su/server/data/renovation.sqlite`                                   |
| Загруженные PDF «Ремонта» (runtime, не в git)  | `/var/www/family.rybnikov.su/server/docs/renovation/` (в т.ч. подпапки `design/` и `legacy/`) |

- Бэкенд слушает `127.0.0.1:3000` (не публичный порт), доступен только через nginx-прокси `/api/`.
- Процесс бэкенда управляется **pm2**, имя приложения: `family-backend`.
  - pm2 не в PATH в неинтерактивной сессии, полный путь:
    `/home/rybnikov/.nvm/versions/node/v24.19.0/bin/pm2`
- **SQLite-база VPS** (`server/data/vps.sqlite`) — runtime-данные, наполняется вручную (SQL/клиентом) **или через форму добавления VPS в UI** (`POST /api/vps`), импорт из JSON (`POST /api/vps/import`), удаление — кнопка-корзина в детализации (`DELETE /api/vps/:name`). Путь задаётся через `DB_PATH` (по умолчанию `data/vps.sqlite`). При деплое папки `data/` и `docs/` **не удаляются** (как и `.env`); схема таблиц создаётся автоматически при первом обращении. В той же БД — таблицы авторизации `users` и `sessions` (см. ниже).
- **Авторизация** — весь портал (SPA и API) закрыт входом: без действующей сессии API отвечает 401, фронтенд показывает экран входа. Вход/выход/текущий пользователь — `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. Сессия — httpOnly `SameSite=Lax` cookie `sid` (в проде `Secure`), в БД хранится только SHA-256 от токена; срок жизни — `SESSION_TTL_HOURS`. Роли: `admin` (управление VPS + создание проектов) и `user` (чтение). **Первый администратор** создаётся при старте из `AUTH_BOOTSTRAP_PASSWORD` (если в БД нет пользователей); дальнейшие учётки — CLI `npm run user -w backend` (`add`/`list`/`set-role`/`remove`), он пишет в ту же БД и использует тот же формат хэша scrypt. Скрипт `scripts/users.mjs` входит в деплой, поэтому на сервере его можно запускать прямо из каталога бэкенда: `cd /var/www/family.rybnikov.su/server && node scripts/users.mjs add <username> <name> <role>`. `/api/health` остаётся публичным (для диагностики). Статичный архив «Ремонта» (`/projects/**`) удалён с сервера — все документы доступны только в приложении под авторизацией (модалки + `GET /api/renovation/docs/...`).
- Для диагностики API, требующего авторизации, в curl нужна cookie сессии: `curl -c ck -X POST http://127.0.0.1:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"…","password":"…"}'`, затем `curl -b ck http://127.0.0.1:3000/api/vps`.

**Управление пользователями на сервере:**

- CLI `server/scripts/users.mjs` (из `backend/scripts/`) входит в деплой — работает прямо на сервере из каталога бэкенда.
- В неинтерактивной SSH-сессии `node` нет в PATH — запускать полным путём: `/home/rybnikov/.nvm/versions/node/v24.19.0/bin/node`.
- Примеры (из `/var/www/family.rybnikov.su/server`):
  ```bash
  /home/rybnikov/.nvm/versions/node/v24.19.0/bin/node scripts/users.mjs add mama Мама user
  /home/rybnikov/.nvm/versions/node/v24.19.0/bin/node scripts/users.mjs list
  /home/rybnikov/.nvm/versions/node/v24.19.0/bin/node scripts/users.mjs set-role mama admin
  /home/rybnikov/.nvm/versions/node/v24.19.0/bin/node scripts/users.mjs remove mama
  ```
- Пароль запрашивается интерактивно (не эхонируется) либо через `--password <пароль>`.
- Первый администратор: `AUTH_BOOTSTRAP_PASSWORD` в `server/.env` → создаётся при рестарте, если таблица `users` пуста; после входа переменную убрать.
- **Проекты (раздел «Проекты»):** проект — запись в БД `projects` (созданные через UI) либо встроенный проект из реестра бэкенда (`config/appProjects.ts`, например «Ремонт»). Список отдаёт `GET /api/projects` (реестр + БД, без сканирования файловой системы). Страницы проектов — маршруты приложения (`#/projects/<slug>`), наследуют тему и стиль приложения.
- **Создание/изменение/удаление проектов** — через UI (страница «Проекты», admin) → `POST`/`PATCH`/`DELETE /api/projects`; бэкенд пишет в БД `projects` (метаданные + markdown-контент), файлов и папок не создаёт. Созданный проект сразу появляется в `GET /api/projects` и открывается по `#/projects/<slug>`. Встроенные проекты (реестр) редактировать/удалять нельзя.
- **Файл `.env` бэкенда** (`server/.env`) — конфигурация рантайма, при деплое **сохраняется** (не перезаписывается и не удаляется). Переменные:
  - `PORT` — порт API (по умолчанию `3000`);
  - `NODE_ENV` — в проде `production` (задаётся скриптом деплоя);
  - `CORS_ORIGIN` — в проде `https://family.rybnikov.su`;
  - `DB_PATH` — путь к SQLite-базе (по умолчанию `data/vps.sqlite`; в той же БД — таблица `projects`);
  - `AUTH_COOKIE_NAME` — имя cookie сессии (по умолчанию `sid`);
  - `SESSION_TTL_HOURS` — срок жизни сессии в часах (по умолчанию `168` = 7 суток);
  - `AUTH_BOOTSTRAP_PASSWORD` — пароль первого администратора (создаётся при старте, если в БД нет пользователей); после первого входа переменную можно убрать. Дополнительно: `AUTH_BOOTSTRAP_USERNAME` (`admin`), `AUTH_BOOTSTRAP_NAME` (`Администратор`).
  - Модуль «Ремонт»: `RENOVATION_DB_PATH` (по умолчанию `data/renovation.sqlite` — отдельная БД, сохраняется в `data/`), `RENOVATION_DOCS_DIR` (по умолчанию `docs/renovation` относительно CWD бэкенда → `server/docs/renovation`; каталог **сохраняется при деплое**, как `data/`), `RENOVATION_PYTHON` и `RENOVATION_EXTRACT_SCRIPT` (импорт PDF, этап 3).
  - **Загруженные PDF** («Ремонт», импорт): при подтверждении импорта файл кладётся в `RENOVATION_DOCS_DIR` (на сервере — `server/docs/renovation/`, имя `material_order_2026-07-17.pdf` и т.п.), в БД пишется `pdf_path = /api/renovation/docs/<file>`. Раздаёт их бэкенд (`GET /api/renovation/docs/:file`, под авторизацией); просмотр на фронте — pdf.js (`PdfViewerModal`). Существующие PDF со статичного архива (`public_html/projects/renovation/pdf/`) перенесены в `server/docs/renovation/` (смета — `estimate.pdf`, доп. соглашения — `addendum_<дата>_<id>.pdf`, остальное — по правилам `pdfFileName`), их `pdf_path` переписан на `/api/renovation/docs/...`. **Документы дизайн-проекта** — подпапка `server/docs/renovation/design/` (список — `GET /api/renovation/design`, раздача — `GET /api/renovation/docs/design/:file`); кнопка «Дизайн-проект» на странице «Ремонт» открывает модалку со списком, по клику — встроенный просмотрщик.

  **Импорт PDF («Ремонт», этап 3):** парсер — `pdfplumber` (Python), Node-бэкенд запускает
  `server/scripts/extract_pdf.py` как subprocess. **Деплой готовит сервер автоматически**
  (шаг «pdf setup», отключается `--no-pdf-setup` или `DEPLOY_PDF_SETUP=0`): ставит
  `python3-venv` (через passwordless sudo, если нет `ensurepip`), создаёт `~/renov-venv`
  с pdfplumber и дописывает `RENOVATION_PYTHON`/`RENOVATION_EXTRACT_SCRIPT` в `server/.env`
  (создавая файл, если его нет). Идемпотентно и не роняет деплой при сбое. **Версия pdfplumber:**
  если последняя не ставится (на Python 3.8 последняя требует Pillow>=12 → нужен Python>=3.9),
  деплой откатывается на `pdfplumber==0.11.0` (совместима с 3.8) и предупреждает. Ручная
  настройка (если деплой шёл с `--no-pdf-setup`): `python3 -m venv ~/renov-venv && ~/renov-venv/bin/pip install pdfplumber`,
  затем в `server/.env`: `RENOVATION_PYTHON=/home/rybnikov/renov-venv/bin/python`,
  `RENOVATION_EXTRACT_SCRIPT=/var/www/family.rybnikov.su/server/scripts/extract_pdf.py`.
  Скрипт `extract_pdf.py` входит в деплой вместе с `backend/scripts/`. Дефолт python в
  приложении платформозависимый (Windows — `../.venv/Scripts/python.exe`, Debian/Ubuntu —
  `../.venv/bin/python`), поэтому на сервере путь задаётся явно через `RENOVATION_PYTHON`.
  Если на сервере нет `python3-venv` — поставить: `sudo apt-get install -y python3.13-venv`
  (у `rybnikov` passwordless sudo), затем создать venv заново.

  **После правки `server/.env` перезапустить бэкенд.** Деплой делает это сам обычным
  `pm2 restart` (без `--update-env` — dotenv при старте перечитывает `.env`). Вне деплоя в
  неинтерактивной SSH-сессии `node` не в PATH, поэтому `pm2 restart family-backend --update-env`
  падает с `env: 'node': No such file or directory` (рестарт не происходит). Правильно — с node
  в PATH и обычным рестартом:

  ```bash
  export PATH="/home/rybnikov/.nvm/versions/node/v24.19.0/bin:$PATH"
  /home/rybnikov/.nvm/versions/node/v24.19.0/bin/pm2 restart family-backend
  ```

  Проверка, что переменные подхватились: `curl -s http://127.0.0.1:3000/api/health` (200) и
  повторный `POST /api/renovation/pdf` (не «extract_pdf.py: …python: can't find…»).

  **Инициализация БД «Ремонта» на сервере** — штатная, через приложение: импорт PDF (admin,
  `POST /api/renovation/pdf` → черновик → подтверждение). Seed из HTML упразднён
  (`seed-renovation.mjs`, `--seed-renovation` и `server/renovation-source/` удалены); повторная
  инициализация с нуля — только загрузкой PDF-документов в приложение.

  Корневой `.env` (репозиторий) — это **другое** пространство переменных: только конфигурация деплоя (`DEPLOY_*`) для `scripts/deploy.mjs`.

- Параметры деплоя задаются в корневом `.env` (читает `scripts/deploy.mjs`; шаблон — `.env.example`). **Файл обязателен**: без него скрипт использует дефолт `DEPLOY_USER=root`, тогда как основной хост деплоится под пользователем `rybnikov` (SSH-ключ; pm2 живёт под `/home/rybnikov/.nvm/...`) — подключение под `root` провалится. Рабочая конфигурация основного хоста:

```bash
DEPLOY_HOST=family.rybnikov.su
DEPLOY_USER=rybnikov
DEPLOY_PORT=22
DEPLOY_FRONTEND_DIR=/var/www/family.rybnikov.su/public_html
DEPLOY_BACKEND_DIR=/var/www/family.rybnikov.su/server
DEPLOY_PM2_APP=family-backend
```

---

## 2. Nginx

| Что                               | Путь на сервере                                 |
| --------------------------------- | ----------------------------------------------- |
| Конфиг vhost (family.rybnikov.su) | `/etc/nginx/sites-available/family.rybnikov.su` |
| Полный конфиг (в репозитории)     | `docs/server.md` (раздел 2)                     |
| Access-лог                        | `/var/log/nginx/family.rybnikov.su_access.log`  |
| Error-лог                         | `/var/log/nginx/family.rybnikov.su_error.log`   |

- Vhost включается симлинком в `/etc/nginx/sites-enabled/`.
- После переноса/правки конфига проверять:
  ```bash
  sudo nginx -t && sudo systemctl reload nginx
  ```

### Структура конфига (основные блоки)

- `location /` — раздача статики фронтенда (`try_files $uri $uri/ =404`).
- **MIME-тип `.mjs`** — обязателен для pdf.js-воркера (сборка Vite отдаёт `pdf.worker.min-*.mjs`,
  который подгружается динамическим `import()`; если `.mjs` отдаётся как
  `application/octet-stream` — браузер отклоняет модуль с ошибкой
  «Setting up fake worker failed: Failed to fetch dynamically imported module»). В
  `/etc/nginx/mime.types` добавлено `application/javascript mjs;` (рядом с `js;`) — при
  пересборке/переустановке nginx проверять, что `mjs` снова на месте.
- `location /api/` — прокси на бэкенд:
  `proxy_pass http://127.0.0.1:3000;` — **без** завершающего слэша (иначе срезается `/api` → 404).
- Для импорта PDF в «Ремонт» (`POST /api/renovation/pdf`) в `location /api/` задан `client_max_body_size 20m` (дефолт nginx — 1 МБ, без этого загрузка упадёт с 413).
- Редирект старого адреса проекта «Ремонт»: `location ^~ /renovation/` → `return 301 /projects$request_uri` (путь после `/renovation/` сохраняется, напр. `/renovation/estimate.html` → `/projects/renovation/estimate.html`); `location = /renovation` → `return 301 /projects/renovation/` — старые ссылки/закладки на `/renovation/...` не ломаются после переноса проекта.
- `location /projects/renovation/` — HTML-страницы проекта отдаются с `Cache-Control: no-cache` (обновляются деплоем, чтобы не было «залипшего» кэша), статику кэширует 1ч (`expires 1h`, `Cache-Control: public, immutable`). Безопасные заголовки повторяются внутри блока (add_header не наследуется во вложенные location); файлы раздаёт основной `location /`.
- Проекты (`/projects/<slug>/`, в т.ч. `renovation/`) и общие ассеты `projects/` (`styles.css`, `theme.js`) раздаёт основной `location /` — для раздачи правки nginx не требуются. Для `/projects/renovation/` (единственный с явным кэшем) HTML-страницы отдаются с `Cache-Control: no-cache` (блок `location ~ ^/projects/renovation/.*\.html$`), статика кэшируется 1ч (блок `location /projects/renovation/`).

### Полный конфиг vhost

```nginx
# Конфигурация на сервере в папке /etc/nginx/sites-available/
server {
    listen 443 ssl;
    http2 on;
    server_name family.rybnikov.su;
    root /var/www/family.rybnikov.su/public_html;
    index index.html index.htm;

    # SSL сертификаты (acme.sh)
    ssl_certificate /root/.acme.sh/family.rybnikov.su_ecc/fullchain.cer;
    ssl_certificate_key /root/.acme.sh/family.rybnikov.su_ecc/family.rybnikov.su.key;

    # Настройки SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Безопасные заголовки
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Основной блок
    location / {
        try_files $uri $uri/ =404;
    }

    # Проксирование API-запросов к бэкенду (pm2: family-backend, порт 3000)
    location /api/ {
        # Без слэша в конце proxy_pass сохраняет полный URI:
        # /api/health -> http://127.0.0.1:3000/api/health
        proxy_pass http://127.0.0.1:3000;

        # Импорт PDF в «Ремонт» (POST /api/renovation/pdf) — дефолт nginx 1 МБ, поднимаем до 20 МБ
        client_max_body_size 20m;

        # HTTP/1.1 и передача заголовков клиента
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Таймауты
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Редирект старого адреса проекта «Ремонт»: /renovation/ → /projects/renovation/
    # (постоянный 301; путь после /renovation/ сохраняется, напр.
    #  /renovation/estimate.html → /projects/renovation/estimate.html)
    location ^~ /renovation/ {
        return 301 /projects$request_uri;
    }
    location = /renovation {
        return 301 /projects/renovation/;
    }

    # Проекты (раздел «Проекты», напр. /projects/renovation/):
    # HTML-страницы не кэшируем (обновляются деплоем), статику кэшируем 1ч.
    # add_header не наследуется во вложенные location — безопасные заголовки
    # повторяются внутри каждого блока.
    location ~ ^/projects/renovation/.*\.html$ {
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }
    location /projects/renovation/ {
        expires 1h;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }

    # Запрет доступа к скрытым файлам
    location ~ /\. {
        deny all;
    }

    # Логи
    access_log /var/log/nginx/family.rybnikov.su_access.log;
    error_log /var/log/nginx/family.rybnikov.su_error.log;
}
```

---

## 3. SSL-сертификаты

| Что                                          | Путь на сервере                                                |
| -------------------------------------------- | -------------------------------------------------------------- |
| Сертификат (family.rybnikov.su, acme.sh ECC) | `/root/.acme.sh/family.rybnikov.su_ecc/fullchain.cer`          |
| Приватный ключ (family.rybnikov.su)          | `/root/.acme.sh/family.rybnikov.su_ecc/family.rybnikov.su.key` |

---

## 4. Второй хост: itg-ru-gw.rybnikov.su

| Что               | Путь на сервере                                    |
| ----------------- | -------------------------------------------------- |
| Конфиг vhost      | `/etc/nginx/sites-available/itg-ru-gw.rybnikov.su` |
| SSL (letsencrypt) | `/etc/letsencrypt/live/itg-ru-gw.rybnikov.su/`     |

- Тот же деплой через `.env`: `DEPLOY_HOST=itg-ru-gw.rybnikov.su`, пользователь `rybnikov` (есть passwordless `sudo`).
- Предупреждение: в `location /api/` НЕ ставить завершающий слэш у `proxy_pass` (см. раздел 2).

---

## 5. Полезные команды для диагностики

```bash
# Проверка конфига nginx и перезагрузка
sudo nginx -t && sudo systemctl reload nginx

# Бэкенд слушает 3000?
ss -ltnp | grep 3000

# Health-чек напрямую (минуя nginx)
curl -i http://127.0.0.1:3000/api/health

# Список проектов (раздел «Проекты», подпапки с index.html)
curl -s http://127.0.0.1:3000/api/projects

# Добавить VPS через API (пример; в UI — форма по кнопке «+» в модалке доступности)
curl -i -X POST http://127.0.0.1:3000/api/vps \
  -H 'Content-Type: application/json' \
  -d '{"country":"nl","name":"my-vps-01","ip":"1.2.3.4","panel":"https://panel.example/","services":[{"name":"3x-ui","type":"http","address":"https://my-vps-01.example:8443/"}]}'

# Импорт VPS из JSON-файла (структура как в vps.json; в UI — кнопка импорта в модалке доступности)
curl -i -X POST http://127.0.0.1:3000/api/vps/import \
  -H 'Content-Type: application/json' \
  --data-binary @vps.json

# Удалить VPS по имени (в UI — кнопка-корзина на карточке в модалке доступности)
curl -i -X DELETE http://127.0.0.1:3000/api/vps/my-vps-01

# Логи бэкенда (pm2)
/home/rybnikov/.nvm/versions/node/v24.19.0/bin/pm2 logs family-backend --lines 50 --nostream

# Просмотр/правка VPS в SQLite (node:sqlite, без установки клиента)
cd /var/www/family.rybnikov.su/server
node -e "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync('data/vps.sqlite'); console.log(db.prepare('SELECT id,country,name,ip FROM vps').all()); db.close();"
```
