/**
 * Признак ошибки нарушения ограничения SQLite (UNIQUE и т.п.).
 * Конфликт определяется по `(errcode & 0xff) === 19` (SQLITE_CONSTRAINT),
 * НЕ по `err.code` (`ERR_SQLITE_ERROR`).
 */
export function isConstraintError(err: unknown): boolean {
  const sqliteErr = err as { errcode?: number } | undefined;
  return ((sqliteErr?.errcode ?? 0) & 0xff) === 19; // SQLITE_CONSTRAINT
}
