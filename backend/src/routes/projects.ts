import { Router } from 'express';
import {
  dirsController,
  projectsController,
  uploadPdfController,
} from '../controllers/projectsController';
import { uploadPdf } from '../middlewares/upload';
import { requireAdmin } from '../middlewares/auth';

export const projectsRouter = Router();

// Чтение — для любого авторизованного; загрузка PDF — только для admin.
projectsRouter.get('/', projectsController);
projectsRouter.get('/dirs', dirsController);
projectsRouter.post('/upload', requireAdmin, uploadPdf, uploadPdfController);
