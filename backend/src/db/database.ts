import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from '../config/env';

/**
 * SQLite-хранилище конфигурации VPS.
 *
 * Список VPS хранится в SQLite — это позволяет менять состав VPS без
 * правки файлов и пересборки, а в будущем — хранить историю проверок.
 *
 * Используется встроенный модуль `node:sqlite` (Node ≥ 22.5, стабилен с 24.x),
 * поэтому новых зависимостей не требуется — в духе изначального выбора JSON.
 *
 * Файл БД лежит по пути из `env.DB_PATH` (по умолчанию `backend/data/vps.sqlite`).
 * Папка создаётся автоматически; при деплое файл не затирается.
 */

let dbInstance: DatabaseSync | null = null;

/** Открывает (и при необходимости создаёт) файл БД, инициализирует схему. */
function openDatabase(): DatabaseSync {
  const dbPath = resolve(env.DB_PATH);
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  // Таймаут ожидания блокировки — конкурентные записи не падают с SQLITE_BUSY.
  db.exec('PRAGMA busy_timeout = 5000');

  // Схема: VPS (1) — (N) services.
  // `name` у VPS уникален — естественный ключ для идентификации записей.
  db.exec(`
    CREATE TABLE IF NOT EXISTS vps (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      country TEXT    NOT NULL,
      name    TEXT    NOT NULL UNIQUE,
      ip      TEXT    NOT NULL,
      panel   TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vps_services (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      vps_id  INTEGER NOT NULL REFERENCES vps(id) ON DELETE CASCADE,
      name    TEXT    NOT NULL,
      type    TEXT    NOT NULL,
      address TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_vps_services_vps_id ON vps_services(vps_id);

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

/**
 * Singleton-инстанс БД. Открывается лениво при первом обращении,
 * чтобы dev-сервер Vite не падал, если БД ещё не нужна.
 */
export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = openDatabase();
  }
  return dbInstance;
}

/** Закрыть соединение (для тестов/скриптов). */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
