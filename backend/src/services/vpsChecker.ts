import { performance } from 'node:perf_hooks';
import { vpsEntries, type VpsEntry, type VpsStatus } from '../config/vps';

/** Таймаут на один запрос доступности. */
const CHECK_TIMEOUT_MS = 5_000;
/** Время жизни кэша результатов проверки. */
const CACHE_TTL_MS = 30_000;

let cache: { statuses: VpsStatus[]; checkedAt: number } | null = null;
let inflight: Promise<VpsStatus[]> | null = null;

function toCheckUrl(address: string): string {
  return /^https?:\/\//i.test(address) ? address : `https://${address}`;
}

async function checkHost(entry: VpsEntry): Promise<VpsStatus> {
  const started = performance.now();
  const baseUrl = toCheckUrl(entry.address);
  // Пробуем https, при неудаче — http.
  const urls = [baseUrl, baseUrl.replace(/^https/i, 'http')];
  let lastError = 'host unreachable';

  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    try {
      await fetch(url, { signal: controller.signal, redirect: 'follow' });
      // Любой HTTP-ответ (в т.ч. 4xx/5xx) означает, что хост доступен.
      return {
        ...entry,
        online: true,
        latencyMs: Math.round(performance.now() - started),
        error: null,
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ...entry,
    online: false,
    latencyMs: null,
    error: lastError,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Возвращает статусы доступности всех VPS из конфигурации.
 * Результат кэшируется на CACHE_TTL_MS; `force` принудительно обновляет.
 */
export async function getVpsStatuses(force = false): Promise<VpsStatus[]> {
  if (!force && cache && Date.now() - cache.checkedAt < CACHE_TTL_MS) {
    return cache.statuses;
  }
  if (!inflight) {
    inflight = (async () => {
      const statuses = await Promise.all(vpsEntries.map((entry) => checkHost(entry)));
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
