import type { Request, Response } from 'express';
import { env } from '../config/env';
import { getSessionToken } from '../middlewares/auth';
import {
  createSession,
  destroySession,
  getUserByUsername,
  toAuthUser,
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
