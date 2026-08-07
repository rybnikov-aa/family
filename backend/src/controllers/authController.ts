import type { Request, Response } from 'express';
import { env } from '../config/env';
import { getSessionToken } from '../middlewares/auth';
import {
  createSession,
  destroySession,
  getUserById,
  getUserByUsername,
  hashPassword,
  toAuthUser,
  updateUserProfile,
  verifyPassword,
} from '../services/authService';

/** Очищает cookie сессии в ответе. */
function clearSessionCookie(res: Response): void {
  res.clearCookie(env.AUTH_COOKIE_NAME, { path: '/' });
}

/** Вход: проверяет логин/пароль, создаёт сессию и ставит httpOnly-cookie. */
export function loginController(req: Request, res: Response): void {
  const { username, password } = (req.body ?? {}) as { username?: unknown; password?: unknown };
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    res.status(400).json({ message: 'Укажите имя пользователя и пароль' });
    return;
  }
  const user = getUserByUsername(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ message: 'Неверное имя пользователя или пароль' });
    return;
  }
  const token = createSession(user.id);
  res.cookie(env.AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: env.SESSION_TTL_HOURS * 3_600_000,
  });
  res.json({ user: toAuthUser(user) });
}

/** Выход: удаляет сессию и очищает cookie. */
export function logoutController(req: Request, res: Response): void {
  const token = getSessionToken(req);
  if (token) destroySession(token);
  clearSessionCookie(res);
  res.status(204).end();
}

/** Текущий пользователь (роут защищён `requireAuth`). */
export function meController(req: Request, res: Response): void {
  res.json({ user: req.user });
}

/**
 * Обновление профиля (роут защищён `requireAuth`): отображаемое имя и/или пароль.
 * Пароль меняется только при подтверждении текущим паролем.
 */
export function updateProfileController(req: Request, res: Response): void {
  const user = req.user;
  if (!user) {
    res.status(401).json({ message: 'Требуется авторизация' });
    return;
  }
  const { name, currentPassword, password } = (req.body ?? {}) as {
    name?: unknown;
    currentPassword?: unknown;
    password?: unknown;
  };

  let newName: string | undefined;
  let newPasswordHash: string | undefined;

  if (name !== undefined) {
    if (typeof name !== 'string') {
      res.status(400).json({ message: 'Имя должно быть строкой' });
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      res.status(400).json({ message: 'Имя не может быть пустым' });
      return;
    }
    if (trimmed.length > 100) {
      res.status(400).json({ message: 'Имя слишком длинное (не более 100 символов)' });
      return;
    }
    newName = trimmed;
  }

  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ message: 'Новый пароль должен быть не короче 6 символов' });
      return;
    }
    if (typeof currentPassword !== 'string' || !currentPassword) {
      res.status(400).json({ message: 'Укажите текущий пароль' });
      return;
    }
    const row = getUserById(user.id);
    if (!row || !verifyPassword(currentPassword, row.password_hash)) {
      res.status(400).json({ message: 'Текущий пароль указан неверно' });
      return;
    }
    newPasswordHash = hashPassword(password);
  }

  if (newName === undefined && newPasswordHash === undefined) {
    res.status(400).json({ message: 'Укажите имя или новый пароль' });
    return;
  }

  const updated = updateUserProfile(user.id, {
    ...(newName !== undefined ? { name: newName } : {}),
    ...(newPasswordHash !== undefined ? { passwordHash: newPasswordHash } : {}),
  });
  res.json({ user: updated });
}
