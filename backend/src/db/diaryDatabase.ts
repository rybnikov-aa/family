import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from '../config/env';

/**
 * Отдельное SQLite-хранилище событий «Дневника» (раздел «Дневник»).
 *
 * Это **не** `DB_PATH` (`data/vps.sqlite`), **не** `AUTH_DB_PATH` и **не**
 * `PROJECTS_DB_PATH` — у дневника своя БД `data/diary.sqlite` (путь
 * `DIARY_DB_PATH`). Хранит метаданные и markdown-контент событий; изображения
 * событий живут на диске в `images/<folder>/` (`DIARY_IMAGES_DIR`).
 *
 * Конвенции: WAL, foreign_keys, busy_timeout; строки — Record<string, ...>
 * (двойной каст в репозитории); `db.transaction()` не реализован → ручные
 * BEGIN/COMMIT/ROLLBACK; `mkdirSync` обязателен до `new DatabaseSync()`.
 */

let dbInstance: DatabaseSync | null = null;

function openDatabase(): DatabaseSync {
  const dbPath = resolve(env.DIARY_DB_PATH);
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');

  db.exec(`
    CREATE TABLE IF NOT EXISTS diary_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      date_start  TEXT    NOT NULL,          -- ГГГГ-ММ-ДД (начало события)
      date_end    TEXT,                      -- ГГГГ-ММ-ДД (конец периода, опционально)
      summary     TEXT    NOT NULL DEFAULT '', -- краткое описание (карточка)
      content     TEXT    NOT NULL DEFAULT '', -- подробное описание (markdown)
      folder      TEXT    NOT NULL,          -- уникальная папка изображений события
      cover       TEXT,                      -- имя файла основной фотографии (в папке события)
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

/** Синглтон-инстанс БД дневника (открывается лениво). */
export function getDiaryDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = openDatabase();
  }
  return dbInstance;
}

/** Закрыть соединение (для тестов/скриптов). */
export function closeDiaryDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
