import { useLayoutEffect, useRef } from 'react';

// Активный (верхний) обработчик Escape. Модульный стек вместо глобального DOM-состояния:
// при нескольких одновременно открытых модалках слушатель остаётся у всех, но закрывает
// только последний зарегистрированный (верхний) слой — нижний «просыпается» при его
// размонтировании (восстановление `previous`). Осознанный компромисс для текущего дерева
// модалок; при усложнении стека заменить на явный контекст со слоями.
let activeEscapeClose: (() => void) | null = null;

/**
 * Закрытие по Escape. Используется модалками и вложенными оверлеями.
 * `enabled=false` отключает слушатель (например, пока открыт вложенный редактор).
 * Обработчик всегда берётся из ref — эффект не переподписывается на каждый рендер.
 */
export function useEscapeClose(onClose: () => void, enabled = true): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    if (!enabled) return;
    const previous = activeEscapeClose;
    const close = () => onCloseRef.current();
    activeEscapeClose = close;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeEscapeClose === close) close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (activeEscapeClose === close) activeEscapeClose = previous;
    };
  }, [enabled]);
}
