import type { Request, Response } from 'express';
import { getVpsHistory, VpsHistoryHttpError } from '../services/vpsHistoryService';

export function vpsHistoryController(req: Request, res: Response): void {
  try {
    const name = typeof req.query.name === 'string' ? req.query.name : '';
    const rawHours = typeof req.query.hours === 'string' ? Number(req.query.hours) : 168;
    if (!Number.isInteger(rawHours) || rawHours < 1 || rawHours > 2160) {
      throw new VpsHistoryHttpError(400, 'Период истории должен быть от 1 до 2160 часов');
    }
    res.json(getVpsHistory(name, rawHours));
  } catch (error) {
    if (error instanceof VpsHistoryHttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    throw error;
  }
}
