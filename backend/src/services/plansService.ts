import { listProjects } from './projectsService';
import {
  createPlanRow,
  deletePlanRow,
  getPlanRow,
  listPlanRows,
  updatePlanRow,
  type PlanPriority,
  type PlanRow,
  type PlanStatus,
} from '../db/plansRepository';
import { HttpError } from './projectsService';

export interface PlanInput {
  title?: string;
  description?: string;
  status?: PlanStatus;
  priority?: PlanPriority;
  dueDate?: string | null;
  projectSlug?: string | null;
}

export interface PlanTask {
  id: number;
  title: string;
  description: string;
  status: PlanStatus;
  priority: PlanPriority;
  dueDate: string | null;
  projectSlug: string | null;
  projectTitle: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUSES: PlanStatus[] = ['todo', 'doing', 'done'];
const PRIORITIES: PlanPriority[] = ['low', 'normal', 'high'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  const date = value.trim();
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new HttpError(400, 'Срок должен быть корректной датой');
  }
  return date;
}

function normalizeProject(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  const slug = value.trim();
  const project = listProjects().find((item) => item.slug === slug);
  if (!project) throw new HttpError(400, 'Выбранный проект не найден');
  return slug;
}

function mapRow(row: PlanRow): PlanTask {
  const project = row.project_slug
    ? listProjects().find((item) => item.slug === row.project_slug)
    : null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    projectSlug: row.project_slug,
    projectTitle: project?.title ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizePatch(input: PlanInput, creating: boolean) {
  const title = input.title === undefined ? undefined : input.title.trim();
  if (creating && !title) throw new HttpError(400, 'Укажите название задачи');
  if (title !== undefined && !title) throw new HttpError(400, 'Укажите название задачи');
  if (input.status !== undefined && !STATUSES.includes(input.status)) {
    throw new HttpError(400, 'Недопустимый статус задачи');
  }
  if (input.priority !== undefined && !PRIORITIES.includes(input.priority)) {
    throw new HttpError(400, 'Недопустимый приоритет задачи');
  }
  const dueDate = normalizeDate(input.dueDate);
  const projectSlug = normalizeProject(input.projectSlug);
  return {
    ...(title !== undefined ? { title } : {}),
    ...(input.description !== undefined ? { description: input.description.trim() } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(projectSlug !== undefined ? { projectSlug } : {}),
  };
}

export function listPlans(projectSlug?: string, priority?: PlanPriority): PlanTask[] {
  return listPlanRows(projectSlug, priority).map(mapRow);
}

export function createPlan(input: PlanInput): PlanTask {
  const patch = normalizePatch(input, true);
  const row = createPlanRow({
    title: patch.title as string,
    description: patch.description ?? '',
    status: patch.status ?? 'todo',
    priority: patch.priority ?? 'normal',
    dueDate: patch.dueDate ?? null,
    projectSlug: patch.projectSlug ?? null,
  });
  return mapRow(row);
}

export function updatePlan(id: number, input: PlanInput): PlanTask {
  const patch = normalizePatch(input, false);
  const row = updatePlanRow(id, patch);
  if (!row) throw new HttpError(404, 'Задача не найдена');
  return mapRow(row);
}

export function deletePlan(id: number): void {
  if (!deletePlanRow(id)) throw new HttpError(404, 'Задача не найдена');
}

export function getPlan(id: number): PlanTask {
  const row = getPlanRow(id);
  if (!row) throw new HttpError(404, 'Задача не найдена');
  return mapRow(row);
}
