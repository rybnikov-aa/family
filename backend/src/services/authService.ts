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

/** Пользователь для админ-панели (дополнительно — дата создания). */
export interface AdminUser {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  createdAt: string;
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

/**
 * Обновляет профиль пользователя: отображаемое имя и/или хэш пароля.
 * Возвращает обновлённого пользователя (без хэша).
 */
export function updateUserProfile(
  userId: number,
  updates: { name?: string; passwordHash?: string },
): AuthUser {
  const db = getDb();
  const fields: string[] = [];
  const values: Array<string | number> = [];
  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.passwordHash !== undefined) {
    fields.push('password_hash = ?');
    values.push(updates.passwordHash);
  }
  if (fields.length === 0) {
    throw new Error('Нет изменений для сохранения');
  }
  values.push(userId);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const updated = getUserById(userId);
  if (!updated) throw new Error('Пользователь не найден');
  return toAuthUser(updated);
}

/** Список всех пользователей для админ-панели, отсортирован по логину. */
export function listUsers(): AdminUser[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, username, name, role, created_at FROM users ORDER BY username')
    .all() as unknown as Array<{
    id: number;
    username: string;
    name: string;
    role: string;
    created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role as UserRole,
    createdAt: row.created_at,
  }));
}

/**
 * Создаёт пользователя (админ-панель). Пароль хэшируется так же, как при
 * регистрации/CLI. При дубликате `username` бросается UNIQUE-ошибка SQLite.
 */
export function createUser(input: {
  username: string;
  name: string;
  role: UserRole;
  password: string;
}): AuthUser {
  const db = getDb();
  db.prepare('INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)').run(
    input.username,
    input.name,
    hashPassword(input.password),
    input.role,
  );
  const created = getUserByUsername(input.username);
  if (!created) throw new Error('Не удалось создать пользователя');
  return toAuthUser(created);
}

/** Удаляет пользователя (сессии каскадно); false — если его не было. */
export function deleteUser(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
}

/** Принудительно задаёт пароль пользователю; false — если пользователя нет. */
export function setUserPassword(id: number, password: string): boolean {
  const db = getDb();
  const result = db
    .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(hashPassword(password), id);
  return result.changes > 0;
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
