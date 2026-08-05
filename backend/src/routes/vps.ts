import { Router } from 'express';
import { createVpsController, vpsController } from '../controllers/vpsController';

export const vpsRouter = Router();

vpsRouter.get('/', vpsController);
vpsRouter.post('/', createVpsController);
