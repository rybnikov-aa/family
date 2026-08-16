import { Router } from 'express';
import {
  immichOriginalController,
  immichSearchController,
  immichThumbnailController,
} from '../controllers/immichController';

/**
 * Маршруты пикера фото Immich (вариант B2) — только роль `admin`.
 * Монтируется под `requireAdmin` в `app.ts`. Прокси к инстансу Immich
 * (поиск по датам, миниатюры, оригиналы); API-ключ хранится в БД и
 * клиенту не отдаётся. См. `docs/immich.md`.
 */
export const immichRouter = Router();

immichRouter.get('/search', immichSearchController);
immichRouter.get('/assets/:id/thumbnail', immichThumbnailController);
immichRouter.get('/assets/:id/original', immichOriginalController);
