import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Доступное имя кнопки (aria-label). */
  label: string;
  /** Всплывающая подсказка; если задана — показывается по наведению/фокусу. */
  tooltip?: string;
  /** Размер: md (32px, по умолчанию), sm (24px), xs (20px). */
  size?: 'md' | 'sm' | 'xs';
  /** Прозрачный фон (для кнопок в плотных списках). */
  plain?: boolean;
  /** Опасное действие — красный цвет при наведении. */
  danger?: boolean;
  /** Активное состояние (например, «скопировано» — зелёный). */
  active?: boolean;
  /** Вращение иконки (индикация обновления). */
  spinning?: boolean;
  /** Иконка (inline SVG) или текст. */
  children: ReactNode;
}

/**
 * Квадратная кнопка-иконка — единый паттерн для: выхода, закрытия модалки,
 * обновления, «+», импорта, копирования, удаления и т.п.
 * Подсказка задаётся через `tooltip` (data-tooltip).
 */
function IconButton({
  label,
  tooltip,
  size = 'md',
  plain = false,
  danger = false,
  active = false,
  spinning = false,
  className = '',
  children,
  ...rest
}: IconButtonProps) {
  const classes = [
    'icon-btn',
    `icon-btn--${size}`,
    plain ? 'icon-btn--plain' : '',
    danger ? 'icon-btn--danger' : '',
    active ? 'icon-btn--active' : '',
    spinning ? 'icon-btn--spinning' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      aria-label={label}
      title={tooltip ?? label}
      data-tooltip={tooltip}
      {...rest}
    >
      <span className="icon-btn__icon" aria-hidden="true">
        {children}
      </span>
    </button>
  );
}

export default IconButton;
