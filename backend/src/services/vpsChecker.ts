import { performance } from 'node:perf_hooks';
import net from 'node:net';
import {
  vpsEntries,
  type VpsEntry,
  type VpsServiceConfig,
  type VpsServiceStatus,
  type VpsStatus,
} from '../config/vps';

/** Таймаут на один HTTP-запрос. */
const CHECK_TIMEOUT_MS = 5_000;
/** Таймаут TCP-подключения к IP. */
const IP_TIMEOUT_MS = 3_000;
/** Время жизни кэша результатов проверки. */
const CACHE_TTL_MS = 30_000;

let cache: { statuses: VpsStatus[]; checkedAt: number } | null = null;
let inflight: Promise<VpsStatus[]> | null = null;

/** Проверка доступности хоста/порта через TCP-соединение. */
function tcpReachable(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

/** Порт из адреса сервиса (явный или по протоколу). */
function urlPort(url: string): number | null {
  try {
    const parsed = new URL(url);
    if (parsed.port) return Number(parsed.port);
    if (parsed.protocol === 'https:') return 443;
    if (parsed.protocol === 'http:') return 80;
    return null;
  } catch {
    return null;
  }
}

/** Порты для IP-проверки: из сервисов; если их нет — стандартные. */
function ipCheckPorts(entry: VpsEntry): number[] {
  const ports = new Set<number>();
  for (const service of entry.services) {
    const port = urlPort(service.address);
    if (port) ports.add(port);
  }
  if (ports.size === 0) {
    ports.add(22).add(443).add(80);
  }
  return [...ports];
}

/** Проверка доступности VPS по IP (TCP-коннект на порты сервисов). */
async function checkIp(entry: VpsEntry): Promise<{
  online: boolean;
  latencyMs: number | null;
  error: string | null;
}> {
  const started = performance.now();
  const ports = ipCheckPorts(entry);
  const results = await Promise.all(
    ports.map((port) => tcpReachable(entry.ip, port, IP_TIMEOUT_MS)),
  );
  const online = results.some(Boolean);
  return {
    online,
    latencyMs: online ? Math.round(performance.now() - started) : null,
    error: online ? null : `IP ${entry.ip} недоступен (порты: ${ports.join(', ')})`,
  };
}

/** Варианты URL для HTTP-проверки (https, при неудаче — http). */
function toCheckUrls(address: string): string[] {
  const trimmed = address.trim();
  if (/^https?:\/\//i.test(trimmed)) return [trimmed];
  return [`https://${trimmed}`, `http://${trimmed}`];
}

/** HTTP(S)-проверка: любой ответ (в т.ч. 4xx/5xx) = сервис доступен. */
async function httpCheck(
  address: string,
  timeoutMs: number,
): Promise<{ online: boolean; latencyMs: number; error: string | null }> {
  const started = performance.now();
  let lastError = 'unreachable';
  for (const url of toCheckUrls(address)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetch(url, { signal: controller.signal, redirect: 'follow' });
      return { online: true, latencyMs: Math.round(performance.now() - started), error: null };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timer);
    }
  }
  return { online: false, latencyMs: Math.round(performance.now() - started), error: lastError };
}

/** Проверка одного сервиса по его типу. */
async function checkService(service: VpsServiceConfig): Promise<VpsServiceStatus> {
  const base = { name: service.name, type: service.type, address: service.address };
  if (service.type === 'http') {
    const result = await httpCheck(service.address, CHECK_TIMEOUT_MS);
    return { ...base, ...result };
  }
  return {
    ...base,
    online: false,
    latencyMs: null,
    error: `Неподдерживаемый тип проверки: ${service.type}`,
  };
}

async function checkVps(entry: VpsEntry): Promise<VpsStatus> {
  const checkedAt = new Date().toISOString();
  const ip = await checkIp(entry);

  // IP недоступен — сервисы не проверяем (красный индикатор).
  if (!ip.online) {
    return {
      ...entry,
      online: false,
      latencyMs: ip.latencyMs,
      error: ip.error,
      checkedAt,
      services: entry.services.map((service) => ({
        name: service.name,
        type: service.type,
        address: service.address,
        online: false,
        latencyMs: null,
        error: 'IP недоступен — проверка пропущена',
      })),
    };
  }

  const services = await Promise.all(entry.services.map((service) => checkService(service)));
  return {
    ...entry,
    online: true,
    latencyMs: ip.latencyMs,
    error: null,
    checkedAt,
    services,
  };
}

/**
 * Возвращает статусы доступности всех VPS из конфигурации:
 * сначала IP-проверка, затем проверка сервисов.
 * Результат кэшируется на CACHE_TTL_MS; `force` принудительно обновляет.
 */
export async function getVpsStatuses(force = false): Promise<VpsStatus[]> {
  if (!force && cache && Date.now() - cache.checkedAt < CACHE_TTL_MS) {
    return cache.statuses;
  }
  if (!inflight) {
    inflight = (async () => {
      const statuses = await Promise.all(vpsEntries.map((entry) => checkVps(entry)));
      cache = { statuses, checkedAt: Date.now() };
      return statuses;
    })();
  }
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
