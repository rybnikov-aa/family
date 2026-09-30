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
      place       TEXT    NOT NULL DEFAULT '', -- место события
      participants_json TEXT NOT NULL DEFAULT '[]', -- участники события
      folder      TEXT    NOT NULL,          -- уникальная папка изображений события
      cover       TEXT,                      -- имя файла основной фотографии (в папке события)
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS diary_tags (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );

    CREATE TABLE IF NOT EXISTS diary_event_tags (
      event_id INTEGER NOT NULL REFERENCES diary_events(id) ON DELETE CASCADE,
      tag_id   INTEGER NOT NULL REFERENCES diary_tags(id) ON DELETE CASCADE,
      PRIMARY KEY (event_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_diary_event_tags_tag_id ON diary_event_tags(tag_id);

    CREATE TABLE IF NOT EXISTS diary_albums (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS diary_album_events (
      album_id INTEGER NOT NULL REFERENCES diary_albums(id) ON DELETE CASCADE,
      event_id INTEGER NOT NULL REFERENCES diary_events(id) ON DELETE CASCADE,
      PRIMARY KEY (album_id, event_id)
    );

    CREATE INDEX IF NOT EXISTS idx_diary_album_events_event_id ON diary_album_events(event_id);
  `);

  // Миграция существующей БД, созданной до появления полей расширенного дневника.
  for (const sql of [
    "ALTER TABLE diary_events ADD COLUMN place TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE diary_events ADD COLUMN participants_json TEXT NOT NULL DEFAULT '[]'",
  ]) {
    try {
      db.exec(sql);
    } catch {
      // Поле уже добавлено — база актуальна.
    }
  }

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
