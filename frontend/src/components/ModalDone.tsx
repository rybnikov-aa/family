import type { ReactNode } from 'react';
import Button from './Button';
import { CheckIcon } from './icons';

interface ModalDoneProps {
  /** Текст результата (что выполнено). */
  message: ReactNode;
  /** Действие закрытия (кнопка «Закрыть»). */
  onClose: () => void;
}

/**
 * Успешный результат модалки («готово»): зелёная галочка, сообщение и кнопка
 * «Закрыть». Общий примитив вместо дублей `.addendum__done`/`.renov-pdf__done`
 * (модалки «Доп. соглашение» и «Импорт PDF»).
 */
function ModalDone({ message, onClose }: ModalDoneProps) {
  return (
    <div className="modal-done">
      <span className="modal-done__icon">
        <CheckIcon width="2rem" height="2rem" />
      </span>
      <div>{message}</div>
      <div className="modal-done__actions">
        <Button variant="primary" onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </div>
  );
}

export default ModalDone;
