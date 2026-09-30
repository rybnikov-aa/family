import { FURNITURE_PROJECT_CONTENT } from './furnitureProjectContent';

/**
 * Реестр прикладных (SPA) проектов — карточки в разделе «Проекты» для встроенных
 * проектов приложения (например, «Ремонт» и «Мебель»).
 *
 * В отличие от проектов, созданных через UI (записи БД `projects`), встроенный
 * проект определяется записью в этом реестре и не зависит от БД. `listProjects`
 * объединяет оба источника и отдаёт их единым списком.
 */

export interface AppProject {
  /** Ключ проекта (`slug`) — уникален среди статичных и прикладных проектов. */
  slug: string;
  /** Название карточки в разделе «Проекты». */
  title: string;
  /** Описание карточки. */
  description: string;
  /** Акцентный цвет карточки (hex). */
  accent: string;
  /** Имя иконки из `projectIcons` на фронтенде (например `renovation`). */
  icon: string;
  /** Порядок в списке (меньше — раньше), как `project-order` у статичных. */
  order: number;
  /** Внутренний маршрут приложения без `#` (hash-роутинг), например `/projects/renovation`. */
  route: string;
  /** Markdown-контент встроенной страницы, если он есть. */
  content?: string;
}

/** Реестр прикладных проектов. При переносе проекта в приложение — добавить запись сюда. */
export const APP_PROJECTS: AppProject[] = [
  {
    slug: 'renovation',
    title: 'Ремонт Сиверса 8, 548',
    description: 'Отчётность по ремонту: смета, внесённые средства, отчёты о работах и материалах.',
    accent: '#e8872e',
    icon: 'renovation',
    order: 0,
    route: '/projects/renovation',
  },
  {
    slug: 'mebel-siversa-8-548',
    title: 'Мебель Сиверса 8, 548',
    description: 'Проект мебели',
    accent: '#3b82f6',
    icon: 'projects',
    order: 1,
    route: '/projects/mebel-siversa-8-548',
    content: FURNITURE_PROJECT_CONTENT,
  },
];
