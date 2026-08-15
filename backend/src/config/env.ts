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
  /** Путь к файлу SQLite конфигурации VPS. По умолчанию — `data/vps.sqlite` рядом с backend. */
  DB_PATH: process.env.DB_PATH ?? 'data/vps.sqlite',

  /**
   * Путь к отдельной БД авторизации (пользователи + сессии). Это НЕ `DB_PATH` —
   * выделено в свой файл, чтобы частые записи сессий (каждый вход) не раздували
   * WAL и не конкурировали за блокировки с чтениями VPS. По умолчанию `data/auth.sqlite`.
   */
  AUTH_DB_PATH: process.env.AUTH_DB_PATH ?? 'data/auth.sqlite',

  /**
   * Путь к отдельной БД прикладных проектов (раздел «Проекты», kind: 'app').
   * Это НЕ `DB_PATH` и НЕ `AUTH_DB_PATH`. По умолчанию `data/projects.sqlite`.
   */
  PROJECTS_DB_PATH: process.env.PROJECTS_DB_PATH ?? 'data/projects.sqlite',

  // ── Дневник (diary) ────────────────────────────────────────────────────────
  /**
   * Путь к отдельной БД событий «Дневника». Это НЕ `DB_PATH` (база VPS) —
   * у раздела своя БД `data/diary.sqlite` (по умолчанию `DIARY_DB_PATH`).
   */
  DIARY_DB_PATH: process.env.DIARY_DB_PATH ?? 'data/diary.sqlite',
  /**
   * Каталог хранения изображений событий «Дневника». Относительно CWD бэкенда:
   * в dev — `backend/images`, на сервере — `server/images` (CWD приложения под
   * pm2 — `$SERVER`). Каждое событие — уникальная подпапка
   * `images/<folder>/`. Каталог сохраняется при деплое (как `data/` и `docs/`).
   */
  DIARY_IMAGES_DIR: process.env.DIARY_IMAGES_DIR ?? 'images',

  // ── Модуль «Ремонт» (renovation) ───────────────────────────────────────────
  /**
   * Путь к отдельной БД отчётности «Ремонта». Это НЕ `DB_PATH` (база VPS) —
   * у модуля своя БД. По умолчанию `data/renovation.sqlite` рядом с backend.
   * Наполняется штатно — через импорт PDF в приложении (POST /api/renovation/pdf).
   */
  RENOVATION_DB_PATH: process.env.RENOVATION_DB_PATH ?? 'data/renovation.sqlite',
  /**
   * Каталог сохранения загруженных PDF «Ремонта» (импорт PDF). Относительно CWD
   * бэкенда: в dev — `backend/docs/renovation`, на сервере — `server/docs/renovation`
   * (CWD приложения под pm2 — `$SERVER`). Каталог сохраняется при деплое (как `data/`).
   */
  RENOVATION_DOCS_DIR: process.env.RENOVATION_DOCS_DIR ?? 'docs/renovation',
  /**
   * Интерпретатор Python с pdfplumber (импорт PDF, этап 3). Пусто → по умолчанию
   * `<repo>/.venv/Scripts/python.exe` (Windows) либо `python`.
   */
  RENOVATION_PYTHON: process.env.RENOVATION_PYTHON ?? '',
  /**
   * Путь к скрипту `extract_pdf.py` (импорт PDF). Пусто → по умолчанию
   * `scripts/extract_pdf.py` относительно CWD (папка backend).
   */
  RENOVATION_EXTRACT_SCRIPT: process.env.RENOVATION_EXTRACT_SCRIPT ?? '',

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
