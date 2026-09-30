import { Router } from 'express';
import {
  adminNewsController,
  createNewsController,
  deleteNewsController,
  markNewsReadController,
  newsAttachmentController,
  newsController,
  updateNewsController,
} from '../controllers/newsController';
import { requireAdmin } from '../middlewares/auth';
import { uploadImages } from '../middlewares/uploadImages';

export const newsRouter = Router();

newsRouter.get('/', newsController);
newsRouter.get('/admin', requireAdmin, adminNewsController);
newsRouter.get('/attachments/:folder/:file', newsAttachmentController);
newsRouter.post('/', requireAdmin, uploadImages, createNewsController);
newsRouter.patch('/:id', requireAdmin, uploadImages, updateNewsController);
newsRouter.delete('/:id', requireAdmin, deleteNewsController);
newsRouter.post('/:id/read', markNewsReadController);
