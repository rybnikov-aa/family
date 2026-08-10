import StatRow from './StatRow';
import { formatDateIso, formatKopecks } from '../utils/money';

interface RenovationSettlementProps {
  /** Заголовок секции без даты, например «Взаиморасчёты (работы)». */
  title: string;
  /** Дата ведомости (ISO `YYYY-MM-DD`) — выводится pill-тегом после заголовка. */
  date?: string;
  /** Подпись строки «Внесено» (заказчиком). */
  paidInLabel: string;
  paidIn: number | null;
  /** Итоговая сумма «Учтено всего», копейки. */
  used: number | null;
  balance: number | null;
  /** Сумма «подотчётные прораба» (если есть) — делит «Учтено» на две строки и ставит сноску на «Учтено всего». */
  foremenAmount?: number | null;
  /** Номер сноски в блоке «Примечания». */
  noteRef?: number | null;
  /** Расхождение «Учтено по актам» с суммой документов, учтённых в ведомости, копейки (если есть) — ставит сноску на «Учтено по актам». */
  diffAmount?: number | null;
  /** Номер сноски о расхождении в блоке «Примечания». */
  diffNoteRef?: number | null;
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
  used,
  balance,
  foremenAmount,
  noteRef,
  diffAmount,
  diffNoteRef,
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
      <StatRow
        sub
        label={
          diffAmount != null && diffAmount !== 0 ? (
            <>
              Учтено по актам
              <sup className="renov-note-ref">{diffNoteRef ?? 1}</sup>
            </>
          ) : (
            'Учтено по актам'
          )
        }
        value={formatKopecks(used == null ? null : used - (foremenAmount ?? 0), true)}
      />
      <StatRow
        sub
        label={
          foremenAmount != null ? (
            <>
              Учтено всего
              <sup className="renov-note-ref">{noteRef ?? 1}</sup>
            </>
          ) : (
            'Учтено всего'
          )
        }
        value={formatKopecks(used, true)}
      />
      <StatRow sub label="Остаток" value={formatKopecks(balance, true)} tone={balanceTone} />
    </div>
  );
}

export default RenovationSettlement;
