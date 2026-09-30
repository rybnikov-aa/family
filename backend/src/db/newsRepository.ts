import { getNewsDb } from './newsDatabase';

export interface NewsAttachmentRow {
  id: number;
  post_id: number;
  folder: string;
  file_name: string;
  original_name: string;
  mime_type: string;
}

export interface NewsPostRow {
  id: number;
  title: string;
  tag: string;
  text: string;
  publish_at: string;
  pinned: number;
  created_at: string;
  updated_at: string;
  attachments: NewsAttachmentRow[];
  read: boolean;
}

const toPost = (value: unknown): NewsPostRow => ({
  ...(value as unknown as Omit<NewsPostRow, 'attachments' | 'read'>),
  attachments: [],
  read: false,
});

function withRelations(row: NewsPostRow, userId: number): NewsPostRow {
  const db = getNewsDb();
  const attachments = db
    .prepare('SELECT * FROM news_attachments WHERE post_id = ? ORDER BY id')
    .all(row.id) as unknown as NewsAttachmentRow[];
  const read = Boolean(
    db.prepare('SELECT 1 FROM news_reads WHERE post_id = ? AND user_id = ?').get(row.id, userId),
  );
  return { ...row, attachments, read };
}

export function listNewsRows(userId: number, includeUnpublished: boolean): NewsPostRow[] {
  const where = includeUnpublished ? '' : "WHERE publish_at <= datetime('now')";
  return getNewsDb()
    .prepare(`SELECT * FROM news_posts ${where} ORDER BY pinned DESC, publish_at DESC, id DESC`)
    .all()
    .map((row) => withRelations(toPost(row), userId));
}

export function getNewsRow(id: number, userId: number): NewsPostRow | null {
  const row = getNewsDb().prepare('SELECT * FROM news_posts WHERE id = ?').get(id);
  return row ? withRelations(toPost(row), userId) : null;
}

export function createNewsRow(input: {
  title: string;
  tag: string;
  text: string;
  publishAt: string;
  pinned: boolean;
}): NewsPostRow {
  const db = getNewsDb();
  const result = db
    .prepare('INSERT INTO news_posts (title, tag, text, publish_at, pinned) VALUES (?, ?, ?, ?, ?)')
    .run(input.title, input.tag, input.text, input.publishAt, input.pinned ? 1 : 0);
  return getNewsRow(Number(result.lastInsertRowid), 0) as NewsPostRow;
}

export function updateNewsRow(
  id: number,
  input: { title: string; tag: string; text: string; publishAt: string; pinned: boolean },
): NewsPostRow | null {
  const db = getNewsDb();
  if (!getNewsDb().prepare('SELECT 1 FROM news_posts WHERE id = ?').get(id)) return null;
  db.prepare(
    "UPDATE news_posts SET title = ?, tag = ?, text = ?, publish_at = ?, pinned = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(input.title, input.tag, input.text, input.publishAt, input.pinned ? 1 : 0, id);
  return getNewsRow(id, 0);
}

export function deleteNewsRow(id: number): boolean {
  return getNewsDb().prepare('DELETE FROM news_posts WHERE id = ?').run(id).changes > 0;
}

export function addNewsAttachment(row: Omit<NewsAttachmentRow, 'id'>): void {
  getNewsDb()
    .prepare(
      'INSERT INTO news_attachments (post_id, folder, file_name, original_name, mime_type) VALUES (?, ?, ?, ?, ?)',
    )
    .run(row.post_id, row.folder, row.file_name, row.original_name, row.mime_type);
}

export function deleteNewsAttachment(id: number): NewsAttachmentRow | null {
  const db = getNewsDb();
  const row = db.prepare('SELECT * FROM news_attachments WHERE id = ?').get(id) as unknown as
    NewsAttachmentRow | undefined;
  if (!row) return null;
  db.prepare('DELETE FROM news_attachments WHERE id = ?').run(id);
  return row;
}

export function markNewsRead(postId: number, userId: number): void {
  getNewsDb()
    .prepare('INSERT OR IGNORE INTO news_reads (post_id, user_id) VALUES (?, ?)')
    .run(postId, userId);
}
