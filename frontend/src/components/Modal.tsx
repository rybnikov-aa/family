import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import IconButton from './IconButton';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface ModalProps {
  /** Заголовок модалки (aria-labelledby); можно передавать ReactNode (например, с pill-датой). */
  title: ReactNode;
  /** Закрыть модалку (крестик/подложка/Escape). */
  onClose: () => void;
  children: ReactNode;
  /** Расширенная ширина (сетка детализации в 2 столбца). */
  wide?: boolean;
  /** Дополнительный класс модалки (например `modal--pdf` для просмотрщика PDF). */
  className?: string;
  /** Дополнительные кнопки-иконки справа от заголовка. */
  actions?: ReactNode;
  /** Не закрывать по Escape (обработчик задан снаружи). */
  closeOnEscape?: boolean;
  /** Не закрывать по клику на подложку. */
  closeOnBackdrop?: boolean;
  /** Верхний диалог: только он обрабатывает Escape и удерживает фокус. */
  isForeground?: boolean;
  /** Инлайн-стили карточки (например, ширина под контент просмотрщика PDF). */
  style?: CSSProperties;
}

/**
 * Базовая модалка портала: подложка + карточка с заголовком и закрытием.
 * В формах и сценариях с пользовательским вводом подложка не закрывает модалку:
 * данные сохраняются до явного действия пользователя (кнопка, Escape/крестик по
 * собственному согласованию). Пока открыта, страница не прокручивается, фокус
 * ловится внутри модалки (Tab/Shift+Tab) и при закрытии возвращается элементу,
 * который её открыл. Контент — `children`; кнопки-иконки в шапке — через `actions`.
 */
function Modal({
  title,
  onClose,
  children,
  wide = false,
  className,
  actions,
  closeOnEscape = true,
  closeOnBackdrop = false,
  isForeground = true,
  style,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEscapeClose(onClose, closeOnEscape && isForeground);

  // Фокус на модалку при открытии, блокировка прокрутки; возврат фокуса при закрытии.
  // Блокировка выполняется и у фоновых слоёв (isForeground=false): под верхней модалкой
  // страница всё равно должна оставаться зафиксированной; восстановление — по факту
  // размонтирования каждого слоя.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const dialog = dialogRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.focus();

    return () => {
      document.body.style.overflow = prev;
      previouslyFocused?.focus();
    };
  }, []);

  // Ловушка фокуса: Tab/Shift+Tab не уходят за пределы модалки.
  useEffect(() => {
    if (!isForeground) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const getFocusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = getFocusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isForeground]);

  return (
    <div className="modal-backdrop" onClick={closeOnBackdrop ? onClose : undefined}>
      <div
        ref={dialogRef}
        className={`modal${wide ? ' modal--wide' : ''}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={style}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <h3 id={titleId}>{title}</h3>
          <div className="modal__head-actions">
            {actions}
            <IconButton label="Закрыть" onClick={onClose}>
              ✕
            </IconButton>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export default Modal;
