import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from '../config/env';

/**
 * Отдельное SQLite-хранилище прикладных проектов (раздел «Проекты»).
 *
 * Это **не** `DB_PATH` (`data/vps.sqlite`) и **не** `AUTH_DB_PATH` —
 * у проектов своя БД `data/projects.sqlite` (путь `PROJECTS_DB_PATH`).
 * Хранит метаданные и markdown-контент проектов, созданных через UI
 * (kind: 'app'). Встроенные проекты (например, «Ремонт») живут в реестре
 * `config/appProjects.ts` и в эту БД не попадают.
 *
 * Конвенции: WAL, foreign_keys, busy_timeout; строки — Record<string, ...>
 * (двойной каст в репозитории); `db.transaction()` не реализован → ручные
 * BEGIN/COMMIT/ROLLBACK; `mkdirSync` обязателен до `new DatabaseSync()`.
 */

let dbInstance: DatabaseSync | null = null;

function openDatabase(): DatabaseSync {
  const dbPath = resolve(env.PROJECTS_DB_PATH);
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slug        TEXT    NOT NULL UNIQUE,          -- латиница, цифры, дефисы
      title       TEXT    NOT NULL,
      description TEXT    NOT NULL,
      accent      TEXT    NOT NULL DEFAULT '#3b82f6',
      icon        TEXT    NOT NULL DEFAULT 'projects', -- renovation | folder | projects
      order_num   INTEGER NOT NULL DEFAULT 2147483647, -- меньше — раньше в списке
      content     TEXT    NOT NULL DEFAULT '',          -- markdown-контент страницы проекта
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

/** Синглтон-инстанс БД проектов (открывается лениво). */
export function getProjectsDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = openDatabase();
  }
  return dbInstance;
}

/** Закрыть соединение (для тестов/скриптов). */
export function closeProjectsDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
