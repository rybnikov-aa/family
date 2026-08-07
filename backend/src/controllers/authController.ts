import type { Request, Response } from 'express';
import { env } from '../config/env';
import { isConstraintError } from '../db/errors';
import { getSessionToken } from '../middlewares/auth';
import {
  createSession,
  createUser,
  deleteUser,
  destroySession,
  getUserById,
  getUserByUsername,
  hashPassword,
  listUsers,
  setUserPassword,
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

// ── Админ-панель: управление пользователями (роуты защищены `requireAdmin`) ──

/** Список пользователей: `GET /api/auth/admin/users`. */
export function adminListUsersController(_req: Request, res: Response): void {
  res.json({ users: listUsers() });
}

/** Добавление пользователя: `POST /api/auth/admin/users` (тело — `{username, name, role, password}`). */
export function adminCreateUserController(req: Request, res: Response): void {
  const { username, name, role, password } = (req.body ?? {}) as {
    username?: unknown;
    name?: unknown;
    role?: unknown;
    password?: unknown;
  };

  if (typeof username !== 'string' || !username.trim()) {
    res.status(400).json({ message: 'Укажите имя пользователя (логин)' });
    return;
  }
  const trimmedUsername = username.trim();
  if (trimmedUsername.length > 50) {
    res.status(400).json({ message: 'Имя пользователя слишком длинное (не более 50 символов)' });
    return;
  }
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ message: 'Укажите отображаемое имя' });
    return;
  }
  const trimmedName = name.trim();
  if (trimmedName.length > 100) {
    res.status(400).json({ message: 'Отображаемое имя слишком длинное (не более 100 символов)' });
    return;
  }
  const userRole = role === 'admin' ? 'admin' : role === 'user' ? 'user' : undefined;
  if (!userRole) {
    res.status(400).json({ message: 'Роль должна быть «admin» или «user»' });
    return;
  }
  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ message: 'Пароль должен быть не короче 6 символов' });
    return;
  }

  try {
    const user = createUser({
      username: trimmedUsername,
      name: trimmedName,
      role: userRole,
      password,
    });
    res.status(201).json({ user });
  } catch (err) {
    // UNIQUE-ограничение на users.username → конфликт (409).
    if (isConstraintError(err)) {
      res.status(409).json({ message: `Пользователь «${trimmedUsername}» уже существует` });
      return;
    }
    throw err; // прочие ошибки → errorHandler (500)
  }
}

/** Удаление пользователя: `DELETE /api/auth/admin/users/:id`. Свою учётку удалить нельзя. */
export function adminDeleteUserController(req: Request, res: Response): void {
  const admin = req.user;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: 'Некорректный id пользователя' });
    return;
  }
  if (admin?.id === id) {
    res.status(400).json({ message: 'Нельзя удалить собственную учётную запись' });
    return;
  }
  if (!deleteUser(id)) {
    res.status(404).json({ message: 'Пользователь не найден' });
    return;
  }
  res.status(204).end();
}

/** Принудительная смена пароля: `PATCH /api/auth/admin/users/:id/password` (тело — `{password}`). */
export function adminSetPasswordController(req: Request, res: Response): void {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: 'Некорректный id пользователя' });
    return;
  }
  const { password } = (req.body ?? {}) as { password?: unknown };
  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ message: 'Пароль должен быть не короче 6 символов' });
    return;
  }
  if (!setUserPassword(id, password)) {
    res.status(404).json({ message: 'Пользователь не найден' });
    return;
  }
  res.status(204).end();
}
