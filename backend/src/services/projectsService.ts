import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { env } from '../config/env';

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
  /** URL страницы проекта на сервере: `/projects/<slug>/` (например, `/projects/renovation/`). */
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

  if (existsSync(root)) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (SKIP_PREFIXES.some((prefix) => entry.name.startsWith(prefix))) continue;

      const indexFile = join(root, entry.name, 'index.html');
      if (!existsSync(indexFile)) continue;

      try {
        const html = readFileSync(indexFile, 'utf8');
        const rawOrder = readMeta(html, 'project-order');
        projects.push({
          slug: entry.name,
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

  projects.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ru'));
  cache = { at: Date.now(), projects };
  return projects;
}

/**
 * Список подпапок внутри `PROJECTS_DIR` (относительные пути через `/`,
 * например `renovation/pdf/00 Дизайн-проект`). Служебные папки (`_*`/`.*`)
 * пропускаются — их нет и в списке проектов. Нужен для выбора папки загрузки.
 */
export function listProjectDirs(): string[] {
  const root = resolve(env.PROJECTS_DIR);
  const dirs: string[] = [];

  const walk = (current: string): void => {
    try {
      const entries = readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
        dirs.push(relative(root, join(current, entry.name)).split(sep).join('/'));
        walk(join(current, entry.name));
      }
    } catch {
      // Папка недоступна/удалена — пропускаем.
    }
  };

  if (existsSync(root)) walk(root);
  dirs.sort((a, b) => a.localeCompare(b, 'ru'));
  return dirs;
}

/** Нормализует имя файла: убирает пути и управляющие символы, гарантирует расширение `.pdf`. */
function sanitizeFileName(name: string): string {
  let base = name
    .replace(/^.*[\\/]/, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  if (base === '') base = 'document.pdf';
  if (!base.toLowerCase().endsWith('.pdf')) base += '.pdf';
  return base;
}

/**
 * Безопасно резолвит папку назначения внутри `PROJECTS_DIR`.
 * Отклоняет абсолютные пути, выход за границы (`..`) и служебные папки (`_*`/`.*`).
 */
function resolveUploadDir(folderRaw: unknown): string {
  if (typeof folderRaw !== 'string' || folderRaw.trim() === '') {
    throw new HttpError(400, 'Не указана папка назначения');
  }
  const folder = folderRaw
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
  if (folder === '') {
    throw new HttpError(400, 'Не указана папка назначения');
  }

  const root = resolve(env.PROJECTS_DIR);
  const target = resolve(root, folder);
  const rel = relative(root, target);
  const segments = rel.split(sep).filter(Boolean);

  const unsafe =
    rel.startsWith('..') ||
    segments.some((s) => s === '..' || s.startsWith('.') || s.startsWith('_'));
  if (unsafe) {
    throw new HttpError(400, 'Недопустимая папка назначения');
  }

  return target;
}

/** Загружаемый файл (PDF), уже прошедший multer. */
export interface PdfUploadFile {
  /** Имя файла (UTF-8, из JS `file.name`); при отсутствии используется `document.pdf`. */
  name?: string;
  buffer: Buffer;
}

/**
 * Сохраняет PDF в указанную папку внутри `PROJECTS_DIR` (вариант «просто доставка»).
 * Папка создаётся при необходимости. Возвращает URL файла на сервере.
 */
export function savePdf(folderRaw: unknown, file: PdfUploadFile | undefined): { url: string } {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new HttpError(400, 'Файл не выбран');
  }
  const targetDir = resolveUploadDir(folderRaw);
  const fileName = sanitizeFileName(file.name ?? '');

  mkdirSync(targetDir, { recursive: true });
  writeFileSync(join(targetDir, fileName), file.buffer);

  const rel = relative(resolve(env.PROJECTS_DIR), targetDir).split(sep).join('/');
  const encodedFolder = rel.split('/').map(encodeURIComponent).join('/');
  return { url: `/projects/${encodedFolder}/${encodeURIComponent(fileName)}` };
}
