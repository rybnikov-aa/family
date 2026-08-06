import 'dotenv/config';

const parsePort = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = {
  PORT: parsePort(process.env.PORT, 3000),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  /** Путь к файлу SQLite. По умолчанию — `data/vps.sqlite` рядом с backend. */
  DB_PATH: process.env.DB_PATH ?? 'data/vps.sqlite',
  /**
   * Каталог проектов (раздел «Проекты»): подпапки с `index.html` считаются
   * проектами и обслуживаются по `/projects/<slug>/`. По умолчанию — папка
   * `public_html/projects` рядом с каталогом бэкенда (на сервере:
   * `/var/www/<host>/public_html/projects`; деплой зеркалит папку `projects/`
   * репозитория в неё 1:1). В dev можно указать путь к папке `projects/`
   * репозитория.
   */
  PROJECTS_DIR: process.env.PROJECTS_DIR ?? '../public_html/projects',
};
