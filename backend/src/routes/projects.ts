import { Router } from 'express';
import { createProjectController, projectsController } from '../controllers/projectsController';
import { requireAdmin } from '../middlewares/auth';

export const projectsRouter = Router();

// Чтение — для любого авторизованного; создание проекта — только для admin.
projectsRouter.get('/', projectsController);
projectsRouter.post('/', requireAdmin, createProjectController);
