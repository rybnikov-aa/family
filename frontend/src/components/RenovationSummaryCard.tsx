import type { ReactNode } from 'react';
import { formatKopecks } from '../utils/money';

/** Прогресс освоения бюджета для прогресс-бара под заголовком карточки. */
interface RenovationProgress {
  /** Освоение, % (может превышать 100 при перерасходе). */
  percent: number;
  /** Факт — сумма по актам/заказам, копейки. */
  done: number;
  /** План/бюджет — сумма по актуальной смете или бюджет на материалы, копейки. */
  total: number;
  /** Подпись перед суммой факта (например «Сумма по заказам:»). */
  doneLabel?: string;
  /** Заменяет сумму плана/бюджета в подписи (например ссылка на бюджет). */
  totalLabel?: ReactNode;
}

interface RenovationSummaryCardProps {
  title: string;
  /** Прогресс освоения бюджета — прогресс-бар под заголовком. */
  progress?: RenovationProgress | null;
  children: ReactNode;
}

/**
 * Карточка-сводка «Ремонта» (Работы / Материалы).
 * Самостоятельный примитив, не зависящий от ссылочной `.card` разделов проектов
 * (в `.renov-card` нет hover-подъёма и `align-items: flex-start` от `.card`).
 */
function RenovationSummaryCard({ title, progress, children }: RenovationSummaryCardProps) {
  // Ширина заливки ограничена 0–100%, само значение % может превышать 100.
  const fillWidth =
    progress && Number.isFinite(progress.percent)
      ? Math.min(100, Math.max(0, progress.percent))
      : 0;
  return (
    <div className="renov-card">
      <div className="renov-card__head">
        <span className="renov-card__title">{title}</span>
      </div>
      {progress && (
        <div className="renov-card__progress">
          <div className="renov-card__progress-track">
            <div className="renov-card__progress-fill" style={{ width: `${fillWidth}%` }} />
          </div>
          <div className="renov-card__progress-caption">
            <span>
              {progress.doneLabel ? `${progress.doneLabel} ` : ''}
              {formatKopecks(progress.done, true)} из{' '}
              {progress.totalLabel ?? formatKopecks(progress.total, true)}
            </span>
            <span>{progress.percent.toLocaleString('ru-RU')}%</span>
          </div>
        </div>
      )}
      <div className="renov-card__body">{children}</div>
    </div>
  );
}

export default RenovationSummaryCard;
