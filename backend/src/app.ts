import express from 'express';
import cors from 'cors';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { vpsRouter } from './routes/vps';
import { projectsRouter } from './routes/projects';
import { renovationRouter } from './routes/renovation';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler';
import { requireAuth } from './middlewares/auth';
import { ensureBootstrapAdmin } from './services/authService';

// Express application. Exported so that `vite-plugin-node`
// (dev) can mount it as middleware.
export const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
// `/api/health` — публичный (нужен для диагностики и мониторинга).
// `/api/auth` — вход/выход; остальные эндпоинты auth защищены внутри роутера.
// Всё остальное API закрыто авторизацией: весь портал требует входа.
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/vps', requireAuth, vpsRouter);
app.use('/api/projects', requireAuth, projectsRouter);
// Модуль «Ремонт» (этап 2 — чтение отчётности из отдельной БД renovation.sqlite).
app.use('/api/renovation', requireAuth, renovationRouter);

// Создание первого администратора (если в env задан bootstrap-пароль).
ensureBootstrapAdmin();

// 404 + error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start the server when this module is run as the production server.
// The deploy script runs the bundle under pm2, which loads the script through
// its own fork container, so `process.argv[1]` points to the pm2 wrapper and
// NOT to this file — that is why we treat `NODE_ENV=production` (set by the
// deploy script) as the primary signal, and keep the direct-run check as a
// fallback. In development the Vite dev server mounts `app` itself, so we
// must not listen here (NODE_ENV is `development` there).
const isMainEntry =
  env.NODE_ENV === 'production' ||
  (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1]));

if (isMainEntry) {
  app.listen(env.PORT, () => {
    console.log(`🚀 API server running at http://localhost:${env.PORT}`);
  });
}
