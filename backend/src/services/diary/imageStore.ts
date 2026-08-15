import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { env } from '../../config/env';

/**
 * Хранение изображений событий «Дневника».
 *
 * Файлы живут в `DIARY_IMAGES_DIR` (по умолчанию `images` относительно CWD
 * бэкенда: dev — `backend/images`, сервер — `server/images`, каталог
 * сохраняется при деплое). Для каждого события — уникальная подпапка
 * `images/<folder>/`, имя генерируется при создании события (`newEventFolder`).
 *
 * Раздача — `GET /api/diary/images/:folder/:file` (под авторизацией), см.
 * `controllers/diaryController.ts` → `imageFileController`.
 */

/** Допустимые символы имён папок и файлов (защита от path traversal). */
const SAFE_RE = /^[a-z0-9._-]+$/i;

/** Абсолютный путь к каталогу изображений «Дневника». */
export function imagesDir(): string {
  return resolve(env.DIARY_IMAGES_DIR);
}

/**
 * Абсолютный путь к подпапке события. Возвращает `null`, если имя папки
 * некорректно (path traversal) либо выходит за пределы каталога изображений.
 */
export function eventImagesDir(folder: string): string | null {
  if (!SAFE_RE.test(folder)) return null;
  const base = imagesDir();
  const dir = resolve(base, folder);
  if (dir !== base && !dir.startsWith(base + sep)) return null;
  return dir;
}

/** Уникальное имя папки события (`evt-<time36>-<hex>`). */
export function newEventFolder(): string {
  const ts = Date.now().toString(36);
  const rand = randomBytes(4).toString('hex');
  return `evt-${ts}-${rand}`;
}

/**
 * Безопасное имя файла для загруженного изображения: случайное имя с
 * сохранением расширения (только латиница/цифры/дефисы — безопасно для URL
 * и файловой системы). Расширение — из исходного имени, если допустимо.
 */
export function imageFileName(originalName: string): string {
  const ext = originalName.includes('.')
    ? originalName.slice(originalName.lastIndexOf('.')).toLowerCase()
    : '';
  const safeExt = /^\.[a-z0-9]{1,5}$/i.test(ext) ? ext : '';
  return `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}${safeExt}`;
}

/** Имена изображений в папке события (отсортированы по имени). */
export function listEventImages(folder: string): string[] {
  const dir = eventImagesDir(folder);
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => SAFE_RE.test(f))
    .sort();
}

/** Сохраняет изображение в подпапку события (создаёт каталог при необходимости). */
export function saveEventImage(folder: string, buffer: Buffer, fileName: string): void {
  const dir = eventImagesDir(folder);
  if (!dir) throw new Error('Некорректное имя папки события');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, fileName), buffer);
}

/** Удаляет папку события целиком (удаление события/откат). */
export function removeEventImages(folder: string): void {
  const dir = eventImagesDir(folder);
  if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

/** Удаляет одно изображение из папки события. */
export function removeEventImage(folder: string, fileName: string): void {
  if (!SAFE_RE.test(fileName)) return;
  const dir = eventImagesDir(folder);
  if (!dir) return;
  const path = join(dir, fileName);
  if (existsSync(path)) rmSync(path, { force: true });
}

/**
 * Абсолютный путь к изображению события. Возвращает `null`, если папка/файл
 * некорректны (path traversal). Существование файла контроллер проверяет
 * отдельно (404).
 */
export function resolveEventImage(folder: string, fileName: string): string | null {
  if (!SAFE_RE.test(folder) || !SAFE_RE.test(fileName)) return null;
  const dir = eventImagesDir(folder);
  if (!dir) return null;
  const path = resolve(dir, fileName);
  if (path !== dir && !path.startsWith(dir + sep)) return null;
  return path;
}
