import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { getSessionUser, type AuthUser } from '../services/authService';

declare global {
  namespace Express {
    interface Request {
      /** Текущий пользователь — заполняется middleware `requireAuth`. */
      user?: AuthUser;
    }
  }
}

/** Разбор cookie из заголовка Cookie (без cookie-parser). */
function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
    }
  }
  return cookies;
}

/** Токен сессии из cookie текущего запроса. */
export function getSessionToken(req: Request): string | undefined {
  return parseCookies(req.headers.cookie)[env.AUTH_COOKIE_NAME];
}

/** Требует действующую сессию; при её отсутствии — 401. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = getSessionToken(req);
  if (!token) {
    res.status(401).json({ message: 'Требуется авторизация' });
    return;
  }
  const user = getSessionUser(token);
  if (!user) {
    res.status(401).json({ message: 'Сессия истекла или недействительна' });
    return;
  }
  req.user = user;
  next();
}

/**
 * Требует роль `admin` (поверх `requireAuth`); иначе — 403.
 * Если `requireAuth` уже отработал на уровне роутера (req.user заполнен),
 * не переаутентифицируемся повторно — чтобы не дублировать запросы к БД.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const checkRole = (): void => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Недостаточно прав' });
      return;
    }
    next();
  };
  if (req.user) {
    checkRole();
  } else {
    requireAuth(req, res, checkRole);
  }
}
