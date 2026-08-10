/**
 * Русское склонение существительного по числу.
 * `pluralize(1, 'акт', 'акта', 'актов') → 'акт'`; `pluralize(4, …) → 'акта'`; `pluralize(11, …) → 'актов'`.
 * Правила: 1 (и числа на 1, кроме 11) — `one`; 2–4 (и числа на 2–4, кроме 12–14) — `few`;
 * остальное (0, 5–20 и т.д.) — `many`.
 */
export function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 19) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
