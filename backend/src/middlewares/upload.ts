import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';

/** Максимальный размер загружаемого PDF (20 МБ). */
export const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      cb(null, true);
    } else {
      cb(new Error('Можно загружать только PDF-файлы'));
    }
  },
});

/**
 * Middleware загрузки одного PDF из поля `file` (multipart/form-data).
 * Ошибки multer маппятся на статусы: превышение размера — 413, остальное — 400.
 */
export function uploadPdf(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ message: 'Файл слишком большой (максимум 20 МБ)' });
      return;
    }
    const message = err instanceof Error ? err.message : 'Ошибка загрузки файла';
    res.status(400).json({ message });
  });
}
