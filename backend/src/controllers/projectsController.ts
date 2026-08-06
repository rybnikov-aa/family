import type { Request, Response } from 'express';
import { HttpError, listProjectDirs, listProjects, savePdf } from '../services/projectsService';

/**
 * Список проектов: `GET /api/projects`.
 * Проект — подпапка на сервере с `index.html` (см. `projectsService`).
 */
export function projectsController(_req: Request, res: Response): void {
  res.json(listProjects());
}

/** Список папок на сервере внутри каталога проектов: `GET /api/projects/dirs`. */
export function dirsController(_req: Request, res: Response): void {
  res.json({ dirs: listProjectDirs() });
}

/**
 * Загрузка PDF на сервер: `POST /api/projects/upload` (multipart/form-data).
 * Поля формы: `folder` (относительный путь внутри каталога проектов,
 * например `renovation/pdf/00 Дизайн-проект`), `name` (имя файла) и `file` (PDF).
 * Возвращает `{ url }` — адрес загруженного файла (201).
 */
export function uploadPdfController(req: Request, res: Response): void {
  try {
    // Имя файла передаётся отдельным полем формы (`name`, UTF-8) — так кириллица
    // не «ломается» латиницей, как это делает multer с `originalname`.
    const fileName = typeof req.body?.name === 'string' ? req.body.name : req.file?.originalname;
    const file = req.file ? { name: fileName, buffer: req.file.buffer } : undefined;
    const result = savePdf(req.body?.folder, file);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ message: err.message });
      return;
    }
    throw err; // прочие ошибки → errorHandler (500)
  }
}
