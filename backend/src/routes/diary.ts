import { Router } from 'express';
import {
  createDiaryEventController,
  deleteDiaryEventController,
  diaryEventController,
  imageFileController,
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
diaryRouter.get('/:id', diaryEventController);
diaryRouter.post('/', requireAdmin, uploadImages, createDiaryEventController);
diaryRouter.patch('/:id', requireAdmin, uploadImages, updateDiaryEventController);
diaryRouter.delete('/:id', requireAdmin, deleteDiaryEventController);
