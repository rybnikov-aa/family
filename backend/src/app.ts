import express from 'express';
import cors from 'cors';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env';
import { healthRouter } from './routes/health';
import { vpsRouter } from './routes/vps';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler';

// Express application. Exported so that `vite-plugin-node`
// (dev) can mount it as middleware.
export const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/health', healthRouter);
app.use('/api/vps', vpsRouter);

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
