import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Вариант: вторичный (по умолчанию) или основной (акцентный). */
  variant?: 'secondary' | 'primary';
  /** Иконка слева от текста (inline SVG, наследует currentColor). */
  icon?: ReactNode;
}

/**
 * Кнопка действия/формы — единый паттерн портала.
 * Варианты: `secondary` (по умолчанию) и `primary` (акцент).
 */
function Button({
  variant = 'secondary',
  icon,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, className].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} {...rest}>
      {icon && (
        <span className="btn__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

export default Button;
