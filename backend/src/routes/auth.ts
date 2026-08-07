import { Router } from 'express';
import {
  loginController,
  logoutController,
  meController,
  updateProfileController,
} from '../controllers/authController';
import { requireAuth } from '../middlewares/auth';

export const authRouter = Router();

authRouter.post('/login', loginController);
authRouter.post('/logout', logoutController);
authRouter.get('/me', requireAuth, meController);
authRouter.patch('/profile', requireAuth, updateProfileController);
