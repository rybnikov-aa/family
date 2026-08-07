import 'dotenv/config';

/** Разбор положительного целого из env (порт, часы и т.п.); при невалидном — fallback. */
const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = {
  PORT: parsePositiveInt(process.env.PORT, 3000),
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

  // ── Авторизация ────────────────────────────────────────────────────────────
  /** Имя cookie сессии (httpOnly, SameSite=Lax). */
  AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME ?? 'sid',
  /** Срок жизни сессии в часах (по умолчанию 7 суток). */
  SESSION_TTL_HOURS: parsePositiveInt(process.env.SESSION_TTL_HOURS, 168),
  /**
   * Bootstrap администратора: если в БД ещё нет ни одного пользователя,
   * при старте создаётся учётка с ролью `admin`. Пароль берётся из этой
   * переменной. После создания первого пользователя переменную можно убрать
   * из `.env` (дальнейшие учётки создаются скриптом `npm run user -w backend`).
   */
  AUTH_BOOTSTRAP_PASSWORD: process.env.AUTH_BOOTSTRAP_PASSWORD ?? '',
  AUTH_BOOTSTRAP_USERNAME: process.env.AUTH_BOOTSTRAP_USERNAME ?? 'admin',
  AUTH_BOOTSTRAP_NAME: process.env.AUTH_BOOTSTRAP_NAME ?? 'Администратор',
};
