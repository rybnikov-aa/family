import { Router } from 'express';
import {
  checkImmichSettingsController,
  getImmichSettingsController,
} from '../controllers/immichSettingsController';
import { requireAdmin } from '../middlewares/auth';

/**
 * Маршруты настроек приложения (`/api/settings`).
 * Монтируется под `requireAuth` в `app.ts`. Чтение (`GET /immich`) доступно
 * любому авторизованному — адрес инстанса нужен для ссылок «Фотоархив»/«Архив»
 * (ключ при этом не возвращается); мутация (`POST /immich/check`) — только
 * роли `admin`. Сейчас здесь — настройки подключения к Immich (см. `docs/immich.md`).
 */
export const settingsRouter = Router();

settingsRouter.get('/immich', getImmichSettingsController);
settingsRouter.post('/immich/check', requireAdmin, checkImmichSettingsController);
