# VPS: ключевые пути на сервере

Справочник по размещению файлов веб-приложения и настроек nginx на сервере.
Актуально для хоста **family.rybnikov.su** (и второго хоста **itg-ru-gw.rybnikov.su**).

---

## 1. Веб-приложение

| Что                                        | Путь на сервере                                       |
| ------------------------------------------ | ----------------------------------------------------- |
| Фронтенд (статик-файлы, сборка Vite)       | `/var/www/family.rybnikov.su/public_html`             |
| Бэкенд (Express, рантайм + `node_modules`) | `/var/www/family.rybnikov.su/server`                  |
| Отчёты по ремонту (отдельный проект)       | `/var/www/family.rybnikov.su/public_html/renovation/` |

- Бэкенд слушает `127.0.0.1:3000` (не публичный порт), доступен только через nginx-прокси `/api/`.
- Процесс бэкенда управляется **pm2**, имя приложения: `family-backend`.
  - pm2 не в PATH в неинтерактивной сессии, полный путь:
    `/home/rybnikov/.nvm/versions/node/v24.19.0/bin/pm2`
- Дефолтные пути из `scripts/deploy.mjs` (переопределяются через `.env` в корне репозитория):

```bash
DEPLOY_HOST=family.rybnikov.su
DEPLOY_USER=root
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
| Полный конфиг (в репозитории)     | `family.rybnikov.su.md` (корень репо, раздел 2) |
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
- `location /renovation/` — только кеш-заголовки (`expires 1h`, `Cache-Control: public, immutable`); файлы раздаёт основной `location /`.

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

    # Отчеты по ремонту
    # Файлы раздает основной location / (папка внутри корня сайта),
    # здесь только кеширование статики
    location /renovation/ {
        expires 1h;
        add_header Cache-Control "public, immutable";
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

# Логи бэкенда (pm2)
/home/rybnikov/.nvm/versions/node/v24.19.0/bin/pm2 logs family-backend --lines 50 --nostream
```
