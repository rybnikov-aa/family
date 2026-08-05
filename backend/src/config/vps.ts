import { loadVpsEntries } from '../db/vpsRepository';

/** Конфигурация сервиса внутри VPS. */
export interface VpsServiceConfig {
  /** Отображаемое имя сервиса, напр. «3x-ui» */
  name: string;
  /** Тип проверки: «http» (HTTP(S) GET) или «ocserv» (OpenConnect VPN) */
  type: string;
  /** Адрес для проверки, напр. «https://jhnl.rybnikov.su:51981/...» */
  address: string;
}

/** Запись конфигурации VPS. */
export interface VpsEntry {
  /** ISO-код страны расположения (для флага), напр. «nl» */
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

/**
 * Список VPS из базы данных SQLite.
 *
 * Данные читаются из SQLite при первом обращении — это позволяет
 * менять состав VPS без пересборки бандла.
 *
 * Загружается один раз при старте модуля (состав VPS меняется редко).
 */
export const vpsEntries: VpsEntry[] = loadVpsEntries();
