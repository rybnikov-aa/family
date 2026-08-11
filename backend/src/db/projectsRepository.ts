import { getProjectsDb } from './projectsDatabase';

/**
 * Строка таблицы `projects` (SQLite, раздел «Проекты»).
 * Хранит метаданные и markdown-контент проектов, созданных через UI
 * (`POST /api/projects`). Встроенные проекты («Ремонт») в БД не хранятся —
 * они в реестре `config/appProjects.ts`.
 */
export interface ProjectRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  accent: string;
  icon: string;
  /** Порядок в списке: меньше — раньше. */
  order_num: number;
  /** Markdown-контент страницы проекта. */
  content: string;
  created_at: string;
  updated_at: string;
}

/** Входные данные для вставки/обновления строки проекта. */
export interface ProjectRowInput {
  slug: string;
  title: string;
  description: string;
  accent: string;
  icon: string;
  order: number;
  content: string;
}

/** Двойной каст строки SQLite → типизированная модель. */
const toRow = (value: unknown): ProjectRow => value as unknown as ProjectRow;

/** Все проекты, отсортированные по порядку, затем по названию (без учёта регистра). */
export function listProjectRows(): ProjectRow[] {
  const db = getProjectsDb();
  const rows = db
    .prepare('SELECT * FROM projects ORDER BY order_num ASC, title COLLATE NOCASE ASC')
    .all();
  return rows.map(toRow);
}

/** Проект по slug (латиница, цифры, дефисы); `null` — не найден. */
export function getProjectRow(slug: string): ProjectRow | null {
  const db = getProjectsDb();
  const row = db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug);
  return row ? toRow(row) : null;
}

/**
 * Создаёт проект. При нарушении UNIQUE (slug уже занят) пробрасывает
 * SQLite-ошибку — признак конфликта проверяет сервис через `isConstraintError`.
 */
export function createProjectRow(input: ProjectRowInput): void {
  const db = getProjectsDb();
  db.prepare(
    `INSERT INTO projects (slug, title, description, accent, icon, order_num, content)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.slug,
    input.title,
    input.description,
    input.accent,
    input.icon,
    input.order,
    input.content,
  );
}

/**
 * Обновляет метаданные и/или контент проекта. Обновляются только заданные
 * поля (`undefined` не трогает). Возвращает обновлённую строку или `null`.
 */
export function updateProjectRow(
  slug: string,
  patch: Partial<
    Pick<ProjectRowInput, 'title' | 'description' | 'accent' | 'icon' | 'order' | 'content'>
  >,
): ProjectRow | null {
  const db = getProjectsDb();
  const current = getProjectRow(slug);
  if (!current) return null;

  const next = {
    title: patch.title ?? current.title,
    description: patch.description ?? current.description,
    accent: patch.accent ?? current.accent,
    icon: patch.icon ?? current.icon,
    order: patch.order ?? current.order_num,
    content: patch.content ?? current.content,
  };

  db.prepare(
    `UPDATE projects
     SET title = ?, description = ?, accent = ?, icon = ?, order_num = ?, content = ?,
         updated_at = datetime('now')
     WHERE slug = ?`,
  ).run(next.title, next.description, next.accent, next.icon, next.order, next.content, slug);

  return getProjectRow(slug);
}

/** Удаляет проект. Возвращает `false`, если записи не было. */
export function deleteProjectRow(slug: string): boolean {
  const db = getProjectsDb();
  const result = db.prepare('DELETE FROM projects WHERE slug = ?').run(slug);
  return result.changes > 0;
}
