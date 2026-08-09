import { APP_PROJECTS, type AppProject } from '../config/appProjects';
import { isConstraintError } from '../db/errors';
import {
  createProjectRow,
  deleteProjectRow,
  getProjectRow,
  listProjectRows,
  updateProjectRow,
  type ProjectRow,
} from '../db/projectsRepository';

/** Ошибка с HTTP-статусом — для ответов 400/404/409 и т.п. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Метаданные проекта (раздел «Проекты»).
 *
 * Проект — это запись в БД (`projects`, созданные через UI) либо запись в
 * реестре встроенных проектов `config/appProjects.ts` («Ремонт»). Статичные
 * подпапки больше не используются: все проекты живут в приложении (kind: 'app').
 */
export interface ProjectInfo {
  slug: string;
  title: string;
  description: string;
  accent: string;
  /** Имя иконки из `projectIcons` на фронтенде (например `renovation`). */
  icon: string;
  /** Тип проекта — всегда `app` (проект в приложении). */
  kind: 'app';
  /** Внутренний маршрут приложения без `#` (hash-роутинг), например `/projects/renovation`. */
  url: string;
  order: number;
  /** Встроенные проекты (реестр) редактировать/удалять нельзя. */
  editable: boolean;
}

/** Полные данные проекта: метаданные + markdown-контент. */
export interface ProjectDetail extends ProjectInfo {
  /** Markdown-контент страницы проекта (пусто у встроенных проектов). */
  content: string;
}

/** Входные данные создания/обновления проекта (`POST`/`PATCH /api/projects`). */
export interface ProjectInput {
  /** Имя (slug): латиница, цифры и дефисы (например `dacha`). */
  slug: string;
  /** Название для карточки и страницы проекта. */
  title: string;
  /** Описание для карточки. */
  description: string;
  /** Акцентный цвет карточки (`#RRGGBB`), по умолчанию `#3b82f6`. */
  accent?: string;
  /** Имя иконки: `renovation` | `folder` | `projects`, по умолчанию `projects`. */
  icon?: string;
  /** Порядок в списке (целое ≥ 0); не задано — в конец. */
  order?: number;
  /** Markdown-контент страницы проекта (необязательно). */
  content?: string;
}

/** Допустимое имя проекта (slug): латиница, цифры, дефисы, без `_`/`.` в начале. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Допустимый акцентный цвет (`#RRGGBB`). */
const ACCENT_RE = /^#[0-9a-fA-F]{6}$/;
/** Допустимые иконки карточки (маппятся на фронтенде в `projectIcons`). */
const PROJECT_ICONS = ['renovation', 'folder', 'projects'];
/** Акцентный цвет по умолчанию. */
const DEFAULT_ACCENT = '#3b82f6';
/** Порядок по умолчанию — проект уходит в конец списка. */
const DEFAULT_ORDER = Number.MAX_SAFE_INTEGER;

/** Строка БД → метаданные прикладного проекта. */
function rowToInfo(row: ProjectRow): ProjectInfo {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    accent: row.accent,
    icon: row.icon,
    kind: 'app',
    url: `/projects/${row.slug}`,
    order: row.order_num,
    editable: true,
  };
}

/** Запись реестра → метаданные прикладного проекта. */
function registryToInfo(app: AppProject): ProjectInfo {
  return {
    slug: app.slug,
    title: app.title,
    description: app.description,
    accent: app.accent,
    icon: app.icon,
    kind: 'app',
    url: app.route,
    order: app.order,
    editable: false,
  };
}

/** Встроенный (реестровый) проект по slug. */
function findRegistry(slug: string): AppProject | undefined {
  return APP_PROJECTS.find((p) => p.slug === slug);
}

/** Нормализует и валидирует slug; кидает `HttpError(400)` при невалидном. */
function normalizeSlug(raw: string): string {
  const slug = raw.trim();
  if (!SLUG_RE.test(slug)) {
    throw new HttpError(
      400,
      'Недопустимое имя проекта: латиница, цифры и дефисы (например «dacha» или «trip-2026»).',
    );
  }
  return slug;
}

/** Нормализованные необязательные поля проекта (всегда конкретные значения). */
interface NormalizedOptional {
  accent: string;
  icon: string;
  order?: number;
  content: string;
}

