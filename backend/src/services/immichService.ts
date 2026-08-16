/**
 * Сервис подключения к инстансу Immich (проверка соединения).
 *
 * Админ-настройки (адрес + API-ключ) хранятся в БД (`settings`), см.
 * `db/settingsRepository.ts`. Все вызовы Immich идут с бэкенда — ключ никогда
 * не отдаётся на фронтенд. Проверка соединения — `GET <base>/server/about`
 * с заголовком `x-api-key` (эндпоинт требует авторизацию, поэтому проверяет
 * и адрес, и ключ): 200 — ключ валиден, 401 — неверный ключ.
 */

import { getSetting } from '../db/settingsRepository';

/** Таймаут запроса к Immich (мс). */
const REQUEST_TIMEOUT_MS = 8000;

/** Версия сервера Immich. */
export interface ImmichServerVersion {
  major: number;
  minor: number;
  patch: number;
}

/** Результат проверки соединения. Ошибки не бросаются — возвращаются структурой. */
export interface ImmichCheckResult {
  ok: boolean;
  /** Версия сервера при успехе. */
  version?: ImmichServerVersion;
  /** Сообщение об ошибке при неудаче. */
  error?: string;
}

/**
 * Нормализует адрес инстанса Immich до базового URL API.
 * Принимает и голый хост (`https://host`), и адрес с `/api`
 * (`https://host/api`); убирает завершающий `/` и добавляет `/api`, если нет.
 */
export function normalizeImmichBaseUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, '');
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  if (!/\/api$/i.test(url)) {
    url = `${url}/api`;
  }
  return url;
}

/** Разбор версии из `/server/about`. Формат ответа зависит от версии Immich:
 *  старый — объект `serverVersion {major, minor, patch}`; новый (DTO v2) —
 *  строка `version` (например `"3.1.0"`). Возвращает `undefined`, если версии нет. */
function parseAboutVersion(data: unknown): ImmichServerVersion | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const rec = data as Record<string, unknown>;

  const obj = rec.serverVersion as
    { major?: unknown; minor?: unknown; patch?: unknown } | undefined;
  if (
    obj &&
    typeof obj.major === 'number' &&
    typeof obj.minor === 'number' &&
    typeof obj.patch === 'number'
  ) {
    return { major: obj.major, minor: obj.minor, patch: obj.patch };
  }

  if (typeof rec.version === 'string') {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(rec.version.trim());
    if (m) {
      return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
    }
  }

  return undefined;
}

