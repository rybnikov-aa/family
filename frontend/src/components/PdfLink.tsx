import type { ReactNode } from 'react';
import { DocIcon } from './icons';

interface PdfLinkProps {
  /** URL исходного PDF для просмотра. */
  url: string;
  /** Заголовок просмотрщика PDF. */
  title: string;
  /** Открыть PDF во встроенном просмотрщике (url, заголовок). */
  onOpenPdf?: (url: string, title: string, fitToWidth?: boolean) => void;
  /** Растягивать форму просмотрщика под ширину документа (дизайн-проект). */
  fitToWidth?: boolean;
  /** Текст ссылки (имя документа). */
  children: ReactNode;
  /** Доп. класс для стилизации в конкретном списке (например `design-modal__link`). */
  className?: string;
}

/**
 * Ссылка на исходный PDF документа «Ремонта» (дизайн-правило): если по ссылке
 * открывается просмотр PDF, перед такой ссылкой всегда стоит иконка документа
 * (`DocIcon`). Открывает документ во встроенном просмотрщике (`onOpenPdf`).
 * Используется в списках документов карточек-сводок («Работы»/«Материалы»),
 * ведомостях взаиморасчётов, отчёте «Материалы» и модалках «Смета»/«Дизайн-проект».
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
