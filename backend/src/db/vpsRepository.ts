import { getDb } from '../db/database';
import type { VpsEntry, VpsServiceConfig } from '../config/vps';

/**
 * Репозиторий доступа к конфигурации VPS в SQLite.
 *
 * Данные читаются из БД, что позволяет менять состав VPS
 * без пересборки бандла. Контракт (`VpsEntry[]`) сохранён, поэтому
 * `vpsChecker` и API остаются без изменений.
 */

interface VpsRow {
  id: number;
  country: string;
  name: string;
  ip: string;
  panel: string;
}

interface ServiceRow {
  name: string;
  type: string;
  address: string;
}

/** Загружает все VPS с их сервисами из БД. */
export function loadVpsEntries(): VpsEntry[] {
  const db = getDb();

  const vpsRows = db
    .prepare('SELECT id, country, name, ip, panel FROM vps ORDER BY id')
    .all() as unknown as VpsRow[];

  if (vpsRows.length === 0) {
    return [];
  }

  // Один запрос на все сервисы, группируем по vps_id в памяти — быстрее N запросов.
  const serviceRows = db
    .prepare('SELECT vps_id, name, type, address FROM vps_services ORDER BY id')
    .all() as unknown as (ServiceRow & { vps_id: number })[];

  const servicesByVps = new Map<number, VpsServiceConfig[]>();
  for (const row of serviceRows) {
    const list = servicesByVps.get(row.vps_id) ?? [];
    list.push({
      name: row.name,
      type: row.type,
      address: row.address.trim(),
    });
    servicesByVps.set(row.vps_id, list);
  }

  return vpsRows.map((row) => ({
    country: row.country,
    name: row.name,
    ip: row.ip.trim(),
    panel: row.panel,
    services: servicesByVps.get(row.id) ?? [],
  }));
}

/**
 * Вставляет новый VPS вместе с его сервисами в одной транзакции.
 *
 * `node:sqlite` пока не реализует `db.transaction()`, поэтому транзакция
 * выполняется вручную через `BEGIN`/`COMMIT`/`ROLLBACK`.
 * При нарушении UNIQUE-ограничения на `name` бросается ошибка — наружу
 * транзакция откатывается, частичная вставка невозможна.
 */
export function insertVpsEntry(entry: VpsEntry): void {
  const db = getDb();

  db.exec('BEGIN');
  try {
    const result = db
      .prepare('INSERT INTO vps (country, name, ip, panel) VALUES (?, ?, ?, ?)')
      .run(entry.country, entry.name, entry.ip, entry.panel);
    const vpsId = Number(result.lastInsertRowid);

    const insertService = db.prepare(
      'INSERT INTO vps_services (vps_id, name, type, address) VALUES (?, ?, ?, ?)',
    );
    for (const service of entry.services) {
      insertService.run(vpsId, service.name, service.type, service.address.trim());
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
