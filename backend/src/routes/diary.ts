import { Router } from 'express';
import {
  createDiaryEventController,
  deleteDiaryEventController,
  diaryEventController,
  exportDiaryEventController,
  imageFileController,
  listDiaryAlbumsController,
  createDiaryAlbumController,
  updateDiaryAlbumController,
  deleteDiaryAlbumController,
  listDiaryEventsController,
  updateDiaryEventController,
} from '../controllers/diaryController';
import { uploadImages } from '../middlewares/uploadImages';
import { requireAdmin } from '../middlewares/auth';

/**
 * Маршруты раздела «Дневник».
 * Чтение (список, событие, изображения) — под `requireAuth` (монтируется
 * в `app.ts`); мутации (создание/изменение/удаление) — только `admin`.
 * Изображения — `GET /api/diary/images/:folder/:file`.
 */
export const diaryRouter = Router();

diaryRouter.get('/', listDiaryEventsController);
diaryRouter.get('/images/:folder/:file', imageFileController);
diaryRouter.get('/albums', listDiaryAlbumsController);
diaryRouter.post('/albums', requireAdmin, createDiaryAlbumController);
diaryRouter.patch('/albums/:id', requireAdmin, updateDiaryAlbumController);
diaryRouter.delete('/albums/:id', requireAdmin, deleteDiaryAlbumController);
diaryRouter.get('/:id/export', exportDiaryEventController);
diaryRouter.get('/:id', diaryEventController);
diaryRouter.post('/', requireAdmin, uploadImages, createDiaryEventController);
diaryRouter.patch('/:id', requireAdmin, uploadImages, updateDiaryEventController);
diaryRouter.delete('/:id', requireAdmin, deleteDiaryEventController);
