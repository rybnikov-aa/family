import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from '../config/env';

/**
 * Отдельное SQLite-хранилище отчётности проекта «Ремонт» (модуль renovation).
 *
 * Это **не** `DB_PATH` (`data/vps.sqlite`) — у модуля своя БД
 * `data/renovation.sqlite` (путь `RENOVATION_DB_PATH`). Обе БД сохраняются
 * при деплое (`server/data/`). Наполняется штатно — через импорт PDF в
 * приложении (POST /api/renovation/pdf); схема задана здесь, в этом файле.
 *
 * Конвенции: WAL, foreign_keys, busy_timeout; строки — Record<string, ...>
 * (двойной каст в репозитории); `db.transaction()` не реализован → ручные
 * BEGIN/COMMIT/ROLLBACK; `mkdirSync` обязателен до `new DatabaseSync()`.
 */

let dbInstance: DatabaseSync | null = null;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS renovation_meta (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    object        TEXT NOT NULL DEFAULT '',
    contract_no   TEXT,
    contract_date TEXT,
    contractor    TEXT,
    start_date    TEXT,
    deadline_days INTEGER,
    area          TEXT
  );

  CREATE TABLE IF NOT EXISTS estimate_versions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    kind              TEXT    NOT NULL,
    date              TEXT,
    label             TEXT    NOT NULL DEFAULT '',
    total             INTEGER,
    total_no_overhead INTEGER,
    overhead          INTEGER,
    addendum_ref      TEXT,
    source_path       TEXT,
    pdf_path          TEXT,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS estimate_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL REFERENCES estimate_versions(id) ON DELETE CASCADE,
    position   INTEGER,
    section    TEXT    NOT NULL DEFAULT '',
    name       TEXT    NOT NULL,
    unit       TEXT,
    price      INTEGER,
    qty        INTEGER,
    sum        INTEGER,
    change     TEXT    NOT NULL DEFAULT 'none'
  );
  CREATE INDEX IF NOT EXISTS idx_estimate_items_version ON estimate_items(version_id);

  CREATE TABLE IF NOT EXISTS renovation_docs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    type                TEXT    NOT NULL,
    number              TEXT,
    date                TEXT    NOT NULL,
    title               TEXT    NOT NULL DEFAULT '',
    total               INTEGER,
    overhead            INTEGER,
    total_with_overhead INTEGER,
    source_path         TEXT,
    pdf_path            TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS renovation_doc_items (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id   INTEGER NOT NULL REFERENCES renovation_docs(id) ON DELETE CASCADE,
    position INTEGER,
    section  TEXT    NOT NULL DEFAULT '',
    name     TEXT    NOT NULL,
    unit     TEXT,
    price    INTEGER,
    qty      INTEGER,
    sum      INTEGER,
    kind     TEXT    NOT NULL DEFAULT 'row'
  );
  CREATE INDEX IF NOT EXISTS idx_doc_items_doc ON renovation_doc_items(doc_id);

  CREATE TABLE IF NOT EXISTS settlement_acts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL,
    date        TEXT NOT NULL,
    source_path TEXT,
    pdf_path    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS settlement_rows (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    act_id   INTEGER NOT NULL REFERENCES settlement_acts(id) ON DELETE CASCADE,
    position INTEGER,
    kind     TEXT NOT NULL DEFAULT 'row',
    row_date TEXT,
    reason   TEXT,
    paid_in  INTEGER,
    used     INTEGER,
    balance  INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_settlement_rows_act ON settlement_rows(act_id);

  -- Настройки модуля (ключ-значение): бюджет на материалы и т.п.
  CREATE TABLE IF NOT EXISTS renovation_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

function openDatabase(): DatabaseSync {
  const dbPath = resolve(env.RENOVATION_DB_PATH ?? 'data/renovation.sqlite');
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(SCHEMA);
  return db;
}

/** Синглтон-инстанс БД модуля «Ремонт» (открывается лениво). */
export function getRenovationDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = openDatabase();
  }
  return dbInstance;
}

/** Закрыть соединение (для тестов/скриптов). */
export function closeRenovationDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
