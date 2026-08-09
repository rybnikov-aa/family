import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { env } from '../config/env';
import { APP_PROJECTS } from '../config/appProjects';
import { buildProjectHtml } from './projectsTemplate';

/** Ошибка с HTTP-статусом — для ответов 400/413 и т.п. */
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
 * Проект — это подпапка в каталоге `PROJECTS_DIR` (папка проектов на сервере,
 * по умолчанию `public_html/projects`) с файлом `index.html`. Страницы проекта
 * обслуживаются по `/projects/<slug>/`. Метаданные для списка берутся из
 * самого `index.html`:
 *
 *   <title>…</title>                                  — название (заголовок вкладки)
 *   <meta name="project-title" content="Ремонт">      — короткое название для карточки (приоритетнее `<title>`)
 *   <meta name="description" content="…">             — описание
 *   <meta name="project-accent" content="#e8872e">    — акцентный цвет карточки (необязательно)
 *   <meta name="project-icon" content="renovation">    — имя иконки в списке (необязательно)
 *   <meta name="project-order" content="0">           — порядок в списке (необязательно)
 */
export interface ProjectInfo {
  slug: string;
  title: string;
  description: string;
  accent: string;
  /** Имя иконки из `<meta name="project-icon">` (например, `renovation`); пусто — иконка по умолчанию. */
  icon: string;
  /**
   * Тип проекта:
   * - `static` — статичная подпапка `PROJECTS_DIR` с `index.html`;
   * - `app` — прикладной (SPA) проект из реестра `config/appProjects.ts`.
   */
  kind: 'static' | 'app';
  /** URL назначения карточки: `/projects/<slug>/` (статичный) или внутренний маршрут приложения без `#` (прикладной). */
  url: string;
  order: number;
}

/** Каталоги, которые не считаются проектами (служебные/скрытые: `_template`, `.well-known` и т.п.). */
const SKIP_PREFIXES = ['.', '_'];

/** Сколько кэшировать список проектов (сканирование ФС — не на каждый запрос). */
const TTL_MS = 60_000;

let cache: { at: number; projects: ProjectInfo[] } | null = null;

/** Значение `content` у `<meta name="…">`. */
function readMeta(html: string, name: string): string | null {
  const re = new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']`, 'i');
  const match = html.match(re);
  return match ? match[1] : null;
}

/** Текст тега `<title>`. */
function readTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : '';
}

/**
 * Собирает список проектов из каталога `env.PROJECTS_DIR` (подпапки с
 * `index.html`), сортирует по `project-order`, затем по названию.
 * Результат кэшируется на `TTL_MS`; `force` сбрасывает кэш.
 */
export function listProjects(force = false): ProjectInfo[] {
  if (!force && cache && Date.now() - cache.at < TTL_MS) {
    return cache.projects;
  }

  const root = resolve(env.PROJECTS_DIR);
  const projects: ProjectInfo[] = [];

  // Прикладные (SPA) проекты из реестра перекрывают статичные папки с тем же
  // slug (strangler fig): карточка переехавшего проекта не зависит от статики.
  const appBySlug = new Map(APP_PROJECTS.map((p) => [p.slug, p]));

  if (existsSync(root)) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (SKIP_PREFIXES.some((prefix) => entry.name.startsWith(prefix))) continue;
      if (appBySlug.has(entry.name)) continue;

      const indexFile = join(root, entry.name, 'index.html');
      if (!existsSync(indexFile)) continue;

      try {
        const html = readFileSync(indexFile, 'utf8');
        const rawOrder = readMeta(html, 'project-order');
        projects.push({
          slug: entry.name,
          kind: 'static',
          title: readMeta(html, 'project-title') ?? (readTitle(html) || entry.name),
          description: readMeta(html, 'description') ?? '',
          accent: readMeta(html, 'project-accent') ?? '#3b82f6',
          icon: readMeta(html, 'project-icon') ?? '',
          // Папка проектов зеркалится деплоем в `public_html/projects/` и
          // обслуживается по `/projects/` → URL проекта — `/projects/<slug>/`.
          url: `/projects/${entry.name}/`,
          order: rawOrder === null ? Number.MAX_SAFE_INTEGER : Number(rawOrder) || 0,
        });
      } catch {
        // Нечитаемый index.html — проект пропускаем.
      }
    }
  }

  // Прикладные проекты из реестра — отображаются независимо от статики PROJECTS_DIR.
  for (const app of APP_PROJECTS) {
    projects.push({
      slug: app.slug,
      kind: 'app',
      title: app.title,
      description: app.description,
      accent: app.accent,
      icon: app.icon,
      // Внутренний маршрут приложения (hash-роутинг, без `#`), например `/projects/renovation`.
      url: app.route,
      order: app.order,
    });
  }

  projects.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ru'));
  cache = { at: Date.now(), projects };
  return projects;
}

