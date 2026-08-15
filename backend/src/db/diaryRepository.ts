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
  folder: string;
  cover: string | null;
}

/** Двойной каст строки SQLite → типизированная модель. */
const toRow = (value: unknown): DiaryEventRow => value as unknown as DiaryEventRow;

/**
 * Все события, отсортированные по дате начала (свежие — раньше),
 * при равных датах — по id (свежее созданное — раньше).
 */
export function listDiaryEventRows(): DiaryEventRow[] {
  const db = getDiaryDb();
  const rows = db.prepare('SELECT * FROM diary_events ORDER BY date_start DESC, id DESC').all();
  return rows.map(toRow);
}

/** Событие по id; `null` — не найдено. */
export function getDiaryEventRow(id: number): DiaryEventRow | null {
  const db = getDiaryDb();
  const row = db.prepare('SELECT * FROM diary_events WHERE id = ?').get(id);
  return row ? toRow(row) : null;
}

/** Создаёт событие и возвращает созданную строку. */
export function createDiaryEventRow(input: DiaryEventRowInput): DiaryEventRow {
  const db = getDiaryDb();
  db.prepare(
    `INSERT INTO diary_events (title, date_start, date_end, summary, content, folder, cover)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.title,
    input.dateStart,
    input.dateEnd,
    input.summary,
    input.content,
    input.folder,
    input.cover,
  );
  const row = db.prepare('SELECT * FROM diary_events WHERE folder = ?').get(input.folder);
  return toRow(row);
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
      'title' | 'dateStart' | 'dateEnd' | 'summary' | 'content' | 'folder' | 'cover'
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
    folder: patch.folder ?? current.folder,
    cover: patch.cover !== undefined ? patch.cover : current.cover,
  };

  db.prepare(
    `UPDATE diary_events
     SET title = ?, date_start = ?, date_end = ?, summary = ?, content = ?, folder = ?, cover = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    next.title,
    next.dateStart,
    next.dateEnd,
    next.summary,
    next.content,
    next.folder,
    next.cover,
    id,
  );

  return getDiaryEventRow(id);
}

/** Удаляет событие. Возвращает `false`, если записи не было. */
export function deleteDiaryEventRow(id: number): boolean {
  const db = getDiaryDb();
  const result = db.prepare('DELETE FROM diary_events WHERE id = ?').run(id);
  return result.changes > 0;
}
