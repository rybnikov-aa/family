import { Router } from 'express';
import { requireAdmin } from '../middlewares/auth';
import {
  createPlanController,
  deletePlanController,
  plansController,
  updatePlanController,
} from '../controllers/plansController';

export const plansRouter = Router();

plansRouter.get('/', plansController);
plansRouter.post('/', requireAdmin, createPlanController);
plansRouter.patch('/:id', requireAdmin, updatePlanController);
plansRouter.delete('/:id', requireAdmin, deletePlanController);
