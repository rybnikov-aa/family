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
  projects: '/projects',
  profile: '/profile',
  adminUsers: '/admin/users',
} as const;

export type AppRoute = keyof typeof ROUTES;
