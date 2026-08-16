import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { env } from '../../config/env';

/**
 * Хранение изображений событий «Дневника».
 *
 * Файлы живут в `DIARY_IMAGES_DIR` (по умолчанию `images` относительно CWD
 * бэкенда: dev — `backend/images`, сервер — `server/images`, каталог
 * сохраняется при деплое). Для каждого события — уникальная подпапка
 * `images/<folder>/`, имя генерируется при создании события (`newEventFolder`).
 *
 * Для каждого изображения генерируется уменьшенная копия (превью) в подпапке
 * `images/<folder>/thumbs/` (WebP, максимум `PREVIEW_MAX_SIZE` по большей
 * стороне). Превью создаётся лениво — при первом запросе `?preview=1`
 * (`ensurePreview`) — и кэшируется на диске; на карточках/в галерее отдаётся
 * именно превью, полный размер — только при открытии изображения на весь экран.
 *
 * Раздача — `GET /api/diary/images/:folder/:file` (под авторизацией), см.
 * `controllers/diaryController.ts` → `imageFileController`.
 */

/** Допустимые символы имён папок и файлов (защита от path traversal). */
const SAFE_RE = /^[a-z0-9._-]+$/i;

/** Максимальный размер превью по большей стороне (px). */
export const PREVIEW_MAX_SIZE = 1200;
/** Качество WebP-превью. */
const PREVIEW_QUALITY = 82;
/** Имя подпапки превью внутри папки события. */
const THUMBS_DIR = 'thumbs';

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

/** Имена изображений в папке события (отсортированы по имени); превью не входят. */
export function listEventImages(folder: string): string[] {
  const dir = eventImagesDir(folder);
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && SAFE_RE.test(entry.name))
    .map((entry) => entry.name)
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
  if (dir && existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

/** Удаляет одно изображение из папки события (вместе с его превью). */
export function removeEventImage(folder: string, fileName: string): void {
  if (!SAFE_RE.test(fileName)) return;
  const dir = eventImagesDir(folder);
  if (!dir) return;
  const path = join(dir, fileName);
  if (existsSync(path)) rmSync(path, { force: true, maxRetries: 3, retryDelay: 100 });
  const preview = previewFilePath(folder, fileName);
  if (preview && existsSync(preview)) {
    rmSync(preview, { force: true, maxRetries: 3, retryDelay: 100 });
  }
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

/**
 * Абсолютный путь к превью изображения события (`<folder>/thumbs/<file>`).
 * Возвращает `null`, если папка/файл некорректны (path traversal).
 */
export function previewFilePath(folder: string, fileName: string): string | null {
  if (!SAFE_RE.test(folder) || !SAFE_RE.test(fileName)) return null;
  const dir = eventImagesDir(folder);
  if (!dir) return null;
  return join(dir, THUMBS_DIR, fileName);
}

/** In-flight генерации превью (по абсолютному пути) — защита от двойной генерации. */
const pendingPreviews = new Map<string, Promise<string | null>>();

/**
 * Гарантирует наличие превью для изображения: возвращает абсолютный путь
 * к готовому превью (генерирует при первом обращении, дальше — из кэша),
 * либо `null`, если оригинала нет или генерация не удалась. Превью пишется
 * во временный файл и переименовывается атомарно — незавершённые файлы
 * не отдаются. Параллельные запросы одного превью дедуплицируются.
 */
export function ensurePreview(folder: string, fileName: string): Promise<string | null> {
  const source = resolveEventImage(folder, fileName);
  if (!source || !existsSync(source)) return Promise.resolve(null);
  const preview = previewFilePath(folder, fileName);
  if (!preview) return Promise.resolve(null);
  if (existsSync(preview)) return Promise.resolve(preview);

  const inFlight = pendingPreviews.get(preview);
  if (inFlight) return inFlight;

  const task = (async (): Promise<string | null> => {
    const tmp = `${preview}.tmp`;
    try {
      mkdirSync(dirname(preview), { recursive: true });
      await sharp(source)
        .rotate() // учёт EXIF-ориентации (фото с телефона)
        .resize({
          width: PREVIEW_MAX_SIZE,
          height: PREVIEW_MAX_SIZE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: PREVIEW_QUALITY })
        .toFile(tmp);
      renameSync(tmp, preview);
      return preview;
    } catch {
      try {
        rmSync(tmp, { force: true });
      } catch {
        /* не критично */
      }
      return null;
    } finally {
      pendingPreviews.delete(preview);
    }
  })();

  pendingPreviews.set(preview, task);
  return task;
}
