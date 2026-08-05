import { Router } from 'express';
import {
  createVpsController,
  deleteVpsController,
  importVpsController,
  vpsController,
} from '../controllers/vpsController';

export const vpsRouter = Router();

vpsRouter.get('/', vpsController);
vpsRouter.post('/import', importVpsController);
vpsRouter.post('/', createVpsController);
vpsRouter.delete('/:name', deleteVpsController);
