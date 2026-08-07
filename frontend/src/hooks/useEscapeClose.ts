import { useEffect, useRef } from 'react';

/**
 * Закрытие по Escape. Используется модалками и вложенными оверлеями.
 * `enabled=false` отключает слушатель (например, пока открыт вложенный редактор).
 * Обработчик всегда берётся из ref — эффект не переподписывается на каждый рендер.
 */
export function useEscapeClose(onClose: () => void, enabled = true): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
