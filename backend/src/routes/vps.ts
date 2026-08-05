import { Router } from 'express';
import { vpsController } from '../controllers/vpsController';

export const vpsRouter = Router();

vpsRouter.get('/', vpsController);
