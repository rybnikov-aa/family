import type { Request, Response } from 'express';
import {
  HttpError,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from '../services/projectsService';

/** Ловит `HttpError` и отвечает статусом; прочие ошибки уходят в errorHandler (500). */
function handleHttpError(res: Response, err: unknown): boolean {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return true;
  }
  return false;
}

/**
 * Список проектов: `GET /api/projects`.
 * Встроенный реестр + созданные через UI записи БД (kind: 'app'). `?refresh=1`
 * принимается для обратной совместимости — кэша сканирования больше нет.
 */
export function projectsController(req: Request, res: Response): void {
  void req;
  res.json(listProjects());
}

/** Полные данные проекта: `GET /api/projects/:slug` (включая markdown-контент). */
export function projectController(req: Request, res: Response): void {
  try {
    res.json(getProject(String(req.params.slug)));
  } catch (err) {
    if (!handleHttpError(res, err)) throw err;
  }
}

/**
 * Создание проекта: `POST /api/projects` (admin).
 * Тело — `ProjectInput` (`{slug, title, description, accent?, icon?, order?, content?}`);
 * создаётся запись в БД `projects`. Ответ — метаданные (201); 400 — невалидные
 * данные, 409 — имя уже занято.
 */
export function createProjectController(req: Request, res: Response): void {
  try {
    const project = createProject(req.body);
    res.status(201).json(project);
  } catch (err) {
    if (!handleHttpError(res, err)) throw err;
  }
}

/**
 * Обновление проекта: `PATCH /api/projects/:slug` (admin).
 * Обновляет метаданные и/или markdown-контент. 404 — проект не найден,
 * 400 — встроенный (реестровый) проект редактировать нельзя.
 */
export function updateProjectController(req: Request, res: Response): void {
  try {
    const project = updateProject(String(req.params.slug), req.body);
    res.json(project);
  } catch (err) {
    if (!handleHttpError(res, err)) throw err;
  }
}

/**
 * Удаление проекта: `DELETE /api/projects/:slug` (admin).
 * Удаляет запись из БД. 204; 404 — не найден, 400 — встроенный проект.
 */
export function deleteProjectController(req: Request, res: Response): void {
  try {
    deleteProject(String(req.params.slug));
    res.status(204).end();
  } catch (err) {
    if (!handleHttpError(res, err)) throw err;
  }
}
