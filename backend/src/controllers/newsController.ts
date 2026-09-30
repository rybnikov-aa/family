import { existsSync } from 'node:fs';
import type { Request, Response } from 'express';
import {
  createNews,
  deleteNews,
  listNews,
  markRead,
  NewsHttpError,
  updateNews,
  type NewsUpload,
} from '../services/newsService';
import { newsAttachmentPath } from '../services/newsStore';

function handleError(res: Response, error: unknown): boolean {
  if (error instanceof NewsHttpError) {
    res.status(error.status).json({ message: error.message });
    return true;
  }
  return false;
}

function parseUpload(req: Request): NewsUpload {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const files = Array.isArray(req.files) ? req.files : [];
  return {
    title: typeof body.title === 'string' ? body.title : '',
    tag: typeof body.tag === 'string' ? body.tag : '',
    text: typeof body.text === 'string' ? body.text : '',
    publishAt: typeof body.publishAt === 'string' ? body.publishAt : '',
    pinned: body.pinned === true || body.pinned === 'true' || body.pinned === '1',
    files: files.map((file) => ({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    })),
  };
}

export function newsController(req: Request, res: Response): void {
  res.json(listNews(req.user?.id ?? 0));
}

export function adminNewsController(req: Request, res: Response): void {
  res.json(listNews(req.user?.id ?? 0, true));
}

export function createNewsController(req: Request, res: Response): void {
  try {
    res.status(201).json(createNews(parseUpload(req)));
  } catch (error) {
    if (!handleError(res, error)) throw error;
  }
}

export function updateNewsController(req: Request, res: Response): void {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new NewsHttpError(400, 'Некорректный id новости');
    res.json(updateNews(id, parseUpload(req)));
  } catch (error) {
    if (!handleError(res, error)) throw error;
  }
}

export function deleteNewsController(req: Request, res: Response): void {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new NewsHttpError(400, 'Некорректный id новости');
    deleteNews(id);
    res.status(204).end();
  } catch (error) {
    if (!handleError(res, error)) throw error;
  }
}

export function markNewsReadController(req: Request, res: Response): void {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new NewsHttpError(400, 'Некорректный id новости');
    markRead(id, req.user?.id ?? 0);
    res.status(204).end();
  } catch (error) {
    if (!handleError(res, error)) throw error;
  }
}

export function newsAttachmentController(req: Request, res: Response): void {
  const path = newsAttachmentPath(String(req.params.folder), String(req.params.file));
  if (!path) {
    res.status(400).json({ message: 'Некорректный путь к вложению' });
    return;
  }
  if (!existsSync(path)) {
    res.status(404).json({ message: 'Вложение не найдено' });
    return;
  }
  res.sendFile(path);
}
