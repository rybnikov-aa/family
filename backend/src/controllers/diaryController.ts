import { existsSync } from 'node:fs';
import type { Request, Response } from 'express';
import {
  createDiaryEvent,
  deleteDiaryEvent,
  getDiaryEvent,
  HttpError,
  listDiaryEvents,
  updateDiaryEvent,
  type DiaryEventUpload,
} from '../services/diaryService';
import { ensurePreview, resolveEventImage } from '../services/diary/imageStore';

/** Ловит `HttpError` и отвечает статусом; прочие ошибки уходят в errorHandler (500). */
function handleHttpError(res: Response, err: unknown): boolean {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return true;
  }
  return false;
}

/** Разбирает JSON-массив строк из поля multipart (пусто/нет — пустой массив). */
function parseStringArray(value: unknown, field: string): string[] {
  if (value === undefined || value === '') return [];
  if (typeof value !== 'string') {
    throw new HttpError(400, `${field} — ожидается JSON-массив строк`);
  }
  try {
    const arr = JSON.parse(value) as unknown;
    if (!Array.isArray(arr) || !arr.every((item) => typeof item === 'string')) {
      throw new Error('not an array of strings');
    }
    return arr;
  } catch {
    throw new HttpError(400, `${field} — ожидается JSON-массив строк`);
  }
}

/** Собирает входные данные создания/обновления из multipart-запроса. */
function parseDiaryUpload(req: Request): DiaryEventUpload {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const files = Array.isArray(req.files) ? req.files : [];

  const newIds = parseStringArray(body.newIds, 'newIds');
  const keep = parseStringArray(body.keep, 'keep');
  if (newIds.length !== files.length) {
    throw new HttpError(400, 'Не совпадает число файлов и метаданных');
  }

  return {
    title: typeof body.title === 'string' ? body.title : '',
    dateStart: typeof body.dateStart === 'string' ? body.dateStart : '',
    dateEnd: typeof body.dateEnd === 'string' && body.dateEnd.trim() !== '' ? body.dateEnd : null,
    summary: typeof body.summary === 'string' ? body.summary : '',
    content: typeof body.content === 'string' ? body.content : '',
    cover: typeof body.cover === 'string' && body.cover.trim() !== '' ? body.cover : null,
    newIds,
    keep,
    files: files.map((f) => ({ buffer: f.buffer, originalName: f.originalname })),
  };
}

/** Список событий: `GET /api/diary`. */
export function listDiaryEventsController(_req: Request, res: Response): void {
  res.json(listDiaryEvents());
}

/** Полные данные события: `GET /api/diary/:id`. 404 — не найдено. */
export function diaryEventController(req: Request, res: Response): void {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(404).json({ message: 'Событие не найдено' });
      return;
    }
    res.json(getDiaryEvent(id));
  } catch (err) {
    if (!handleHttpError(res, err)) throw err;
  }
}

/** Создание события: `POST /api/diary` (multipart, admin). */
export function createDiaryEventController(req: Request, res: Response): void {
  try {
    const event = createDiaryEvent(parseDiaryUpload(req));
    res.status(201).json(event);
  } catch (err) {
    if (!handleHttpError(res, err)) throw err;
  }
}

/** Обновление события: `PATCH /api/diary/:id` (multipart, admin). */
export function updateDiaryEventController(req: Request, res: Response): void {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(404).json({ message: 'Событие не найдено' });
      return;
    }
    const event = updateDiaryEvent(id, parseDiaryUpload(req));
    res.json(event);
  } catch (err) {
    if (!handleHttpError(res, err)) throw err;
  }
}

/** Удаление события: `DELETE /api/diary/:id` (admin). */
export function deleteDiaryEventController(req: Request, res: Response): void {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(404).json({ message: 'Событие не найдено' });
      return;
    }
    deleteDiaryEvent(id);
    res.status(204).end();
  } catch (err) {
    if (!handleHttpError(res, err)) throw err;
  }
}

/**
 * Изображение события: `GET /api/diary/images/:folder/:file` (под авторизацией).
 * Без параметров — оригинал в полном размере (открытие на весь экран).
 * С `?preview=1` — уменьшенная копия (WebP) для превью: генерируется лениво
 * при первом обращении и кэшируется на диске; кэш браузера — `immutable`
 * (имя файла неизменяемо). Если превью не удалось создать — отдаётся оригинал.
 * Имена папки/файла проверяются (только `[a-z0-9._-]`, без выхода за каталог) —
 * защита от path traversal. 400 — некорректный путь, 404 — файл не найден.
 */
export async function imageFileController(req: Request, res: Response): Promise<void> {
  const folder = String(req.params.folder);
  const file = String(req.params.file);
  const wantPreview = req.query.preview === '1';

  if (wantPreview) {
    const previewPath = await ensurePreview(folder, file);
    if (previewPath && existsSync(previewPath)) {
      res.set('Cache-Control', 'private, max-age=31536000, immutable');
      res.type('image/webp');
      res.sendFile(previewPath);
      return;
    }
    // Превью не сгенерировалось — отдаём оригинал (изображение всё же покажется).
  }

  const filePath = resolveEventImage(folder, file);
  if (!filePath) {
    res.status(400).json({ message: 'Некорректный путь к изображению' });
    return;
  }
  if (!existsSync(filePath)) {
    res.status(404).json({ message: 'Изображение не найдено' });
    return;
  }
  res.sendFile(filePath);
}
