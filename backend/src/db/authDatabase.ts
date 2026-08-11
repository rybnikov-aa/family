import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from '../config/env';

/**
 * Отдельное SQLite-хранилище авторизации (пользователи + сессии).
 *
 * Это **не** `DB_PATH` (`data/vps.sqlite`) — у авторизации своя БД
 * `data/auth.sqlite` (путь `AUTH_DB_PATH`). Выделение в отдельный файл
 * изолирует «горячие» записи (новая сессия на каждый вход) от справочников
 * VPS/проектов: WAL и lock-конкуренция больше не задевают чтения VPS.
 *
 * Конвенции: WAL, foreign_keys, busy_timeout; строки — Record<string, ...>
 * (двойной каст в сервисе); `db.transaction()` не реализован → ручные
 * BEGIN/COMMIT/ROLLBACK; `mkdirSync` обязателен до `new DatabaseSync()`.
 */

let dbInstance: DatabaseSync | null = null;

function openDatabase(): DatabaseSync {
  const dbPath = resolve(env.AUTH_DB_PATH);
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');

  db.exec(`
    -- Пользователи (авторизация) и сессии. Пароли — только хэши (scrypt).
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      name          TEXT    NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'user', -- 'admin' | 'user'
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT    NOT NULL UNIQUE, -- SHA-256 от токена (сам токен в БД не храним)
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  `);

  return db;
}

/** Синглтон-инстанс БД авторизации (открывается лениво). */
export function getAuthDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = openDatabase();
  }
  return dbInstance;
}

/** Закрыть соединение (для тестов/скриптов). */
export function closeAuthDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
