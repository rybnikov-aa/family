/**
 * Брендинг приложения: домен и заголовки вкладок.
 * Домен берётся из текущего хоста, чтобы заголовки/футер соответствовали
 * адресу публикации.
 */
export const APP_DOMAIN = window.location.hostname;

/** Заголовок вкладки: «{раздел} • {домен}». */
export const pageTitle = (section: string): string => `${section} • ${APP_DOMAIN}`;