/** Нормализует необязательные поля (цвет/иконка/порядок/контент). */
function normalizeOptional(input: ProjectInput): NormalizedOptional {
  const accent = (input.accent ?? '').trim().toLowerCase() || DEFAULT_ACCENT;
  const icon = (input.icon ?? '').trim() || 'projects';
  const { order, content } = input;

  if (!ACCENT_RE.test(accent)) {
    throw new HttpError(400, 'Акцентный цвет должен быть в формате #RRGGBB');
  }
  if (!PROJECT_ICONS.includes(icon)) {
    throw new HttpError(400, 'Недопустимая иконка проекта');
  }
  if (order !== undefined && (!Number.isInteger(order) || order < 0)) {
    throw new HttpError(400, 'Порядок должен быть неотрицательным целым числом');
  }

  return { accent, icon, order, content: content ?? '' };
}

/**
 * Список проектов: встроенный реестр `config/appProjects.ts` + созданные через
 * UI записи БД (`projects`). Сортировка по порядку, затем по названию (ru).
 * Скан файловой системы не выполняется — проекты живут в приложении.
 */
export function listProjects(): ProjectInfo[] {
  const projects: ProjectInfo[] = APP_PROJECTS.map(registryToInfo);
  projects.push(...listProjectRows().map(rowToInfo));
  projects.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ru'));
  return projects;
}

/** Полные данные проекта по slug (встроенный или из БД); 404 — не найден. */
export function getProject(slug: string): ProjectDetail {
  const registry = findRegistry(slug);
  if (registry) {
    return { ...registryToInfo(registry), content: '' };
  }
  const row = getProjectRow(slug);
  if (!row) {
    throw new HttpError(404, 'Проект не найден');
  }
  return { ...rowToInfo(row), content: row.content };
}

/**
 * Создаёт проект (admin): вставка в БД. Занятое имя (запись реестра или БД)
 * → 409; невалидные данные → 400. Ответ — метаданные созданного проекта (201).
 */
export function createProject(input: ProjectInput): ProjectInfo {
  const slug = normalizeSlug(input.slug);
  const title = input.title.trim();
  const description = input.description.trim();
  const { accent, icon, order, content } = normalizeOptional(input);

  if (title === '') {
    throw new HttpError(400, 'Укажите название проекта');
  }
  if (description === '') {
    throw new HttpError(400, 'Укажите описание проекта');
  }
  if (findRegistry(slug)) {
    throw new HttpError(409, 'Проект с таким именем уже существует');
  }

  try {
    createProjectRow({
      slug,
      title,
      description,
      accent,
      icon,
      order: order ?? DEFAULT_ORDER,
      content,
    });
  } catch (err) {
    if (isConstraintError(err)) {
      throw new HttpError(409, 'Проект с таким именем уже существует');
    }
    throw err;
  }

  const row = getProjectRow(slug);
  return rowToInfo(row as ProjectRow);
}

/**
 * Обновляет проект (admin): метаданные и/или markdown-контент. Встроенные
 * проекты (реестр) редактировать нельзя → 400; не найден → 404.
 */
export function updateProject(slug: string, input: ProjectInput): ProjectDetail {
  const normalized = normalizeSlug(slug);
  const { accent, icon, order, content } = normalizeOptional(input);

  if (findRegistry(normalized)) {
    throw new HttpError(400, 'Встроенный проект нельзя редактировать');
  }

  const patch: Parameters<typeof updateProjectRow>[1] = {
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description.trim() } : {}),
    ...(accent !== undefined ? { accent } : {}),
    ...(icon !== undefined ? { icon } : {}),
    ...(order !== undefined ? { order } : {}),
    ...(content !== undefined ? { content } : {}),
  };

  if (patch.title === '') {
    throw new HttpError(400, 'Укажите название проекта');
  }
  if (patch.description === '') {
    throw new HttpError(400, 'Укажите описание проекта');
  }

  const row = updateProjectRow(normalized, patch);
  if (!row) {
    throw new HttpError(404, 'Проект не найден');
  }
  return { ...rowToInfo(row), content: row.content };
}

/** Удаляет проект (admin). Встроенные проекты удалить нельзя → 400. */
export function deleteProject(slug: string): void {
  const normalized = normalizeSlug(slug);
  if (findRegistry(normalized)) {
    throw new HttpError(400, 'Встроенный проект нельзя удалить');
  }
  if (!deleteProjectRow(normalized)) {
    throw new HttpError(404, 'Проект не найден');
  }
}
