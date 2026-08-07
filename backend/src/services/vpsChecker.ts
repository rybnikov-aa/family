import crypto from 'node:crypto';
import dgram from 'node:dgram';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import {
  vpsEntries,
  type VpsEntry,
  type VpsServiceConfig,
  type VpsServiceStatus,
  type VpsStatus,
} from '../config/vps';

/** Таймаут на один HTTP-запрос. */
const CHECK_TIMEOUT_MS = 5_000;
/** Порт по умолчанию для OpenConnect/ocserv (TLS+DTLS). */
const OCSERV_DEFAULT_PORT = 443;
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

/** Разрешается true, как только любая проба успешна; false — когда все провалились. */
function anySucceeds(probes: Promise<boolean>[]): Promise<boolean> {
  return new Promise((resolve) => {
    if (probes.length === 0) {
      resolve(false);
      return;
    }
    let pending = probes.length;
    for (const probe of probes) {
      probe.then((ok) => {
        if (ok) {
          resolve(true);
          return;
        }
        pending -= 1;
        if (pending === 0) resolve(false);
      });
    }
  });
}

/**
 * Проверка доступности VPS по IP.
 * Базовые порты «машина жива» (SSH/HTTPS/HTTP) + порты/протоколы сервисов
 * (http — TCP, ocserv — TCP и UDP/DTLS). Любая успешная проба = IP доступен.
 */
async function checkIp(entry: VpsEntry): Promise<{
  online: boolean;
  latencyMs: number | null;
  error: string | null;
}> {
  const started = performance.now();
  const probes: Promise<boolean>[] = [];
  const probed = new Set<string>();

  const addTcp = (port: number) => {
    const key = `tcp:${port}`;
    if (!probed.has(key)) {
      probed.add(key);
      probes.push(tcpReachable(entry.ip, port, IP_TIMEOUT_MS));
    }
  };
  const addUdpDtls = (port: number) => {
    const key = `udp:${port}`;
    if (!probed.has(key)) {
      probed.add(key);
      probes.push(udpDtlsReachable(entry.ip, port, IP_TIMEOUT_MS));
    }
  };

  // Базовые признаки «VPS доступен по IP» — обычно всегда открыты и не зависят
  // от того, работает ли конкретный сервис (чтобы недоступный сервис не давал 0%).
  addTcp(22);
  addTcp(443);
  addTcp(80);

  for (const service of entry.services) {
    const port = urlPort(service.address);
    if (service.type === 'ocserv') {
      const p = port ?? OCSERV_DEFAULT_PORT;
      addTcp(p);
      addUdpDtls(p);
    } else if (port) {
      addTcp(port);
    }
  }

  const online = await anySucceeds(probes);
  return {
    online,
    latencyMs: online ? Math.round(performance.now() - started) : null,
    error: online ? null : `IP ${entry.ip} недоступен (пробы: ${[...probed].join(', ')})`,
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

/** Разбор адреса ocserv: хост и порт (по умолчанию 443). */
function parseOcservAddress(address: string): { host: string; port: number } {
  let trimmed = address.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const slash = trimmed.indexOf('/');
  if (slash !== -1) trimmed = trimmed.slice(0, slash);
  const colon = trimmed.lastIndexOf(':');
  if (colon !== -1) {
    const port = Number(trimmed.slice(colon + 1));
    if (Number.isInteger(port) && port > 0 && port < 65536) {
      return { host: trimmed.slice(0, colon), port };
    }
  }
  return { host: trimmed, port: OCSERV_DEFAULT_PORT };
}

/** Минимальный DTLS ClientHello для UDP-пробы канала ocserv. */
function buildDtlsClientHello(): Buffer {
  const random = crypto.randomBytes(32);
  const body = Buffer.concat([
    Buffer.from([0xfe, 0xfd]), // client_version: DTLS 1.2
    random, // random (32 байта)
    Buffer.from([0x00]), // session_id length = 0
    Buffer.from([0x00]), // cookie length = 0
    Buffer.from([0x00, 0x02, 0xc0, 0x2f]), // cipher_suites: len=2, TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
    Buffer.from([0x01, 0x00]), // compression_methods: len=1, null
  ]);
  const hsLen = body.length;
  const handshake = Buffer.concat([
    Buffer.from([0x01]), // msg_type: client_hello
    Buffer.from([(hsLen >> 16) & 0xff, (hsLen >> 8) & 0xff, hsLen & 0xff]), // length
    Buffer.from([0x00, 0x00]), // message_seq = 0
    Buffer.from([0x00, 0x00, 0x00]), // fragment_offset = 0
    Buffer.from([(hsLen >> 16) & 0xff, (hsLen >> 8) & 0xff, hsLen & 0xff]), // fragment_length
    body,
  ]);
  const recLen = handshake.length;
  return Buffer.concat([
    Buffer.from([0x16]), // content_type: handshake
    Buffer.from([0xfe, 0xfd]), // version: DTLS 1.2
    Buffer.from([0x00, 0x00]), // epoch = 0
    Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), // sequence_number
    Buffer.from([(recLen >> 8) & 0xff, recLen & 0xff]), // length
    handshake,
  ]);
}

/** UDP-проба DTLS-канала: любой ответный датаграмм = канал жив. */
function udpDtlsReachable(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    let settled = false;
    let timer: NodeJS.Timeout | null = null;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // игнорируем
      }
      resolve(ok);
    };
    timer = setTimeout(() => done(false), timeoutMs);
    socket.once('message', () => done(true));
    socket.once('error', () => done(false));
    socket.send(buildDtlsClientHello(), port, host, (err) => {
      if (err) done(false);
    });
  });
}

/** Проверка OpenConnect (ocserv): TCP 443 (TLS) + UDP 443 (DTLS) как fallback. */
async function ocservCheck(
  address: string,
  timeoutMs: number,
): Promise<{ online: boolean; latencyMs: number | null; error: string | null }> {
  const { host, port } = parseOcservAddress(address);
  const started = performance.now();
  const tcpOk = await tcpReachable(host, port, timeoutMs);
  if (tcpOk) {
    return { online: true, latencyMs: Math.round(performance.now() - started), error: null };
  }
  const udpOk = await udpDtlsReachable(host, port, timeoutMs);
  return {
    online: udpOk,
    latencyMs: udpOk ? Math.round(performance.now() - started) : null,
    error: udpOk ? null : `${host}:${port} недоступен (TCP и UDP/DTLS)`,
  };
}

/** Проверка одного сервиса по его типу. */
async function checkService(service: VpsServiceConfig): Promise<VpsServiceStatus> {
  const base = { name: service.name, type: service.type, address: service.address };
  if (service.type === 'http') {
    const result = await httpCheck(service.address, CHECK_TIMEOUT_MS);
    return { ...base, ...result };
  }
  if (service.type === 'ocserv') {
    const result = await ocservCheck(service.address, CHECK_TIMEOUT_MS);
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
