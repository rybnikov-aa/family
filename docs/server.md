# VPS: ключевые пути на сервере

Справочник по размещению файлов веб-приложения и настроек nginx на сервере.
Актуально для хоста **family.rybnikov.su** (и второго хоста **itg-ru-gw.rybnikov.su**).

---

## 1. Веб-приложение

| Что                                               | Путь на сервере                                                |
| ------------------------------------------------- | -------------------------------------------------------------- |
| Фронтенд (статик-файлы, сборка Vite)              | `/var/www/family.rybnikov.su/public_html`                      |
| Бэкенд (Express, рантайм + `node_modules`)        | `/var/www/family.rybnikov.su/server`                           |
| SQLite-база VPS (runtime, не в git)               | `/var/www/family.rybnikov.su/server/data/vps.sqlite`           |
| Отчёты по ремонту (проект «Ремонт»)               | `/var/www/family.rybnikov.su/public_html/projects/renovation/` |
| Общие ассеты страниц проектов (стиль/тема/иконки) | `/var/www/family.rybnikov.su/public_html/projects/`            |

- Бэкенд слушает `127.0.0.1:3000` (не публичный порт), доступен только через nginx-прокси `/api/`.
- Процесс бэкенда управляется **pm2**, имя приложения: `family-backend`.
  - pm2 не в PATH в неинтерактивной сессии, полный путь:
    `/home/rybnikov/.nvm/versions/node/v24.19.0/bin/pm2`
- **SQLite-база VPS** (`server/data/vps.sqlite`) — runtime-данные, наполняется вручную (SQL/клиентом) **или через форму добавления VPS в UI** (`POST /api/vps`), импорт из JSON (`POST /api/vps/import`), удаление — кнопка-корзина в детализации (`DELETE /api/vps/:name`). Путь задаётся через `DB_PATH` (по умолчанию `data/vps.sqlite`). При деплое папка `data/` **не удаляется** (как и `.env`); схема таблиц создаётся автоматически при первом обращении.
- **Проекты (раздел «Проекты»):** проект — подпапка `public_html/projects/<slug>/` с `index.html` (например, «Ремонт» — `public_html/projects/renovation/`). Список проектов отдаёт `GET /api/projects` (сканирует каталог из `PROJECTS_DIR`, по умолчанию `../public_html/projects`). Страницы проектов используют общий шаблон `projects/` (стиль + тема приложения): `projects/styles.css`, `projects/theme.js`, иконки — SVG-спрайт `projects/icon-sprite.svg` (эмодзи как иконки не используются); тема хранится в `localStorage['theme']` (общая для домена). Шаблон новой страницы — `projects/_template/index.html` в репозитории (на сервер не деплоится).
- **Загрузка PDF в проекты** — через UI (кнопка «Загрузить PDF» на странице «Проекты») → `POST /api/projects/upload`; файлы сохраняются в `PROJECTS_DIR/<папка>/` (папка выбирается из `GET /api/projects/dirs` и создаётся при необходимости) и раздаются nginx как статика по `/projects/…`. Для работы нужен `client_max_body_size 20m` в `location /api/`.
- **Файл `.env` бэкенда** (`server/.env`) — конфигурация рантайма, при деплое **сохраняется** (не перезаписывается и не удаляется). Переменные:
  - `PORT` — порт API (по умолчанию `3000`);
  - `NODE_ENV` — в проде `production` (задаётся скриптом деплоя);
  - `CORS_ORIGIN` — в проде `https://family.rybnikov.su`;
  - `DB_PATH` — путь к SQLite-базе (по умолчанию `data/vps.sqlite`);
  - `PROJECTS_DIR` — каталог проектов (подпапки с `index.html`), по умолчанию `../public_html/projects` (рядом с каталогом бэкенда).

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
- `location /api/` — прокси на бэкенд:
  `proxy_pass http://127.0.0.1:3000;` — **без** завершающего слэша (иначе срезается `/api` → 404).
- Для загрузки PDF (`POST /api/projects/upload`) в `location /api/` задан `client_max_body_size 20m` (дефолт nginx — 1 МБ, без этого загрузка упадёт с 413).
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

        # Загрузка PDF (POST /api/projects/upload) — дефолт nginx 1 МБ, поднимаем до 20 МБ
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
