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
};
