import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getDb } from '../db/database';
import { env } from '../config/env';

/**
 * Авторизация: пользователи + сессии.
 *
 * Пароли хранятся только в виде хэшей scrypt (без новых зависимостей —
 * `node:crypto`). В сессии хранится SHA-256 от токена, сам токен отдаётся
 * только в httpOnly-cookie клиенту.
 */

export type UserRole = 'admin' | 'user';

/** Пользователь, отдаваемый в API (без хэша пароля). */
export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: UserRole;
}

/** Строка таблицы users (с хэшем пароля — только внутри сервиса). */
interface UserRow {
  id: number;
  username: string;
  name: string;
  password_hash: string;
  role: string;
}

interface SessionRow {
  user_id: number;
  expires_at: string;
}

// Формат хэша пароля: scrypt$N$r$p$<saltHex>$<hashHex>.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

/** Хэширует пароль в формате `scrypt$N$r$p$<salt>$<hash>`. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** Проверяет пароль против сохранённого хэша (constant-time сравнение). */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** Пользователь по имени (с хэшем пароля). */
export function getUserByUsername(username: string): UserRow | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  return row ? (row as unknown as UserRow) : undefined;
}

/** Пользователь по id (с хэшем пароля). */
export function getUserById(id: number): UserRow | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return row ? (row as unknown as UserRow) : undefined;
}

/** Пользователь без хэша пароля — для передачи в middleware/API. */
export function toAuthUser(row: UserRow): AuthUser {
  return { id: row.id, username: row.username, name: row.name, role: row.role as UserRole };
}

/** Создаёт новую сессию, возвращает токен (в БД — только его SHA-256). */
export function createSession(userId: number): string {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 3_600_000).toISOString();
  const db = getDb();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    sha256(token),
    userId,
    expiresAt,
  );
  return token;
}

/** Ищет действующую сессию по токену; просроченные удаляет и возвращает undefined. */
export function findSession(token: string): { userId: number } | undefined {
  const db = getDb();
  const tokenHash = sha256(token);
  const row = db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?')
    .get(tokenHash);
  if (!row) return undefined;
  const session = row as unknown as SessionRow;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return undefined;
  }
  return { userId: session.user_id };
}

/** Удаляет сессию (выход). */
export function destroySession(token: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

/** Удаляет все просроченные сессии. */
export function deleteExpiredSessions(): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
}

/**
 * Bootstrap администратора. Вызывается при старте: если в БД нет ни одного
 * пользователя, а в env задан AUTH_BOOTSTRAP_PASSWORD — создаётся первая
 * учётка с ролью `admin` (позволяет войти и дальше управлять пользователями).
 */
export function ensureBootstrapAdmin(): void {
  if (!env.AUTH_BOOTSTRAP_PASSWORD) return;
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) AS count FROM users').get() as unknown as {
    count: number;
  };
  if (row.count > 0) return;
  const username = env.AUTH_BOOTSTRAP_USERNAME;
  const passwordHash = hashPassword(env.AUTH_BOOTSTRAP_PASSWORD);
  db.prepare('INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)').run(
    username,
    env.AUTH_BOOTSTRAP_NAME,
    passwordHash,
    'admin',
  );
  console.log(`🔐 Создан начальный администратор «${username}» (роль admin).`);
}
