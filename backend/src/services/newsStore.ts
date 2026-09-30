import { mkdirSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, extname, resolve } from 'node:path';
import { env } from '../config/env';

export function newsAttachmentFolder(postId: number): string {
  const folder = `post-${postId}`;
  mkdirSync(resolve(env.NEWS_ATTACHMENTS_DIR, folder), { recursive: true });
  return folder;
}

export function newsAttachmentFile(originalName: string): string {
  const extension = extname(originalName).toLowerCase();
  return `${randomUUID()}${extension}`;
}

export function newsAttachmentPath(folder: string, fileName: string): string | null {
  if (!/^post-[a-z0-9-]+$/.test(folder) || !/^[a-z0-9-]+\.[a-z0-9]+$/i.test(fileName)) return null;
  const root = resolve(env.NEWS_ATTACHMENTS_DIR);
  const path = resolve(root, folder, fileName);
  return path.startsWith(`${root}${process.platform === 'win32' ? '\\' : '/'}`) ? path : null;
}

export function removeNewsFolder(folder: string): void {
  const path = newsAttachmentPath(folder, 'placeholder.jpg');
  if (path) {
    rmSync(dirname(path), { recursive: true, force: true });
  }
}
