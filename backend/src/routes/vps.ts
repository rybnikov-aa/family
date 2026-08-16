import { Router } from 'express';
import {
  createVpsController,
  deleteVpsController,
  importVpsController,
  updateVpsController,
  vpsController,
} from '../controllers/vpsController';
import { requireAdmin } from '../middlewares/auth';

export const vpsRouter = Router();

// Чтение — для любого авторизованного; изменение — только для admin.
vpsRouter.get('/', vpsController);
vpsRouter.post('/import', requireAdmin, importVpsController);
vpsRouter.post('/', requireAdmin, createVpsController);
vpsRouter.patch('/:name', requireAdmin, updateVpsController);
vpsRouter.delete('/:name', requireAdmin, deleteVpsController);
