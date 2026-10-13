import React, { useState, useRef, useEffect, useId, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

export interface AppTooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: 'top' | 'bottom';
  disabled?: boolean;
}

export function AppTooltip({
  content,
  children,
  placement = 'top',
  disabled = false,
}: AppTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipId = useId();
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = triggerRect.left + triggerRect.width / 2;
    let top = placement === 'top' ? triggerRect.top - 8 : triggerRect.bottom + 8;

    if (tooltipRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      left = left - tooltipRect.width / 2;

      // Prevent horizontal overflow
      if (left < 12) {
        left = 12;
      } else if (left + tooltipRect.width > viewportWidth - 12) {
        left = Math.max(12, viewportWidth - tooltipRect.width - 12);
      }

      // Vertical flip if needed
      if (placement === 'top') {
        top = top - tooltipRect.height;
        if (top < 8) {
          // Flip to bottom if clipping top edge
          top = triggerRect.bottom + 8;
        }
      } else {
        if (top + tooltipRect.height > viewportHeight - 8) {
          // Flip to top if clipping bottom edge
          top = triggerRect.top - tooltipRect.height - 8;
        }
      }
    }

    setCoords({
      top: Math.max(8, Math.round(top)),
      left: Math.max(8, Math.round(left)),
    });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const raf = requestAnimationFrame(() => {
      updatePosition();
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  if (disabled || !content) {
    return children;
  }

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Clone child element and wire up trigger events and accessible aria attributes
  const childProps = (children as any).props || {};
  const clonedChild = React.cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const existingRef = (children as any).ref;
      if (typeof existingRef === 'function') {
        existingRef(node);
      } else if (existingRef && typeof existingRef === 'object') {
        existingRef.current = node;
      }
    },
    'aria-describedby': isOpen ? tooltipId : childProps['aria-describedby'],
    onMouseEnter: (e: React.MouseEvent) => {
      handleOpen();
      childProps.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      handleClose();
      childProps.onMouseLeave?.(e);
    },
    onPointerEnter: (e: React.PointerEvent) => {
      handleOpen();
      childProps.onPointerEnter?.(e);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      handleClose();
      childProps.onPointerLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      handleOpen();
      childProps.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      handleClose();
      childProps.onBlur?.(e);
    },
  });

  return (
    <>
      {clonedChild}
      {isOpen &&
        createPortal(
          <div
            id={tooltipId}
            ref={tooltipRef}
            role="tooltip"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 9999,
              opacity: coords.top === 0 && coords.left === 0 ? 0 : 1,
            }}
            className="pointer-events-none animate-in fade-in zoom-in-95 duration-150 select-none"
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
