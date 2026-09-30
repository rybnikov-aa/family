import { getDiaryDb } from './diaryDatabase';

/**
 * Строка таблицы `diary_events` (SQLite, раздел «Дневник»).
 * Хранит метаданные и markdown-контент события; изображения — на диске
 * в папке `folder` (см. `services/diary/imageStore.ts`).
 */
export interface DiaryEventRow {
  id: number;
  title: string;
  date_start: string;
  date_end: string | null;
  summary: string;
  content: string;
  place: string;
  participants_json: string;
  tags: string[];
  folder: string;
  cover: string | null;
  created_at: string;
  updated_at: string;
}

/** Входные данные для вставки/обновления строки события. */
export interface DiaryEventRowInput {
  title: string;
  dateStart: string;
  dateEnd: string | null;
  summary: string;
  content: string;
  place: string;
  participants: string[];
  folder: string;
  cover: string | null;
}

/** Двойной каст строки SQLite → типизированная модель. */
const toRow = (value: unknown): DiaryEventRow => ({
  ...(value as unknown as Omit<DiaryEventRow, 'tags'>),
  tags: [],
});

function withTags(row: DiaryEventRow): DiaryEventRow {
  const tags = getDiaryDb()
    .prepare(
      `SELECT t.name FROM diary_tags t
       INNER JOIN diary_event_tags et ON et.tag_id = t.id
       WHERE et.event_id = ? ORDER BY t.name COLLATE NOCASE`,
    )
    .all(row.id) as unknown as { name: string }[];
  return { ...row, tags: tags.map((tag) => tag.name) };
}

/**
 * Все события, отсортированные по дате начала (свежие — раньше),
 * при равных датах — по id (свежее созданное — раньше).
 */
export function listDiaryEventRows(): DiaryEventRow[] {
  const db = getDiaryDb();
  const rows = db.prepare('SELECT * FROM diary_events ORDER BY date_start DESC, id DESC').all();
  return rows.map((row) => withTags(toRow(row)));
}

/** Событие по id; `null` — не найдено. */
export function getDiaryEventRow(id: number): DiaryEventRow | null {
  const db = getDiaryDb();
  const row = db.prepare('SELECT * FROM diary_events WHERE id = ?').get(id);
  return row ? withTags(toRow(row)) : null;
}

/** Создаёт событие и возвращает созданную строку. */
export function createDiaryEventRow(input: DiaryEventRowInput): DiaryEventRow {
  const db = getDiaryDb();
  db.prepare(
    `INSERT INTO diary_events (title, date_start, date_end, summary, content, place, participants_json, folder, cover)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.title,
    input.dateStart,
    input.dateEnd,
    input.summary,
    input.content,
    input.place,
    JSON.stringify(input.participants),
    input.folder,
    input.cover,
  );
  const row = db.prepare('SELECT * FROM diary_events WHERE folder = ?').get(input.folder);
  const inserted = row as unknown as { id: number };
  return getDiaryEventRow(inserted.id) as DiaryEventRow;
}

/**
 * Обновляет событие. Обновляются только заданные поля (`undefined` не трогает).
 * Возвращает обновлённую строку или `null`, если события не было.
 */
export function updateDiaryEventRow(
  id: number,
  patch: Partial<
    Pick<
      DiaryEventRowInput,
      | 'title'
      | 'dateStart'
      | 'dateEnd'
      | 'summary'
      | 'content'
      | 'place'
      | 'participants'
      | 'folder'
      | 'cover'
    >
  >,
): DiaryEventRow | null {
  const db = getDiaryDb();
  const current = getDiaryEventRow(id);
  if (!current) return null;

  const next = {
    title: patch.title ?? current.title,
    dateStart: patch.dateStart ?? current.date_start,
    dateEnd: patch.dateEnd !== undefined ? patch.dateEnd : current.date_end,
    summary: patch.summary ?? current.summary,
    content: patch.content ?? current.content,
    place: patch.place ?? current.place,
    participants: patch.participants ?? parseParticipants(current.participants_json),
    folder: patch.folder ?? current.folder,
    cover: patch.cover !== undefined ? patch.cover : current.cover,
  };

  db.prepare(
    `UPDATE diary_events
     SET title = ?, date_start = ?, date_end = ?, summary = ?, content = ?, place = ?, participants_json = ?, folder = ?, cover = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    next.title,
    next.dateStart,
    next.dateEnd,
    next.summary,
    next.content,
    next.place,
    JSON.stringify(next.participants),
    next.folder,
    next.cover,
    id,
  );

  return getDiaryEventRow(id);
}

function parseParticipants(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export function replaceDiaryEventTags(eventId: number, names: string[]): void {
  const db = getDiaryDb();
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM diary_event_tags WHERE event_id = ?').run(eventId);
    for (const name of names) {
      db.prepare('INSERT OR IGNORE INTO diary_tags (name) VALUES (?)').run(name);
      const tag = db
        .prepare('SELECT id FROM diary_tags WHERE name = ? COLLATE NOCASE')
        .get(name) as unknown as { id: number };
      db.prepare('INSERT INTO diary_event_tags (event_id, tag_id) VALUES (?, ?)').run(
        eventId,
        tag.id,
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Удаляет событие. Возвращает `false`, если записи не было. */
export function deleteDiaryEventRow(id: number): boolean {
  const db = getDiaryDb();
  const result = db.prepare('DELETE FROM diary_events WHERE id = ?').run(id);
  return result.changes > 0;
}
