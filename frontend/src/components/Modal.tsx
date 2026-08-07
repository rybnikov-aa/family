import { useEffect, type ReactNode } from 'react';
import IconButton from './IconButton';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface ModalProps {
  /** Заголовок модалки (также aria-label). */
  title: string;
  /** Закрыть модалку (крестик/подложка/Escape). */
  onClose: () => void;
  children: ReactNode;
  /** Расширенная ширина (сетка детализации в 2 столбца). */
  wide?: boolean;
  /** Дополнительные кнопки-иконки справа от заголовка. */
  actions?: ReactNode;
  /** Не закрывать по Escape (обработчик задан снаружи). */
  closeOnEscape?: boolean;
  /** Не закрывать по клику на подложку. */
  closeOnBackdrop?: boolean;
}

/**
 * Базовая модалка портала: подложка + карточка с заголовком и закрытием.
 * Закрытие — крестик, клик по подложке, Escape; пока открыта, страница
 * не прокручивается. Контент — `children`; кнопки-иконки — через `actions`.
 */
function Modal({
  title,
  onClose,
  children,
  wide = false,
  actions,
  closeOnEscape = true,
  closeOnBackdrop = true,
}: ModalProps) {
  useEscapeClose(onClose, closeOnEscape);

  // Блокируем прокрутку страницы под модалкой.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="modal-backdrop" onClick={closeOnBackdrop ? onClose : undefined}>
      <div
        className={`modal${wide ? ' modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <h3>{title}</h3>
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
