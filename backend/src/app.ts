import express from 'express';
import cors from 'cors';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env';
import { healthRouter } from './routes/health';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler';

// Express application. Exported so that `vite-plugin-node`
// (dev) can mount it as middleware.
export const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/health', healthRouter);

// 404 + error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start the server when the file is executed directly (production bundle:
// `npm run build` -> `npm start` -> `node dist/app.cjs`). In development the
// Vite dev server mounts `app` itself, so we must not listen here.
const isMainEntry =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMainEntry) {
  app.listen(env.PORT, () => {
    console.log(`🚀 API server running at http://localhost:${env.PORT}`);
  });
}