/** `res.json()` без исключений (не JSON — вернёт `null`). */
async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** Версия из публичного `GET /server/version` (`{major, minor, patch}`) — запасной источник. */
async function fetchServerVersion(
  url: string,
  signal: AbortSignal,
): Promise<ImmichServerVersion | undefined> {
  try {
    const res = await fetch(`${url}/server/version`, { signal });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { major?: unknown; minor?: unknown; patch?: unknown };
    if (
      typeof data.major === 'number' &&
      typeof data.minor === 'number' &&
      typeof data.patch === 'number'
    ) {
      return { major: data.major, minor: data.minor, patch: data.patch };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Проверяет соединение с Immich: адрес + API-ключ. Результат — без исключений. */
export async function testImmichConnection(
  baseUrl: string,
  apiKey: string,
): Promise<ImmichCheckResult> {
  const url = normalizeImmichBaseUrl(baseUrl);
  if (!url) {
    return { ok: false, error: 'Укажите адрес инстанса Immich' };
  }
  if (!apiKey.trim()) {
    return { ok: false, error: 'Укажите API-ключ Immich' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${url}/server/about`, {
      headers: { 'x-api-key': apiKey.trim() },
      signal: controller.signal,
    });

    if (res.status === 401) {
      return { ok: false, error: 'Неверный API-ключ Immich' };
    }
    if (res.status === 403) {
      return { ok: false, error: 'API-ключу не хватает прав для проверки' };
    }
    if (!res.ok) {
      return { ok: false, error: `Immich ответил статусом ${res.status}` };
    }

    // 200 — ключ валиден: соединение установлено. Версия читается из
    // `/server/about` (оба формата), при отсутствии — из `/server/version`.
    let version = parseAboutVersion(await safeJson(res));
    if (!version) {
      version = await fetchServerVersion(url, controller.signal);
    }

    return { ok: true, version };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Таймаут: инстанс Immich не отвечает' };
    }
    return { ok: false, error: 'Не удалось подключиться к Immich' };
  } finally {
    clearTimeout(timer);
  }
}

// ── Пикер фото (вариант B2): поиск, миниатюры, оригиналы ─────────────────────

/** Ошибка взаимодействия с Immich с HTTP-статусом для ответа клиенту. */
export class ImmichError extends Error {
  constructor(
    message: string,
    readonly status: number = 502,
  ) {
    super(message);
    this.name = 'ImmichError';
  }
}

/** Реквизиты подключения к Immich из настроек; `null` — инстанс не настроен. */
export function getImmichCredentials(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = getSetting('immich.baseUrl');
  const apiKey = getSetting('immich.apiKey');
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey };
}

/** Запрос к Immich с API-ключом (таймаут). Ключ никогда не уходит на фронтенд. */
async function immichFetch(
  baseUrl: string,
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers = new Headers(init.headers ?? {});
    headers.set('x-api-key', apiKey);
    return await fetch(`${baseUrl}${path}`, { ...init, headers, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ImmichError('Таймаут: инстанс Immich не отвечает');
    }
    throw new ImmichError('Не удалось подключиться к Immich');
  } finally {
    clearTimeout(timer);
  }
}

/** Краткое описание ассета для пикера (вариант B2). */
export interface ImmichAssetSummary {
  id: string;
  fileName: string;
  /** MIME-тип (`image/jpeg` и т.п.) либо `null`. */
  mimeType: string | null;
  /** Дата съёмки (ISO) либо `null`. */
  takenAt: string | null;
}

export interface ImmichSearchParams {
  /** Граница «снято после» (ISO datetime). */
  takenAfter?: string;
  /** Граница «снято до» (ISO datetime). */
  takenBefore?: string;
  /** Страница (1-based). */
  page?: number;
  /** Размер страницы (по умолчанию 60, максимум 200). */
  size?: number;
}

export interface ImmichSearchResult {
  items: ImmichAssetSummary[];
  total: number;
  /** Номер следующей страницы или `null`. */
  nextPage: number | null;
}

/** MIME, которые можно импортировать в событие (совпадает с `uploadImages.ts`). */
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif)$/i;

/** Проходит ли ассет фильтр «можно импортировать» (по MIME или расширению имени). */
function isAllowedImage(mime: unknown, fileName: unknown): boolean {
  if (typeof mime === 'string' && ALLOWED_IMAGE_MIME.has(mime.toLowerCase())) return true;
  if (typeof fileName === 'string' && IMAGE_EXT_RE.test(fileName)) return true;
  return false;
}

/**
 * Поиск фото в Immich: `POST <base>/search/metadata` (по диапазону дат съёмки,
 * только изображения). Возвращает ассеты, допустимые к импорту в событие.
 */
export async function searchImmichAssets(
  params: ImmichSearchParams = {},
): Promise<ImmichSearchResult> {
  const creds = getImmichCredentials();
  if (!creds) throw new ImmichError('Инстанс Immich не настроен', 400);

  const page = Math.max(1, params.page ?? 1);
  const size = Math.min(200, Math.max(1, params.size ?? 60));

  const body: Record<string, unknown> = { type: 'IMAGE', order: 'desc', page, size };
  if (params.takenAfter) body.takenAfter = params.takenAfter;
  if (params.takenBefore) body.takenBefore = params.takenBefore;

  const res = await immichFetch(creds.baseUrl, creds.apiKey, '/search/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new ImmichError('Неверный API-ключ Immich', 401);
  if (res.status === 403) throw new ImmichError('Недостаточно прав API-ключа Immich', 403);
  if (!res.ok) throw new ImmichError(`Immich ответил статусом ${res.status}`);

  const data = (await res.json()) as {
    assets?: { items?: unknown[]; total?: number; nextPage?: number };
  };

  const items: ImmichAssetSummary[] = (data.assets?.items ?? [])
    .filter((raw): raw is Record<string, unknown> => Boolean(raw) && typeof raw === 'object')
    .filter((item) => isAllowedImage(item.originalMimeType, item.originalFileName))
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : '',
      fileName:
        typeof item.originalFileName === 'string'
          ? item.originalFileName
          : typeof item.id === 'string'
            ? item.id
            : 'photo',
      mimeType:
        typeof item.originalMimeType === 'string' ? item.originalMimeType.toLowerCase() : null,
      takenAt: typeof item.localDateTime === 'string' ? item.localDateTime : null,
    }))
    .filter((item) => item.id !== '');

  return {
    items,
    total: typeof data.assets?.total === 'number' ? data.assets.total : items.length,
    nextPage: typeof data.assets?.nextPage === 'number' ? data.assets.nextPage : null,
  };
}

/**
 * Возвращает Response от Immich для бинарного файла ассета (миниатюра/оригинал).
 * Тело не читается — контроллер проксирует поток наружу.
 */
export async function fetchImmichAssetBinary(
  assetId: string,
  kind: 'thumbnail' | 'original',
): Promise<Response> {
  const creds = getImmichCredentials();
  if (!creds) throw new ImmichError('Инстанс Immich не настроен', 400);
  const suffix = kind === 'thumbnail' ? '?size=thumbnail' : '';
  const path = `/assets/${encodeURIComponent(assetId)}/${kind}${suffix}`;
  const res = await immichFetch(creds.baseUrl, creds.apiKey, path);
  if (res.status === 401) throw new ImmichError('Неверный API-ключ Immich', 401);
  if (res.status === 403) throw new ImmichError('Недостаточно прав API-ключа Immich', 403);
  if (res.status === 404) throw new ImmichError('Ассет не найден', 404);
  if (!res.ok) throw new ImmichError(`Immich ответил статусом ${res.status}`);
  return res;
}
