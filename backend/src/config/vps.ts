import rawVpsConfig from './vps.json';

/** Конфигурация сервиса внутри VPS (файл config/vps.json). */
export interface VpsServiceConfig {
  /** Отображаемое имя сервиса, напр. «3x-ui» */
  name: string;
  /** Тип проверки, напр. «http» */
  type: string;
  /** Адрес для проверки, напр. «https://jhnl.rybnikov.su:51981/...» */
  address: string;
}

/** Запись конфигурации VPS (файл config/vps.json). */
export interface VpsEntry {
  /** ISO-код страны расположения (для флага), напр. «eu» */
  country: string;
  /** Отображаемое имя VPS */
  name: string;
  /** IP-адрес для проверки доступности, напр. «150.251.139.253» */
  ip: string;
  /** Ссылка на панель управления хостера (для отдельной страницы позже) */
  panel: string;
  /** Список сервисов для проверки */
  services: VpsServiceConfig[];
}

/** Результат проверки сервиса. */
export interface VpsServiceStatus extends VpsServiceConfig {
  /** Доступен ли сервис */
  online: boolean;
  /** Задержка ответа в мс (null, если недоступен) */
  latencyMs: number | null;
  /** Сообщение об ошибке (null, если доступен) */
  error: string | null;
}

/** Результат проверки VPS. */
export interface VpsStatus extends VpsEntry {
  /** Доступен ли VPS по IP */
  online: boolean;
  /** Задержка ответа в мс (null, если IP недоступен) */
  latencyMs: number | null;
  /** Сообщение об ошибке при недоступности IP (null, если доступен) */
  error: string | null;
  /** Момент проверки (ISO-строка) */
  checkedAt: string;
  /** Результаты проверки сервисов */
  services: VpsServiceStatus[];
}

interface VpsConfig {
  vps: VpsEntry[];
}

function isVpsServiceConfig(value: unknown): value is VpsServiceConfig {
  if (typeof value !== 'object' || value === null) return false;
  const service = value as Record<string, unknown>;
  return (
    typeof service.name === 'string' &&
    typeof service.type === 'string' &&
    typeof service.address === 'string'
  );
}

function isVpsEntry(value: unknown): value is VpsEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.country === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.ip === 'string' &&
    typeof entry.panel === 'string' &&
    Array.isArray(entry.services) &&
    entry.services.every(isVpsServiceConfig)
  );
}

function loadVpsEntries(): VpsEntry[] {
  const config = rawVpsConfig as VpsConfig;
  if (!Array.isArray(config.vps)) {
    console.warn('[vps] Конфиг config/vps.json не содержит массив "vps"');
    return [];
  }
  return config.vps.filter(isVpsEntry).map((entry) => ({
    country: entry.country,
    name: entry.name,
    ip: entry.ip.trim(),
    panel: entry.panel,
    services: entry.services.map((service) => ({
      name: service.name,
      type: service.type,
      address: service.address.trim(),
    })),
  }));
}

/** Список VPS из конфигурации. */
export const vpsEntries: VpsEntry[] = loadVpsEntries();
