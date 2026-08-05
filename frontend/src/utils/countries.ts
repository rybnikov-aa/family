/** Вариант страны для выбора расположения VPS (ISO-код + русская подпись). */
export interface CountryOption {
  /** ISO-код страны (для флага flagcdn.com и БД) */
  code: string;
  /** Русская подпись для выпадающего списка */
  label: string;
}

/** Справочник стран для формы добавления VPS. */
export const COUNTRIES: CountryOption[] = [
  { code: 'nl', label: 'Нидерланды' },
  { code: 'de', label: 'Германия' },
  { code: 'ru', label: 'Россия' },
  { code: 'us', label: 'США' },
  { code: 'gb', label: 'Великобритания' },
  { code: 'fr', label: 'Франция' },
  { code: 'fi', label: 'Финляндия' },
  { code: 'se', label: 'Швеция' },
  { code: 'pl', label: 'Польша' },
  { code: 'lt', label: 'Литва' },
  { code: 'lv', label: 'Латвия' },
  { code: 'ee', label: 'Эстония' },
  { code: 'ua', label: 'Украина' },
  { code: 'cz', label: 'Чехия' },
  { code: 'ch', label: 'Швейцария' },
  { code: 'at', label: 'Австрия' },
  { code: 'sg', label: 'Сингапур' },
  { code: 'jp', label: 'Япония' },
  { code: 'ca', label: 'Канада' },
  { code: 'au', label: 'Австралия' },
];

/** Подпись страны по ISO-коду (для выпадающего списка). */
export function countryLabel(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.label ?? code;
}
