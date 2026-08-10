/** Сегодня в формате ГГГГ-ММ-ДД (локальное время). */
export function todayIso(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/**
 * Календарные дни между датами `from` и `to` (разница «to − from»).
 * Если даты некорректны или `from` позже `to` — возвращает 0.
 */
export function calendarDaysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / 86400000);
}
