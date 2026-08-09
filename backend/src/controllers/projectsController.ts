import type { Request, Response } from 'express';
import { HttpError, createProject, listProjects } from '../services/projectsService';

/**
 * Список проектов: `GET /api/projects`.
 * Проект — подпапка на сервере с `index.html` (см. `projectsService`).
 * `?refresh=1` — форсированное обновление (обход 60-с кэша сканирования).
 */
export function projectsController(req: Request, res: Response): void {
  const force = req.query.refresh === '1' || req.query.refresh === 'true';
  res.json(listProjects(force));
}

/**
 * Создание статичного проекта: `POST /api/projects` (admin).
 * Тело — `CreateProjectInput` (`{slug, title, description, accent?, icon?, order?}`);
 * создаётся подпапка `PROJECTS_DIR/<slug>/` с `index.html` из встроенного шаблона.
 * Ответ — метаданные созданного проекта (201); 400 — невалидные данные,
 * 409 — имя проекта уже занято.
 */
export function createProjectController(req: Request, res: Response): void {
  try {
    const project = createProject(req.body);
    res.status(201).json(project);
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ message: err.message });
      return;
    }
    throw err; // прочие ошибки → errorHandler (500)
  }
}
