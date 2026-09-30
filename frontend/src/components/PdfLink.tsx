import type { ReactNode } from 'react';
import { DocIcon } from './icons';

interface PdfLinkProps {
  /** URL исходного PDF для просмотра. */
  url: string;
  /** Заголовок просмотрщика PDF. */
  title: string;
  /** Открыть PDF во встроенном просмотрщике (url, заголовок). */
  onOpenPdf?: (url: string, title: string, fitToWidth?: boolean) => void;
  /** Растягивать форму просмотрщика под ширину документа. */
  fitToWidth?: boolean;
  /** Текст ссылки (имя документа). */
  children: ReactNode;
  /** Дополнительный CSS-класс для конкретного списка. */
  className?: string;
}

/**
 * Ссылка на исходный PDF документа «Ремонта» (дизайн-правило): если по ссылке
 * открывается просмотр PDF, перед такой ссылкой всегда стоит иконка документа
 * (`DocIcon`). Открывает документ во встроенном просмотрщике (`onOpenPdf`).
 * Используется в списках документов карточек-сводок («Работы»/«Материалы»),
 * ведомостях взаиморасчётов, отчёте «Материалы» и модалке «Смета».
 */
function PdfLink({ url, title, onOpenPdf, fitToWidth, children, className }: PdfLinkProps) {
  return (
    <button
      type="button"
      className={className ? `renov-link ${className}` : 'renov-link'}
      onClick={() => onOpenPdf?.(url, title, fitToWidth)}
      title="Открыть исходный документ (PDF)"
    >
      <DocIcon />
      {children}
    </button>
  );
}

export default PdfLink;
