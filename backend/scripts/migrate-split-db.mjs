#!/usr/bin/env node
/**
 * Миграция: разделение единой БД `DB_PATH` (vps.sqlite) на независимые базы
 * по доменам (вариант A + C):
 *
 *   vps.sqlite      → остаётся только VPS (vps, vps_services)
 *   auth.sqlite     → авторизация (users, sessions)          [AUTH_DB_PATH]
 *   projects.sqlite → прикладные проекты (projects)          [PROJECTS_DB_PATH]
 *
 * Что делает:
 *   1. Копирует `users`+`sessions` из vps.sqlite в auth.sqlite (id сохраняются,
 *      чтобы не сломать связи sessions.user_id → users.id).
 *   2. Копирует `projects` из vps.sqlite в projects.sqlite.
 *   3. Удаляет перенесённые таблицы из vps.sqlite.
 *   4. Сжимает WAL всех трёх БД (`PRAGMA wal_checkpoint(TRUNCATE)`) — гигиена C.
 *
 * Идемпотентна: повторный запуск безопасен (если таблиц `users` в vps.sqlite
 * уже нет — миграция уже выполнена, скрипт завершается без изменений).
 *
 * Запуск (из папки backend/, при остановленном бэкенде):
 *   node scripts/migrate-split-db.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = resolve(process.env.DB_PATH ?? 'data/vps.sqlite');
const authPath = resolve(process.env.AUTH_DB_PATH ?? 'data/auth.sqlite');
const projectsPath = resolve(process.env.PROJECTS_DB_PATH ?? 'data/projects.sqlite');

function openDb(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

/** Проверка наличия таблицы в БД. */
function hasTable(db, name) {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(name);
  return !!row;
}

/** Схема таблиц авторизации (та же, что в src/db/authDatabase.ts). */
const AUTH_SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    name          TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'user',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT    NOT NULL UNIQUE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
`;

/** Схема таблицы проектов (та же, что в src/db/projectsDatabase.ts). */
const PROJECTS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT    NOT NULL UNIQUE,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL,
    accent      TEXT    NOT NULL DEFAULT '#3b82f6',
    icon        TEXT    NOT NULL DEFAULT 'projects',
    order_num   INTEGER NOT NULL DEFAULT 2147483647,
    content     TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`;

/** Копирует строки с сохранением id (чтобы не сломать связи). */
function copyRows(src, dst, table, columns) {
  const rows = src.prepare(`SELECT ${columns} FROM ${table}`).all();
  for (const row of rows) {
    const placeholders = columns
      .split(',')
      .map(() => '?')
      .join(', ');
    dst
      .prepare(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`)
      .run(...columns.split(',').map((c) => row[c.trim()]));
  }
  return rows.length;
}

function main() {
  const src = openDb(dbPath);
  const auth = openDb(authPath);
  const projects = openDb(projectsPath);

  if (!hasTable(src, 'users')) {
    console.log(`Миграция уже выполнена: в «${dbPath}» нет таблицы users. Новых БД не трогаем.`);
    // Всё равно сожмём WAL — гигиена C.
    src.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    auth.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    projects.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    src.close();
    auth.close();
    projects.close();
    return;
  }

  console.log(`Источник:   ${dbPath}`);
  console.log(`Авторизация: ${authPath}`);
  console.log(`Проекты:    ${projectsPath}`);

  // 1. Авторизация: users + sessions (сначала users, чтобы FK sessions не нарушить).
  auth.exec(AUTH_SCHEMA);
  const usersCount = copyRows(
    src,
    auth,
    'users',
    'id, username, name, password_hash, role, created_at',
  );
  auth.exec('BEGIN');
  try {
    const sessionsCount = copyRows(
      src,
      auth,
      'sessions',
      'id, token_hash, user_id, created_at, expires_at',
    );
    auth.exec('COMMIT');
    console.log(`→ auth.sqlite: users=${usersCount}, sessions=${sessionsCount}`);
  } catch (err) {
    auth.exec('ROLLBACK');
    throw err;
  }

  // 2. Проекты.
  projects.exec(PROJECTS_SCHEMA);
  const projectsCount = copyRows(
    src,
    projects,
    'projects',
    'id, slug, title, description, accent, icon, order_num, content, created_at, updated_at',
  );
  console.log(`→ projects.sqlite: projects=${projectsCount}`);

  // 3. Убираем перенесённые таблицы из vps.sqlite.
  src.exec('BEGIN');
  try {
    src.exec('DROP TABLE IF EXISTS sessions');
    src.exec('DROP TABLE IF EXISTS users');
    src.exec('DROP TABLE IF EXISTS projects');
    src.exec('COMMIT');
  } catch (err) {
    src.exec('ROLLBACK');
    throw err;
  }
  console.log('→ vps.sqlite: таблицы sessions/users/projects удалены (перенесены).');

  // 4. Сжимаем WAL (гигиена C) — включая старый большой WAL vps.sqlite.
  for (const [name, db] of [
    ['vps.sqlite', src],
    ['auth.sqlite', auth],
    ['projects.sqlite', projects],
  ]) {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    console.log(`→ ${name}: WAL сжат.`);
  }

  src.close();
  auth.close();
  projects.close();
  console.log('Готово. Бэкенд теперь работает с раздельными БД (vps/auth/projects).');
}

main();
