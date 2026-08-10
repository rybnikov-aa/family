import type { ReactNode } from 'react';
import { formatDateIso, formatKopecks } from '../utils/money';
import { CheckIcon } from './icons';

interface RenovDocRowProps {
  /** Дата документа (ISO `YYYY-MM-DD`) — левая колонка. */
  date: string;
  /** Имя документа («Отчёт №1» / «Акт №1») — колонка-ссылка. */
  name: ReactNode;
  /** Сумма документа, копейки — правая колонка. */
  sum: number | null;
  /** Учтён ли документ в ведомости взаиморасчётов: зелёная галочка / жёлтая точка. */
  accounted: boolean;
  /** URL исходного PDF — имя становится кнопкой-ссылкой. */
  pdfPath?: string | null;
  /** Заголовок просмотрщика PDF (по умолчанию «{имя} от {дата}»). */
  pdfTitle?: string;
  /** Открыть PDF во встроенном просмотрщике (url, заголовок). */
  onOpenPdf?: (url: string, title: string) => void;
}

/**
 * Строка документа «Ремонта» в четыре столбца: дата | имя (ссылка на PDF) |
 * сумма | статус учёта в ведомости. Используется в «Блоке 1. Работы» (акты) и
 * «Блоке 2. Материалы» (заказы).
 */
function RenovDocRow({
  date,
  name,
  sum,
  accounted,
  pdfPath,
  pdfTitle,
  onOpenPdf,
}: RenovDocRowProps) {
  const title = pdfTitle ?? `${name} от ${formatDateIso(date)}`;
  return (
    <div className="renov-doc-row">
      <span className="renov-doc-date">{formatDateIso(date)}</span>
      <span className="renov-doc-name">
        {pdfPath ? (
          <button type="button" className="renov-link" onClick={() => onOpenPdf?.(pdfPath, title)}>
            {name}
          </button>
        ) : (
          name
        )}
      </span>
      <span className="renov-doc-value">{formatKopecks(sum, true)}</span>
      <span
        className="renov-doc-status"
        title={
          accounted ? 'Учтён в ведомости взаиморасчётов' : 'Ещё не учтён в ведомости взаиморасчётов'
        }
      >
        {accounted ? <CheckIcon className="renov-doc-check" /> : <span className="renov-doc-dot" />}
      </span>
    </div>
  );
}

export default RenovDocRow;
