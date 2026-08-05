import rawVpsConfig from './vps.json';

/** Запись конфигурации VPS (файл config/vps.json). */
export interface VpsEntry {
  /** Флаг страны расположения, напр. «🇪🇺» */
  flag: string;
  /** Отображаемое имя VPS */
  name: string;
  /** Адрес для проверки доступности, напр. «jnhl.rybnikov.su» */
  address: string;
  /** Ссылка на панель управления хостера (для отдельной страницы позже) */
  panel: string;
}

/** Результат проверки доступности VPS. */
export interface VpsStatus extends VpsEntry {
  /** Доступен ли хост */
  online: boolean;
  /** Задержка ответа в мс (null, если хост недоступен) */
  latencyMs: number | null;
  /** Сообщение об ошибке при недоступности (null, если доступен) */
  error: string | null;
  /** Момент проверки (ISO-строка) */
  checkedAt: string;
}

interface VpsConfig {
  vps: VpsEntry[];
}

function isVpsEntry(value: unknown): value is VpsEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.flag === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.address === 'string' &&
    typeof entry.panel === 'string'
  );
}

function loadVpsEntries(): VpsEntry[] {
  const config = rawVpsConfig as VpsConfig;
  if (!Array.isArray(config.vps)) {
    console.warn('[vps] Конфиг config/vps.json не содержит массив "vps"');
    return [];
  }
  return config.vps.filter(isVpsEntry).map((entry) => ({
    flag: entry.flag,
    name: entry.name,
    address: entry.address.trim(),
    panel: entry.panel,
  }));
}

/** Список VPS из конфигурации. */
export const vpsEntries: VpsEntry[] = loadVpsEntries();
