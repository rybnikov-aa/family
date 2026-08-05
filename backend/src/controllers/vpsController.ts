import type { Request, Response } from 'express';
import { getVpsStatuses } from '../services/vpsChecker';

export async function vpsController(req: Request, res: Response): Promise<void> {
  // ?refresh=1 — принудительная перепроверка (мимо кэша).
  const force = req.query.refresh === 'true' || req.query.refresh === '1';
  res.json(await getVpsStatuses(force));
}
