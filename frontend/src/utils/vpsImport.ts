import type { VpsEntryInput } from '../api/client';

/** Результат разбора JSON-файла импорта VPS. */
export interface ParsedVpsImport {
  /** Нормализованные записи VPS */
  entries: VpsEntryInput[];
  /** Всего записей в файле (до фильтрации невалидных) */
  totalFound: number;
  /** Сколько записей отброшено как невалидные */
  invalid: number;
}

/**
 * Разбирает содержимое JSON-файла импорта VPS.
 *
 * Поддерживается структура из `vps.json`: `{ "vps": [ {country, name, ip,
 * panel, services[]}, … ] }`, а также голый массив таких записей.
 * Записи без обязательных полей (country/name/ip) отбрасываются; пустые
 * сервисы и неполные поля сервисов игнорируются.
 */
export function parseVpsImport(raw: string): ParsedVpsImport {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Файл не является корректным JSON');
  }

  const list = Array.isArray(data)
    ? (data as unknown[])
    : Array.isArray((data as { vps?: unknown } | null)?.vps)
      ? (data as { vps: unknown[] }).vps
      : null;

  if (list === null) {
    throw new Error('Файл должен содержать массив vps (структура как в vps.json)');
  }

  const entries: VpsEntryInput[] = [];
  let invalid = 0;

  for (const item of list) {
    if (!item || typeof item !== 'object') {
      invalid += 1;
      continue;
    }
    const obj = item as Record<string, unknown>;

    const country = typeof obj.country === 'string' ? obj.country.trim() : '';
    const name = typeof obj.name === 'string' ? obj.name.trim() : '';
    const ip = typeof obj.ip === 'string' ? obj.ip.trim() : '';
    const panel = typeof obj.panel === 'string' ? obj.panel.trim() : '';

    if (country === '' || name === '' || ip === '') {
      invalid += 1;
      continue;
    }

    const services = Array.isArray(obj.services)
      ? obj.services
          .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
          .map((s) => ({
            name: typeof s.name === 'string' ? s.name.trim() : '',
            type: typeof s.type === 'string' ? s.type.trim() : '',
            address: typeof s.address === 'string' ? s.address.trim() : '',
          }))
          .filter((s) => s.name !== '' && s.type !== '' && s.address !== '')
      : [];

    entries.push({ country, name, ip, panel, services });
  }

  return { entries, totalFound: list.length, invalid };
}
