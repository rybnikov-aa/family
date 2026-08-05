import type { Request, Response } from 'express';
import { getVpsStatuses } from '../services/vpsChecker';
import { insertVpsEntry } from '../db/vpsRepository';
import { reloadVpsEntries, type VpsServiceConfig } from '../config/vps';

export async function vpsController(req: Request, res: Response): Promise<void> {
  // ?refresh=1 — принудительная перепроверка (мимо кэша).
  const force = req.query.refresh === 'true' || req.query.refresh === '1';
  res.json(await getVpsStatuses(force));
}

/**
 * Добавление VPS на мониторинг: `POST /api/vps` с телом `VpsEntry`
 * ({ country, name, ip, panel, services[] }). Валидирует поля, вставляет
 * запись в SQLite (вместе с сервисами), перечитывает список в памяти
 * и возвращает созданную запись (201).
 */
export async function createVpsController(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const country = typeof body.country === 'string' ? body.country.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const ip = typeof body.ip === 'string' ? body.ip.trim() : '';
  const panel = typeof body.panel === 'string' ? body.panel.trim() : '';

  const services: VpsServiceConfig[] = Array.isArray(body.services)
    ? body.services
        .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
        .map((s) => ({
          name: typeof s.name === 'string' ? s.name.trim() : '',
          type: typeof s.type === 'string' ? s.type.trim() : '',
          address: typeof s.address === 'string' ? s.address.trim() : '',
        }))
        .filter((s) => s.name !== '' && s.type !== '' && s.address !== '')
    : [];

  if (country === '' || name === '' || ip === '') {
    res.status(400).json({ message: 'Поля country, name и ip обязательны' });
    return;
  }

  try {
    insertVpsEntry({ country, name, ip, panel, services });
    reloadVpsEntries();
    res.status(201).json({ country, name, ip, panel, services });
  } catch (err) {
    // UNIQUE-ограничение на vps.name → конфликт (409).
    // node:sqlite бросает ErrSQLiteError с code 'ERR_SQLITE_ERROR' и errcode
    // SQLITE_CONSTRAINT (19) / SQLITE_CONSTRAINT_UNIQUE (2067).
    const sqliteErr = err as { errcode?: number } | undefined;
    const errcode = sqliteErr?.errcode ?? 0;
    if ((errcode & 0xff) === 19) {
      res.status(409).json({ message: `VPS с именем «${name}» уже существует` });
      return;
    }
    throw err; // прочие ошибки → errorHandler (500)
  }
}
