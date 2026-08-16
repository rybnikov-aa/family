import { useEffect, useState } from 'react';
import { fetchImmichSettings } from '../api/client';

/**
 * Текущий адрес инстанса Immich из админ-настроек (web-адрес без `/api`).
 *
 * Используется для ссылок «Фотоархив» (главная) и «Архив» (футер): адрес
 * настраивается в админке (`#/admin/settings`) и не хардкодится в коде.
 * Значение кэшируется на время сессии (модульный промис) — несколько
 * потребителей (главная + футер) не дублируют запрос; свежий адрес
 * подхватывается после перезагрузки страницы.
 *
 * Если адрес не задан — возвращает `null` (ссылки скрываются).
 */

/** Хранит API-адрес (с `/api`); из настроек приходит нормализованный вид. */
let cache: Promise<string | null> | null = null;

function loadImmichUrl(): Promise<string | null> {
  if (!cache) {
    cache = fetchImmichSettings()
      .then((settings) => {
        // В настройках — API-адрес (`…/api`), для ссылок нужен корень инстанса.
        return settings.baseUrl?.replace(/\/api\/?$/, '') ?? null;
      })
      .catch(() => null);
  }
  return cache;
}

/** Web-адрес инстанса Immich (без `/api`) либо `null`, если не настроен. */
export function useImmichSettings(): string | null {
  const [baseUrl, setBaseUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    loadImmichUrl().then((url) => {
      if (mounted) setBaseUrl(url);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return baseUrl;
}
