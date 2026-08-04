import type { Request, Response } from 'express';
import { env } from '../config/env';

export function healthController(_req: Request, res: Response): void {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
}
