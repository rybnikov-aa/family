import { getDb } from './database';

/**
 * Общие настройки приложения (key-value) в основной БД (`DB_PATH`).
 *
 * Используются для админ-настроек подключения к внешним сервисам (сейчас —
 * Immich: `immich.baseUrl`, `immich.apiKey`). Таблица `settings` создаётся
 * автоматически в схеме `db/database.ts`; файл БД сохраняется при деплое
 * (как часть `server/data/`), поэтому реквизиты переживают перезапуск.
 *
 * API-ключи не должны возвращаться клиенту — фронтенд получает только признак
 * «ключ задан» (см. `controllers/immichSettingsController.ts`).
 */

/** Возвращает значение настройки или `null`, если ключ не задан. */
export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    { value: string } | undefined;
  return row?.value ?? null;
}

/** Сохраняет значение настройки (upsert по ключу). */
export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .run(key, value);
}
