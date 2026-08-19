import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  /** Текст всплывающей подсказки. */
  content: string;
  /** Элемент, к которому привязана подсказка. */
  children: ReactNode;
}

interface TooltipPosition {
  left: number;
  top: number;
}

/**
 * Подсказка в portal поверх интерфейса: не зависит от overflow родительских
 * контейнеров и заменяет нативный title единым стилем.
 */
function Tooltip({ content, children }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  useLayoutEffect(() => {
    if (!visible) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const tooltip = tooltipRef.current?.getBoundingClientRect();
      if (!trigger || !tooltip) return;

      const edgeGap = 8;
      const gap = 6;
      const left = Math.min(
        Math.max(edgeGap, trigger.left + trigger.width / 2 - tooltip.width / 2),
        window.innerWidth - tooltip.width - edgeGap,
      );
      const top =
        trigger.top >= tooltip.height + gap + edgeGap
          ? trigger.top - tooltip.height - gap
          : trigger.bottom + gap;
      setPosition({ left, top });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [visible]);

  return (
    <>
      <span
        ref={triggerRef}
        className="tooltip-trigger"
        aria-describedby={visible ? tooltipId : undefined}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <span
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            className="tooltip"
            style={
              {
                left: position?.left ?? -10000,
                top: position?.top ?? -10000,
                visibility: position ? 'visible' : 'hidden',
              } satisfies CSSProperties
            }
          >
            {content}
          </span>,
          document.body,
        )}
    </>
  );
}

export default Tooltip;
