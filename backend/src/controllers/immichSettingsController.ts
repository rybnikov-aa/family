import type { Request, Response } from 'express';
import { getSetting, setSetting } from '../db/settingsRepository';
import { normalizeImmichBaseUrl, testImmichConnection } from '../services/immichService';

/** Ключи настроек Immich в таблице `settings`. */
const KEY_BASE_URL = 'immich.baseUrl';
const KEY_API_KEY = 'immich.apiKey';

/**
 * Текущие настройки Immich: `GET /api/settings/immich` (любой авторизованный).
 * Адрес инстанса нужен для ссылок «Фотоархив»/«Архив» в UI, поэтому чтение
 * не ограничено ролью. API-ключ клиенту не возвращается — только признак
 * «ключ задан» (форма показывает placeholder, пустое поле = оставить прежний ключ).
 */
export function getImmichSettingsController(_req: Request, res: Response): void {
  res.json({
    baseUrl: getSetting(KEY_BASE_URL),
    apiKeyConfigured: Boolean(getSetting(KEY_API_KEY)),
  });
}

/**
 * Проверка соединения с Immich: `POST /api/settings/immich/check` (admin).
 * Тело — `{ baseUrl, apiKey? }`. При успехе реквизиты сохраняются в БД;
 * при ошибке БД не меняется (ответ — `{ok: false, error}` с HTTP 200 —
 * это бизнес-результат проверки, а не ошибка сервера).
 */
export async function checkImmichSettingsController(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl : '';
  const apiKeyInput = typeof body.apiKey === 'string' ? body.apiKey : '';

  // Пустое поле ключа = проверяем сохранённым (повторная проверка не затирает ключ).
  const savedKey = getSetting(KEY_API_KEY) ?? '';
  const apiKey = apiKeyInput.trim() !== '' ? apiKeyInput : savedKey;

  const result = await testImmichConnection(baseUrl, apiKey);
  if (!result.ok) {
    res.json({ ok: false, error: result.error });
    return;
  }

  // Успех → сохраняем: адрес всегда (нормализованный), ключ — если передан.
  setSetting(KEY_BASE_URL, normalizeImmichBaseUrl(baseUrl));
  if (apiKeyInput.trim() !== '') {
    setSetting(KEY_API_KEY, apiKeyInput.trim());
  }

  res.json({ ok: true, version: result.version });
}
