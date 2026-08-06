import { Router } from 'express';
import {
  dirsController,
  projectsController,
  uploadPdfController,
} from '../controllers/projectsController';
import { uploadPdf } from '../middlewares/upload';

export const projectsRouter = Router();

projectsRouter.get('/', projectsController);
projectsRouter.get('/dirs', dirsController);
projectsRouter.post('/upload', uploadPdf, uploadPdfController);
