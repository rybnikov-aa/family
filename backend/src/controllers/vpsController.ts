import type { Request, Response } from 'express';
import { getVpsStatuses } from '../services/vpsChecker';
import { deleteVpsEntry, insertVpsEntry, updateVpsEntry } from '../db/vpsRepository';
import { isConstraintError } from '../db/errors';
import { reloadVpsEntries, type VpsEntry, type VpsServiceConfig } from '../config/vps';

export async function vpsController(req: Request, res: Response): Promise<void> {
  // ?refresh=1 — принудительная перепроверка (мимо кэша).
  const force = req.query.refresh === 'true' || req.query.refresh === '1';
  res.json(await getVpsStatuses(force));
}

/** Нормализует и валидирует запись VPS из тела запроса. Возвращает null при невалидных данных. */
function normalizeEntry(body: Record<string, unknown>): VpsEntry | null {
  const country = typeof body.country === 'string' ? body.country.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const ip = typeof body.ip === 'string' ? body.ip.trim() : '';
  const panel = typeof body.panel === 'string' ? body.panel.trim() : '';

  if (country === '' || name === '' || ip === '') {
    return null;
  }

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

  return { country, name, ip, panel, services };
}

/**
 * Добавление VPS на мониторинг: `POST /api/vps` с телом `VpsEntry`
 * ({ country, name, ip, panel, services[] }). Валидирует поля, вставляет
 * запись в SQLite (вместе с сервисами), перечитывает список в памяти
 * и возвращает созданную запись (201).
 */
export async function createVpsController(req: Request, res: Response): Promise<void> {
  const entry = normalizeEntry((req.body ?? {}) as Record<string, unknown>);

  if (entry === null) {
    res.status(400).json({ message: 'Поля country, name и ip обязательны' });
    return;
  }

  try {
    insertVpsEntry(entry);
    reloadVpsEntries();
    res.status(201).json(entry);
  } catch (err) {
    // UNIQUE-ограничение на vps.name → конфликт (409).
    if (isConstraintError(err)) {
      res.status(409).json({ message: `VPS с именем «${entry.name}» уже существует` });
      return;
    }
    throw err; // прочие ошибки → errorHandler (500)
  }
}

/**
 * Обновление VPS: `PATCH /api/vps/:name` с телом `VpsEntry`.
 * Параметр `:name` — текущее имя записи до редактирования; в JSON можно поменять `name`.
 */
export async function updateVpsController(req: Request, res: Response): Promise<void> {
  const currentName = typeof req.params.name === 'string' ? req.params.name.trim() : '';
  const entry = normalizeEntry((req.body ?? {}) as Record<string, unknown>);

  if (currentName === '') {
    res.status(400).json({ message: 'Не указано текущее имя VPS' });
    return;
  }

  if (entry === null) {
    res.status(400).json({ message: 'Поля country, name и ip обязательны' });
    return;
  }

  try {
    const updated = updateVpsEntry(currentName, entry);
    reloadVpsEntries();

    if (!updated) {
      res.status(404).json({ message: `VPS «${currentName}» не найден` });
      return;
    }

    res.json(entry);
  } catch (err) {
    if (isConstraintError(err)) {
      res.status(409).json({ message: `VPS с именем «${entry.name}» уже существует` });
      return;
    }
    throw err;
  }
}

/**
 * Импорт VPS из JSON: `POST /api/vps/import` с телом `{ vps: VpsEntry[] }`
 * (структура как в `vps.json`). Каждая запись вставляется атомарно;
 * невалидные и уже существующие (по имени) пропускаются.
 * Возвращает `{ imported, skipped, errors }` (201).
 */
export async function importVpsController(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;

  // Поддерживаем обёртку { "vps": [...] } (как в vps.json) и голый массив.
  const rawList = Array.isArray(body.vps)
    ? (body.vps as unknown[])
    : Array.isArray(body)
      ? (body as unknown[])
      : null;

  if (rawList === null) {
    res.status(400).json({ message: 'Ожидается JSON с массивом vps (структура из vps.json)' });
    return;
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const item of rawList) {
    if (!item || typeof item !== 'object') {
      skipped += 1;
      continue;
    }
    const entry = normalizeEntry(item as Record<string, unknown>);
    if (entry === null) {
      skipped += 1;
      continue;
    }

    // Дубликат имени внутри файла — пропускаем (регистронезависимо).
    const key = entry.name.toLowerCase();
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);

    try {
      insertVpsEntry(entry);
      imported += 1;
    } catch (err) {
      skipped += 1;
      if (isConstraintError(err)) {
        errors.push(`«${entry.name}» уже существует`);
      } else {
        errors.push(`«${entry.name}»: ${err instanceof Error ? err.message : 'ошибка'}`);
      }
    }
  }

  reloadVpsEntries();
  res.status(201).json({ imported, skipped, errors });
}

/**
 * Удаление VPS: `DELETE /api/vps/:name`. Удаляет запись вместе с сервисами
 * (FK CASCADE) и перечитывает список в памяти. 204 — успех, 404 — не найдено.
 */
export async function deleteVpsController(req: Request, res: Response): Promise<void> {
  const name = typeof req.params.name === 'string' ? req.params.name.trim() : '';
  if (name === '') {
    res.status(400).json({ message: 'Не указано имя VPS' });
    return;
  }

  const deleted = deleteVpsEntry(name);
  reloadVpsEntries();

  if (!deleted) {
    res.status(404).json({ message: `VPS «${name}» не найден` });
    return;
  }
  res.status(204).end();
}
