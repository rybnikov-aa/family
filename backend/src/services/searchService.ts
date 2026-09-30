import { listDiaryEvents } from './diaryService';
import { listPlans } from './plansService';
import { listProjects } from './projectsService';

export class SearchHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'SearchHttpError';
    this.status = status;
  }
}

export type SearchResultKind = 'project' | 'plan' | 'diary';

export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  title: string;
  description: string;
  url: string;
  meta: string | null;
}

function matches(query: string, ...values: string[]): boolean {
  return values.some((value) => value.toLocaleLowerCase('ru').includes(query));
}

export function search(query: string): SearchResult[] {
  const normalized = query.trim().toLocaleLowerCase('ru');
  if (normalized.length < 2) {
    throw new SearchHttpError(400, 'Введите минимум 2 символа для поиска');
  }
  if (normalized.length > 80) {
    throw new SearchHttpError(400, 'Запрос слишком длинный');
  }

  const results: SearchResult[] = [];
  for (const project of listProjects()) {
    if (matches(normalized, project.title, project.description)) {
      results.push({
        kind: 'project',
        id: project.slug,
        title: project.title,
        description: project.description,
        url: project.url,
        meta: 'Проект',
      });
    }
  }
  for (const task of listPlans()) {
    if (matches(normalized, task.title, task.description)) {
      results.push({
        kind: 'plan',
        id: String(task.id),
        title: task.title,
        description: task.description,
        url: '/plans',
        meta: task.projectTitle ?? 'Задача',
      });
    }
  }
  for (const event of listDiaryEvents()) {
    if (matches(normalized, event.title, event.summary)) {
      results.push({
        kind: 'diary',
        id: String(event.id),
        title: event.title,
        description: event.summary,
        url: `/diary/${event.id}`,
        meta: event.dateStart,
      });
    }
  }
  return results.slice(0, 50);
}
