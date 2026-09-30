import type { Request, Response } from 'express';
import { getPushPublicKey, isPushConfigured, removePushSubscription, savePushSubscription } from '../services/pushService';

export function pushConfigController(_req: Request, res: Response): void {
  res.json({ configured: isPushConfigured(), publicKey: getPushPublicKey() });
}

export function subscribePushController(req: Request, res: Response): void {
  try {
    savePushSubscription(req.user?.id ?? 0, req.body);
    res.status(204).end();
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Некорректная подписка' });
  }
}

export function unsubscribePushController(req: Request, res: Response): void {
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
  if (!endpoint) {
    res.status(400).json({ message: 'Не указан endpoint подписки' });
    return;
  }
  removePushSubscription(req.user?.id ?? 0, endpoint);
  res.status(204).end();
}
