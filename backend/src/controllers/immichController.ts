import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { ImmichError, fetchImmichAssetBinary, searchImmichAssets } from '../services/immichService';

/**
 * Прокси-контроллеры пикера фото Immich (вариант B2).
 *
 * Все вызовы идут с бэкенда (API-ключ хранится в БД и не отдаётся на фронтенд),
 * доступ — только роль `admin` (мутации «Дневника» — тоже admin). Три операции:
 * поиск фото по диапазону дат (`GET /api/immich/search`), миниатюры
 * (`GET /api/immich/assets/:id/thumbnail`) и оригиналы (`.../original`, стрим).
 */

/** Обрабатывает ошибку взаимодействия с Immich (остальное — в errorHandler → 500). */
function handleImmichError(err: unknown, res: Response): void {
  if (err instanceof ImmichError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  throw err;
}

/** `GET /api/immich/search?takenAfter=&takenBefore=&page=&size=` (admin). */
export async function immichSearchController(req: Request, res: Response): Promise<void> {
  const { takenAfter, takenBefore, page, size } = req.query;
  try {
    const result = await searchImmichAssets({
      takenAfter: typeof takenAfter === 'string' && takenAfter ? takenAfter : undefined,
      takenBefore: typeof takenBefore === 'string' && takenBefore ? takenBefore : undefined,
      page: page !== undefined ? Number(page) || 1 : undefined,
      size: size !== undefined ? Number(size) || 60 : undefined,
    });
    res.json(result);
  } catch (err) {
    handleImmichError(err, res);
  }
}

/**
 * Проксирует бинарный файл ассета Immich (миниатюра/оригинал) потоком.
 * Копирует Content-Type и Content-Length апстрима (длина — для прогресс-бара
 * скачивания оригиналов в пикере); тело не буферизуется (важно для оригиналов).
 */
async function proxyBinary(
  req: Request,
  res: Response,
  kind: 'thumbnail' | 'original',
): Promise<void> {
  const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  if (!/^[0-9a-fA-F-]{8,}$/.test(id)) {
    res.status(400).json({ message: 'Некорректный id ассета' });
    return;
  }
  try {
    const upstream = await fetchImmichAssetBinary(id, kind);
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    // Прокидываем размер — клиентский прогресс-бар скачивания знает длину файла.
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (upstream.body) {
      const webStream = upstream.body as unknown as Parameters<typeof Readable.fromWeb>[0];
      Readable.fromWeb(webStream).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    handleImmichError(err, res);
  }
}

/** `GET /api/immich/assets/:id/thumbnail` (admin) — миниатюра для пикера. */
export function immichThumbnailController(req: Request, res: Response): Promise<void> {
  return proxyBinary(req, res, 'thumbnail');
}

/** `GET /api/immich/assets/:id/original` (admin) — оригинал для импорта. */
export function immichOriginalController(req: Request, res: Response): Promise<void> {
  return proxyBinary(req, res, 'original');
}
