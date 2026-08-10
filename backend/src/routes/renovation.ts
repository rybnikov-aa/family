import { Router } from 'express';
import {
  addendumConfirmController,
  addendumProposalController,
  confirmPdfController,
  docsController,
  estimateController,
  estimateVersionsController,
  materialsReportController,
  overviewController,
  pdfFileController,
  settlementsController,
  updateMaterialsBudgetController,
  updateMetaController,
  uploadPdfController,
  workReportController,
} from '../controllers/renovationController';
import { uploadPdf } from '../middlewares/upload';
import { requireAdmin } from '../middlewares/auth';

/**
 * Маршруты модуля «Ремонт».
 * Чтение — под `requireAuth` (монтируется в `app.ts`); импорт PDF и применение
 * доп. соглашений — только `admin`.
 */
export const renovationRouter = Router();

renovationRouter.get('/', overviewController);
renovationRouter.get('/estimate/versions', estimateVersionsController);
renovationRouter.get('/estimate', estimateController);
renovationRouter.get('/docs', docsController);
renovationRouter.get('/docs/:file', pdfFileController);
renovationRouter.get('/settlements', settlementsController);

// Отчёты (этап 5).
renovationRouter.get('/reports/work', workReportController);
renovationRouter.get('/reports/materials', materialsReportController);

// Импорт PDF (этап 3): загрузка → черновик → подтверждение.
renovationRouter.post('/pdf', requireAdmin, uploadPdf, uploadPdfController);
renovationRouter.post('/pdf/:id/confirm', requireAdmin, confirmPdfController);

// Доп. соглашения к смете (этап 4): предложение → подтверждение.
renovationRouter.post('/estimate/addendum', requireAdmin, addendumProposalController);
renovationRouter.post('/estimate/addendum/confirm', requireAdmin, addendumConfirmController);

// Бюджет на материалы: настройка (admin).
renovationRouter.put('/materials-budget', requireAdmin, updateMaterialsBudgetController);

// Реквизиты проекта: адрес объекта (admin).
renovationRouter.put('/meta', requireAdmin, updateMetaController);
