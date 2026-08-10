import StatRow from './StatRow';
import { formatDateIso, formatKopecks } from '../utils/money';

interface RenovationSettlementProps {
  /** Заголовок секции без даты, например «Взаиморасчёты (работы)». */
  title: string;
  /** Дата ведомости (ISO `YYYY-MM-DD`) — выводится pill-тегом после заголовка. */
  date?: string;
  /** Подпись строки «Внесено» (заказчиком / по ведомости). */
  paidInLabel: string;
  paidIn: number | null;
  /** Подпись строки «Использовано» (в т.ч. «с накладными»). */
  usedLabel: string;
  used: number | null;
  balance: number | null;
  /** URL исходного PDF ведомости — заголовок становится ссылкой-кнопкой. */
  pdfPath?: string | null;
  /** Открыть PDF во встроенном просмотрщике (url, заголовок). */
  onOpenPdf?: (url: string, title: string) => void;
}

/**
 * Секция взаиморасчётов карточки-сводки «Ремонта» (работы или материалы).
 * Обёрнута в `.renov-section` — прижата к низу карточки, заполняет свободное место.
 */
function RenovationSettlement({
  title,
  date,
  paidInLabel,
  paidIn,
  usedLabel,
  used,
  balance,
  pdfPath,
  onOpenPdf,
}: RenovationSettlementProps) {
  const balanceTone =
    balance == null ? undefined : balance > 0 ? 'pos' : balance < 0 ? 'neg' : undefined;
  const fullTitle = date ? `${title}, ${formatDateIso(date)}` : title;
  return (
    <div className="renov-section">
      <div className="renov-divider" />
      <StatRow
        label={
          <>
            {pdfPath ? (
              <button
                type="button"
                className="renov-link"
                onClick={() => onOpenPdf?.(pdfPath, fullTitle)}
              >
                {title}
              </button>
            ) : (
              title
            )}
            {date && <span className="renov-pill">{formatDateIso(date)}</span>}
          </>
        }
      />
      <StatRow sub label={paidInLabel} value={formatKopecks(paidIn, true)} tone="blue" />
      <StatRow sub label={usedLabel} value={formatKopecks(used, true)} />
      <StatRow sub label="Остаток" value={formatKopecks(balance, true)} tone={balanceTone} />
    </div>
  );
}

export default RenovationSettlement;
