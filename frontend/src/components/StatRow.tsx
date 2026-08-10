import type { ReactNode } from 'react';

type StatTone = 'blue' | 'pos' | 'neg';

interface StatRowProps {
  label: ReactNode;
  /** Значение справа; `undefined` — правая колонка не выводится. */
  value?: ReactNode;
  /** Тон значения: акцентные цвета (`--color-accent-sky` / success / danger). */
  tone?: StatTone;
  /** Под-строка: отступ и меньший кегль (вложенные показатели ведомости). */
  sub?: boolean;
  /** Доп. класс значения (например список ссылок-документов `renov-value--list`). */
  valueClassName?: string;
}

/**
 * Строка «показатель — значение» сводки «Ремонта» (Работы / Материалы).
 * Единый примитив вместо ручной разметки `.renov-line` + `.renov-value`.
 */
function StatRow({ label, value, tone, sub = false, valueClassName = '' }: StatRowProps) {
  const rowClass = ['renov-line', sub && 'renov-line--sub'].filter(Boolean).join(' ');
  const valueClass = ['renov-value', tone && `renov-value--${tone}`, valueClassName]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={rowClass}>
      <span className="renov-label">{label}</span>
      {value != null && <span className={valueClass}>{value}</span>}
    </div>
  );
}

export default StatRow;
