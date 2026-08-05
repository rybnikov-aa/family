import type { Request, Response } from 'express';
import { listProjects } from '../services/projectsService';

/**
 * Список проектов: `GET /api/projects`.
 * Проект — подпапка на сервере с `index.html` (см. `projectsService`).
 */
export function projectsController(_req: Request, res: Response): void {
  res.json(listProjects());
}
