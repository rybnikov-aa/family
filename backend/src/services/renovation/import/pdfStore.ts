import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { env } from '../../../config/env';
import type { PdfClass } from './classify';

/**
 * Хранение загруженных PDF «Ремонта» (импорт PDF, этап 3).
 *
 * Файлы живут в `RENOVATION_DOCS_DIR` (по умолчанию `docs/renovation`
 * относительно CWD бэкенда: dev — `backend/docs/renovation`, сервер —
 * `server/docs/renovation`, каталог сохраняется при деплое). Схема:
 * - `docs/<project>/.pending/<draftId>.pdf` — загруженный, но ещё не подтверждённый
 *   файл (живёт до TTL черновика, осиротевшие вычищаются `cleanupPendingPdfs`);
 * - `docs/<project>/<finalName>.pdf` — подтверждённый документ (имя из
 *   классификации: тип+дата+номер), на него ссылается `pdf_path` в БД.
 *
 * Раздача — `GET /api/renovation/docs/:file` (под авторизацией), см.
 * `controllers/renovationController.ts` → `pdfFileController`.
 */

/** Имя подпапки для не подтверждённых файлов. */
const PENDING_DIR = '.pending';
/** Срок хранения pending-файла (дольше TTL черновика в draftStore). */
const PENDING_TTL_MS = 60 * 60 * 1000;

/** Абсолютный путь к каталогу документов «Ремонта». */
export function docsDir(): string {
  return resolve(env.RENOVATION_DOCS_DIR);
}

/** Абсолютный путь к каталогу не подтверждённых файлов. */
function pendingDir(): string {
  return join(docsDir(), PENDING_DIR);
}

/** Сохраняет загруженный PDF как pending-файл черновика; возвращает путь. */
export function savePendingPdf(buffer: Buffer, draftId: string): string {
  mkdirSync(pendingDir(), { recursive: true });
  const path = join(pendingDir(), `${draftId}.pdf`);
  writeFileSync(path, buffer);
  return path;
}

/**
 * Переносит pending-файл черновика в каталог документов с итоговым именем.
 * Возвращает имя файла либо `null`, если файла нет (или он уже перенесён).
 */
export function finalizePdf(pendingPath: string | null, fileName: string): string | null {
  if (!pendingPath) return null;
  if (!existsSync(pendingPath)) return null;
  mkdirSync(docsDir(), { recursive: true });
  renameSync(pendingPath, join(docsDir(), fileName));
  return fileName;
}

/** Удаляет сохранённый PDF по имени файла (откат при ошибке подтверждения). */
export function discardPdf(fileName: string): void {
  if (!isSafeFileName(fileName)) return;
  const path = join(docsDir(), fileName);
  if (existsSync(path)) rmSync(path, { force: true });
}

/**
 * Имя файла PDF из классификации черновика (детерминированное, только
 * латиница/цифры/дефисы — безопасно для URL и файловой системы).
 */
export function pdfFileName(cls: PdfClass): string {
  const num = (cls.number ?? '').replace(/[^a-z0-9-]/gi, '');
  const suffix = num ? `_${num}` : '';
  const date = cls.date ?? 'nodate';
  switch (cls.type) {
    case 'settlement':
      return `settlement_${cls.subtype ?? 'unknown'}_${date}.pdf`;
    case 'work_act':
      return `work_act_${date}${suffix}.pdf`;
    case 'material_order':
      return `material_order_${date}${suffix}.pdf`;
    case 'addendum':
      return `addendum_${date}.pdf`;
    default:
      return `doc_${date}.pdf`;
  }
}

/** URL PDF внутри приложения (серверный путь, отдаётся под авторизацией). */
export function pdfUrl(fileName: string): string {
  return `/api/renovation/docs/${encodeURIComponent(fileName)}`;
}

/** Имя файла не содержит разделителей/служебных символов (защита от path traversal). */
function isSafeFileName(fileName: string): boolean {
  return /^[a-z0-9._-]+$/i.test(fileName);
}

/**
 * Абсолютный путь к сохранённому PDF по имени файла. Возвращает `null`, если
 * имя некорректно (path traversal) либо выходит за пределы каталога документов.
 * Существование файла контроллер проверяет отдельно (404).
 */
export function resolveStoredPdf(fileName: string): string | null {
  if (!isSafeFileName(fileName)) return null;
  const base = docsDir();
  const path = resolve(base, fileName);
  if (path !== base && !path.startsWith(base + sep)) return null;
  return path;
}

/** Удаляет pending-файлы старше TTL (осиротевшие при несохранённых черновиках). */
export function cleanupPendingPdfs(): void {
  try {
    const dir = pendingDir();
    if (!existsSync(dir)) return;
    const now = Date.now();
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      try {
        if (now - statSync(path).mtimeMs > PENDING_TTL_MS) rmSync(path, { force: true });
      } catch {
        /* файл удалён/недоступен — пропускаем */
      }
    }
  } catch {
    /* каталога ещё нет — чистить нечего */
  }
}
