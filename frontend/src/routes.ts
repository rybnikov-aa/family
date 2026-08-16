/**
 * Пути приложения.
 *
 * Используется hash-роутинг (createHashRouter): в nginx-конфиге главного хоста
 * `try_files $uri $uri/ =404` (нет SPA-fallback), поэтому обычные пути вида
 * `/news` давали бы 404. Хэш-форма `#/` и `#/news` работает без правок nginx.
 */
export const ROUTES = {
  home: '/',
  news: '/news',
  diary: '/diary',
  /** Страница события «Дневника», например `/diary/3`. */
  diaryEvent: '/diary/:id',
  projects: '/projects',
  profile: '/profile',
  adminUsers: '/admin/users',
  /** Админ-настройки (подключение к Immich и т.п.). */
  adminSettings: '/admin/settings',
  renovation: '/projects/renovation',
  /** Страница прикладного проекта (созданного через UI), например `/projects/dacha`. */
  project: '/projects/:slug',
} as const;

export type AppRoute = keyof typeof ROUTES;
