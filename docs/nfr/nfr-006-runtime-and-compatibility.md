# NFR-006: Runtime и совместимость

- **Статус:** действует
- **Область:** локальная разработка, production runtime, URLs и file processing.
- **Источники:** `AGENTS.md`, `docs/layers/backend.md`, `docs/layers/frontend.md`, `docs/server.md`.

## Требования

- **NFR-006.1** Backend требует Node.js не ниже 22.5 из-за `node:sqlite`; deploy/runtime должны соответствовать engines проекта.
- **NFR-006.2** Frontend использует hash routing, поскольку production nginx не предоставляет SPA history fallback.
- **NFR-006.3** PDF parsing зависит от Python/pdfplumber subprocess; интерпретатор и script path настраиваются для локальной и production среды.
- **NFR-006.4** Production process под pm2 стартует с `NODE_ENV=production`; dev-server не должен отдельно вызывать `app.listen`.
- **NFR-006.5** Env namespaces не смешиваются: root `.env` — deploy, `backend/.env` — runtime, `frontend/.env` — Vite `VITE_*`.

## Проверка

Node engines и startup behavior — backend layer spec; host/nginx/pm2 — `docs/server.md`; build/typecheck commands — `AGENTS.md` and package manifests.
