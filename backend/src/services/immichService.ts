/**
 * Сервис подключения к инстансу Immich (проверка соединения).
 *
 * Админ-настройки (адрес + API-ключ) хранятся в БД (`settings`), см.
 * `db/settingsRepository.ts`. Все вызовы Immich идут с бэкенда — ключ никогда
 * не отдаётся на фронтенд. Проверка соединения — `GET <base>/server/about`
 * с заголовком `x-api-key` (эндпоинт требует авторизацию, поэтому проверяет
 * и адрес, и ключ): 200 — ключ валиден, 401 — неверный ключ.
 */

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
