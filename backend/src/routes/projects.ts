import { Router } from 'express';
import {
  createProjectController,
  deleteProjectController,
  projectController,
  projectsController,
  updateProjectController,
} from '../controllers/projectsController';
import { requireAdmin } from '../middlewares/auth';

export const projectsRouter = Router();

// Чтение — для любого авторизованного; мутации (создание/изменение/удаление) — только для admin.
projectsRouter.get('/', projectsController);
projectsRouter.get('/:slug', projectController);
projectsRouter.post('/', requireAdmin, createProjectController);
projectsRouter.patch('/:slug', requireAdmin, updateProjectController);
projectsRouter.delete('/:slug', requireAdmin, deleteProjectController);
