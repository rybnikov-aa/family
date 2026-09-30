import { writeFileSync } from 'node:fs';
import {
  addNewsAttachment,
  createNewsRow,
  deleteNewsRow,
  getNewsRow,
  listNewsRows,
  markNewsRead,
  updateNewsRow,
  type NewsPostRow,
} from '../db/newsRepository';
import {
  newsAttachmentFile,
  newsAttachmentFolder,
  newsAttachmentPath,
  removeNewsFolder,
} from './newsStore';

export class NewsHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'NewsHttpError';
    this.status = status;
  }
}

export interface NewsUpload {
  title: string;
  tag: string;
  text: string;
  publishAt: string;
  pinned: boolean;
  files: { buffer: Buffer; originalName: string; mimeType: string }[];
}

export interface NewsPost {
  id: number;
  title: string;
  tag: string;
  text: string;
  publishAt: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  read: boolean;
  attachments: { id: number; originalName: string; url: string }[];
}

function normalize(input: NewsUpload): NewsUpload {
  const title = input.title.trim();
  const text = input.text.trim();
  if (!title || !text) throw new NewsHttpError(400, 'Заголовок и текст новости обязательны');
  const date = new Date(input.publishAt);
  if (Number.isNaN(date.getTime())) throw new NewsHttpError(400, 'Некорректная дата публикации');
  return { ...input, title, tag: input.tag.trim(), text, publishAt: date.toISOString() };
}

function toPublic(row: NewsPostRow): NewsPost {
  return {
    id: row.id,
    title: row.title,
    tag: row.tag,
    text: row.text,
    publishAt: row.publish_at,
    pinned: row.pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    read: row.read,
    attachments: row.attachments.map((attachment) => ({
      id: attachment.id,
      originalName: attachment.original_name,
      url: `/api/news/attachments/${encodeURIComponent(attachment.folder)}/${encodeURIComponent(attachment.file_name)}`,
    })),
  };
}

function saveFiles(postId: number, files: NewsUpload['files']): void {
  if (files.length === 0) return;
  const folder = newsAttachmentFolder(postId);
  for (const file of files) {
    const fileName = newsAttachmentFile(file.originalName);
    const path = newsAttachmentPath(folder, fileName);
    if (!path) throw new NewsHttpError(400, 'Некорректное имя вложения');
    writeFileSync(path, file.buffer);
    addNewsAttachment({
      post_id: postId,
      folder,
      file_name: fileName,
      original_name: file.originalName,
      mime_type: file.mimeType,
    });
  }
}

export function listNews(userId: number, admin = false): NewsPost[] {
  return listNewsRows(userId, admin).map(toPublic);
}

export function getNews(id: number, userId: number): NewsPost {
  const row = getNewsRow(id, userId);
  if (!row) throw new NewsHttpError(404, 'Новость не найдена');
  return toPublic(row);
}

export function createNews(input: NewsUpload): NewsPost {
  const normalized = normalize(input);
  const row = createNewsRow(normalized);
  try {
    saveFiles(row.id, normalized.files);
  } catch (error) {
    deleteNewsRow(row.id);
    throw error;
  }
  return getNews(row.id, 0);
}

export function updateNews(id: number, input: NewsUpload): NewsPost {
  const normalized = normalize(input);
  const row = updateNewsRow(id, normalized);
  if (!row) throw new NewsHttpError(404, 'Новость не найдена');
  saveFiles(id, normalized.files);
  return getNews(id, 0);
}

export function deleteNews(id: number): void {
  const row = getNewsRow(id, 0);
  if (!row) throw new NewsHttpError(404, 'Новость не найдена');
  if (!deleteNewsRow(id)) throw new NewsHttpError(404, 'Новость не найдена');
  const folder = row.attachments[0]?.folder;
  if (folder) removeNewsFolder(folder);
}

export function markRead(id: number, userId: number): void {
  if (!getNewsRow(id, userId)) throw new NewsHttpError(404, 'Новость не найдена');
  markNewsRead(id, userId);
}
