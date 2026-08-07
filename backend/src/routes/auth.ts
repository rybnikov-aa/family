import { Router } from 'express';
import {
  adminCreateUserController,
  adminDeleteUserController,
  adminListUsersController,
  adminSetPasswordController,
  loginController,
  logoutController,
  meController,
  updateProfileController,
} from '../controllers/authController';
import { requireAdmin, requireAuth } from '../middlewares/auth';

export const authRouter = Router();

authRouter.post('/login', loginController);
authRouter.post('/logout', logoutController);
authRouter.get('/me', requireAuth, meController);
authRouter.patch('/profile', requireAuth, updateProfileController);

// Админ-панель: управление пользователями (только для роли `admin`).
authRouter.get('/admin/users', requireAdmin, adminListUsersController);
authRouter.post('/admin/users', requireAdmin, adminCreateUserController);
authRouter.patch('/admin/users/:id/password', requireAdmin, adminSetPasswordController);
authRouter.delete('/admin/users/:id', requireAdmin, adminDeleteUserController);