/** Входные данные для создания статичного проекта (`POST /api/projects`). */
export interface CreateProjectInput {
  /** Имя папки проекта: латиница, цифры и дефисы (например `dacha`). */
  slug: string;
  /** Название для карточки списка и страницы проекта. */
  title: string;
  /** Описание для карточки списка. */
  description: string;
  /** Акцентный цвет карточки (`#RRGGBB`), по умолчанию `#3b82f6`. */
  accent?: string;
  /** Имя иконки: `renovation` | `folder` | `projects`, по умолчанию `projects`. */
  icon?: string;
  /** Порядок в списке (целое ≥ 0); не задано — проект уходит в конец списка. */
  order?: number;
}

/** Допустимое имя папки проекта (slug): латиница, цифры, дефисы, без `_`/`.` в начале. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Допустимый акцентный цвет (`#RRGGBB`). */
const ACCENT_RE = /^#[0-9a-fA-F]{6}$/;
/** Допустимые иконки карточки (маппятся на фронтенде в `projectIcons`). */
const PROJECT_ICONS = ['renovation', 'folder', 'projects'];
/** Акцентный цвет по умолчанию (как в `projects/_template`). */
const DEFAULT_ACCENT = '#3b82f6';

/**
 * Создаёт статичный проект: подпапку `PROJECTS_DIR/<slug>/` с `index.html`
 * из встроенного шаблона (`projectsTemplate.ts`, аналог `projects/_template`).
 * Валидирует входные данные, сбрасывает кэш списка и возвращает метаданные
 * созданного проекта (201). Ошибки — `HttpError` (400/409).
 */
export function createProject(input: CreateProjectInput): ProjectInfo {
  const slug = input.slug.trim();
  const title = input.title.trim();
  const description = input.description.trim();
  const accent = (input.accent ?? '').trim().toLowerCase() || DEFAULT_ACCENT;
  const icon = (input.icon ?? '').trim() || 'projects';
  const { order } = input;

  if (!SLUG_RE.test(slug)) {
    throw new HttpError(
      400,
      'Недопустимое имя проекта: латиница, цифры и дефисы (например «dacha» или «trip-2026»).',
    );
  }
  if (slug.startsWith('_') || slug.startsWith('.')) {
    throw new HttpError(400, 'Недопустимое имя проекта');
  }
  if (title === '') {
    throw new HttpError(400, 'Укажите название проекта');
  }
  if (description === '') {
    throw new HttpError(400, 'Укажите описание проекта');
  }
  if (!ACCENT_RE.test(accent)) {
    throw new HttpError(400, 'Акцентный цвет должен быть в формате #RRGGBB');
  }
  if (!PROJECT_ICONS.includes(icon)) {
    throw new HttpError(400, 'Недопустимая иконка проекта');
  }
  if (order !== undefined && (!Number.isInteger(order) || order < 0)) {
    throw new HttpError(400, 'Порядок должен быть неотрицательным целым числом');
  }

  const root = resolve(env.PROJECTS_DIR);
  const dir = join(root, slug);
  // Slug уже проверен регуляркой (без `..`/`_`/`.` в начале), дополнительный
  // контроль — чтобы создание шло строго внутри `PROJECTS_DIR`.
  const rel = relative(root, dir);
  if (rel.startsWith('..') || rel.split(sep).some((s) => s.startsWith('_') || s.startsWith('.'))) {
    throw new HttpError(400, 'Недопустимое имя проекта');
  }

  // Занятое имя: существующая статичная папка или запись в реестре прикладных
  // проектов (реестр перекрывает статику по slug — дубликат недопустим).
  if (existsSync(join(dir, 'index.html')) || APP_PROJECTS.some((p) => p.slug === slug)) {
    throw new HttpError(409, 'Проект с таким именем уже существует');
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'index.html'),
    buildProjectHtml({ title, description, accent, icon, order }),
    'utf8',
  );

  // Новый проект должен сразу появиться в списке — сбрасываем кэш сканирования.
  cache = null;

  return {
    slug,
    kind: 'static',
    title,
    description,
    accent,
    icon,
    url: `/projects/${slug}/`,
    order: order ?? Number.MAX_SAFE_INTEGER,
  };
}
