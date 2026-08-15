import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';

/** Максимальный размер одного изображения (10 МБ). */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
/** Максимальное число изображений на одно событие. */
export const MAX_IMAGES = 30;

/** Допустимые MIME-типы изображений. */
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: MAX_IMAGES },
  fileFilter: (_req, file, cb) => {
    const byMime = ALLOWED_MIME.has(file.mimetype);
    const byExt = /\.(jpe?g|png|webp|gif)$/i.test(file.originalname);
    if (byMime || byExt) {
      cb(null, true);
    } else {
      cb(new Error('Можно загружать только изображения (JPG, PNG, WebP, GIF)'));
    }
  },
});

/**
 * Middleware загрузки нескольких изображений из поля `images`
 * (multipart/form-data). Ошибки multer маппятся на статусы: превышение
 * размера — 413, остальное — 400.
 */
export function uploadImages(req: Request, res: Response, next: NextFunction): void {
  upload.array('images', MAX_IMAGES)(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ message: 'Изображение слишком большое (максимум 10 МБ)' });
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({ message: `Слишком много изображений (максимум ${MAX_IMAGES})` });
      return;
    }
    const message = err instanceof Error ? err.message : 'Ошибка загрузки изображения';
    res.status(400).json({ message });
  });
}
