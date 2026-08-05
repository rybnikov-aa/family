import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { env } from '../config/env';

/**
 * Метаданные проекта (раздел «Проекты»).
 *
 * Проект — это подпапка на сервере (в каталоге `PROJECTS_DIR`) с файлом
 * `index.html`. Метаданные для списка берутся из самого `index.html`:
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
          url: `/${entry.name}/`,
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
