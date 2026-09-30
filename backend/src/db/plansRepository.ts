import { getPlansDb } from './plansDatabase';

export type PlanStatus = 'todo' | 'doing' | 'done';
export type PlanPriority = 'low' | 'normal' | 'high';
export type PlanRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface PlanRow {
  id: number;
  title: string;
  description: string;
  status: PlanStatus;
  priority: PlanPriority;
  due_date: string | null;
  recurrence: PlanRecurrence;
  project_slug: string | null;
  created_at: string;
  updated_at: string;
}

const toRow = (value: unknown): PlanRow => value as unknown as PlanRow;

export function listPlanRows(projectSlug?: string, priority?: PlanPriority): PlanRow[] {
  const clauses: string[] = [];
  const params: string[] = [];
  if (projectSlug) {
    clauses.push('project_slug = ?');
    params.push(projectSlug);
  }
  if (priority) {
    clauses.push('priority = ?');
    params.push(priority);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = getPlansDb()
    .prepare(
      `SELECT * FROM plan_tasks ${where}
       ORDER BY CASE status WHEN 'doing' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END,
                CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, id DESC`,
    )
    .all(...params);
  return rows.map(toRow);
}

export function getPlanRow(id: number): PlanRow | null {
  const row = getPlansDb().prepare('SELECT * FROM plan_tasks WHERE id = ?').get(id);
  return row ? toRow(row) : null;
}

export interface PlanRowInput {
  title: string;
  description: string;
  status: PlanStatus;
  priority: PlanPriority;
  dueDate: string | null;
  recurrence: PlanRecurrence;
  projectSlug: string | null;
}

export function createPlanRow(input: PlanRowInput): PlanRow {
  const db = getPlansDb();
  const result = db
    .prepare(
      `INSERT INTO plan_tasks (title, description, status, priority, due_date, recurrence, project_slug)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.title,
      input.description,
      input.status,
      input.priority,
      input.dueDate,
      input.recurrence,
      input.projectSlug,
    );
  return getPlanRow(Number(result.lastInsertRowid)) as PlanRow;
}

export function updatePlanRow(id: number, patch: Partial<PlanRowInput>): PlanRow | null {
  const current = getPlanRow(id);
  if (!current) return null;
  const next = {
    title: patch.title ?? current.title,
    description: patch.description ?? current.description,
    status: patch.status ?? current.status,
    priority: patch.priority ?? current.priority,
    dueDate: patch.dueDate === undefined ? current.due_date : patch.dueDate,
    recurrence: patch.recurrence ?? current.recurrence,
    projectSlug: patch.projectSlug === undefined ? current.project_slug : patch.projectSlug,
  };
  getPlansDb()
    .prepare(
      `UPDATE plan_tasks SET title = ?, description = ?, status = ?, priority = ?,
      due_date = ?, recurrence = ?, project_slug = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(
      next.title,
      next.description,
      next.status,
      next.priority,
      next.dueDate,
      next.recurrence,
      next.projectSlug,
      id,
    );
  return getPlanRow(id);
}

export function deletePlanRow(id: number): boolean {
  return getPlansDb().prepare('DELETE FROM plan_tasks WHERE id = ?').run(id).changes > 0;
}
