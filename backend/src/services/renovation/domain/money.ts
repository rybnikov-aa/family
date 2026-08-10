/**
 * Денежные и количественные величины проекта «Ремонт» (модуль renovation).
 *
 * Единая модель: все суммы и количества — **целые «копейки» (×100)**.
 * Причины:
 * - REAL в SQLite неточен, а пересчёт накладных 5% и сверка «суммы сходятся»
 *   (верификация импорта, отчёты) должны быть детерминированными;
 * - в PDF/HTML встречаются и запятая (`141 127,88`), и точка (`134 407.50`)
 *   как десятичный разделитель, а пробел — как разделитель тысяч; нормализация
 *   живёт здесь, в одном месте.
 *
 * Каноническая реализация (импорт PDF, отчёты, доп. соглашения).
 */

/** Целые копейки. Для количества — тоже ×100 (0,5 м.п. → 50). */
export type Kopecks = number;

const DECIMAL_RE = /^(-?\d+)[.,](\d{1,2})$/;
const INTEGER_RE = /^-?\d+$/;

/**
 * Разбирает строку числа в рублях/единицах (float с двумя знаками).
 * Поддерживает пробел/неразрывный пробел как разделитель тысяч, запятую или
 * точку как десятичный разделитель, суффиксы «₽»/«руб.» и «—»/пусто → null.
 */
export function parseDecimal(text: string | null | undefined): number | null {
  if (text == null) return null;
  let s = String(text)
    .replace(/₽/g, '')
    .replace(/руб(?:\.)?(?:лей)?/gi, '')
    .replace(/−/g, '-') // U+2212 «минус» (в PDF/HTML) → ASCII '-'
    .replace(/\s/g, '')
    .trim();
  if (s === '' || s === '—' || s === '–' || s === '-') return null;

  const dec = s.match(DECIMAL_RE);
  if (dec) {
    // Знак относится к модулю: -22 832,80 → -(22832 + 0.80), а не -22832 + 0.80.
    const sign = dec[1].startsWith('-') ? -1 : 1;
    const intPart = Math.abs(Number(dec[1]));
    const frac = Number(dec[2].padEnd(2, '0')) / 100;
    return sign * (intPart + frac);
  }
  if (INTEGER_RE.test(s)) return Number(s);
  return null;
}

/** Копейки из разобранного числа (округление — защита от float-хвостов). */
export function toKopecks(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Math.round(value * 100);
}

/** Копейки из строки (см. `parseDecimal` + `toKopecks`). */
export function parseKopecks(text: string | null | undefined): number | null {
  return toKopecks(parseDecimal(text));
}

/** Сумма копеек по непустым значениям; если все пустые — null. */
export function sumKopecks(values: ReadonlyArray<number | null | undefined>): number | null {
  let has = false;
  let sum = 0;
  for (const v of values) {
    if (v != null) {
      has = true;
      sum += v;
    }
  }
  return has ? sum : null;
}

/** Накладные от суммы: `ratePercent` % (по умолчанию 5), округление к копейке. */
export function overheadOf(totalKopecks: number, ratePercent = 5): number {
  return Math.round((totalKopecks * ratePercent) / 100);
}

/**
 * Форматирование копеек в конвенции проекта: неразрывный пробел тысяч и
 * запятая как десятичный разделитель (`141 127,88`). `null` → «—».
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
