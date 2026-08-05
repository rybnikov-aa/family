import { Router } from 'express';
import { projectsController } from '../controllers/projectsController';

export const projectsRouter = Router();

projectsRouter.get('/', projectsController);
