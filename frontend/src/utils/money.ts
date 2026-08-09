/**
 * Форматирование денег на фронтенде (проект «Ремонт»).
 * Бэкенд отдаёт суммы/количества целыми копейками (×100); здесь приводим их
 * к конвенции проекта: неразрывный пробел тысяч и запятая как десятичный
 * разделитель (`141 127,88 ₽`). `null` → «—». Зеркало `backend/.../domain/money.ts`.
 */
export function formatKopecks(kopecks: number | null | undefined, withCurrency = false): string {
  if (kopecks == null) return '—';
  const sign = kopecks < 0 ? '-' : '';
  const abs = Math.abs(kopecks);
  const rub = Math.floor(abs / 100);
  const kop = String(abs % 100).padStart(2, '0');
  const rubStr = String(rub).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  const s = `${sign}${rubStr},${kop}`;
  return withCurrency ? `${s} ₽` : s;
}

/** `2026-08-09` → `09.08.2026` (отображение дат документов). */
export function formatDateIso(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}
