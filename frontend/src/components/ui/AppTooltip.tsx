import React, { useState, useRef, useEffect, useId, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

export interface AppTooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: 'top' | 'bottom';
  disabled?: boolean;
  className?: string;
}

export function AppTooltip({
  content,
  children,
  placement = 'top',
  disabled = false,
  className = '',
}: AppTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipId = useId();
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const isTouchInteractionRef = useRef(false);
  const touchTimerRef = useRef<number | null>(null);
  const resetTouchTimerRef = useRef<number | null>(null);

  const clearTouchTimer = () => {
    if (touchTimerRef.current !== null) {
      window.clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const clearResetTouchTimer = () => {
    if (resetTouchTimerRef.current !== null) {
      window.clearTimeout(resetTouchTimerRef.current);
      resetTouchTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTouchTimer();
      clearResetTouchTimer();
    };
  }, []);

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

  const handleOpen = () => {
    // Check if a modal is open and this tooltip is outside it
    const isInsideModal = Boolean(triggerRef.current?.closest('[role="dialog"], .fixed.inset-0.z-50'));
    const hasOpenModal = Boolean(document.querySelector('[role="dialog"], .fixed.inset-0.z-50'));
    if (hasOpenModal && !isInsideModal) {
      return;
    }

    if (triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const initialLeft = triggerRect.left + triggerRect.width / 2;
      const initialTop = placement === 'top' ? triggerRect.top - 20 : triggerRect.bottom + 8;
      setCoords({
        top: Math.max(8, Math.round(initialTop)),
        left: Math.max(8, Math.round(initialLeft)),
      });
    }
    setIsOpen(true);
  };

  const handleClose = () => {
    clearTouchTimer();
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      // On mobile touch scroll, dismiss tooltip immediately
      if (isTouchInteractionRef.current) {
        handleClose();
      } else {
        updatePosition();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    const handlePointerDownOutside = (e: PointerEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDownOutside);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [isOpen]);

  if (disabled || !content) {
    return children;
  }

  const childProps = (children as any).props || {};
  const isButtonElement =
    children.type === 'button' ||
    childProps.role === 'button' ||
    Boolean(childProps.onClick && (childProps['aria-label'] || typeof childProps.children === 'string'));

  const scheduleTouchReset = () => {
    clearResetTouchTimer();
    resetTouchTimerRef.current = window.setTimeout(() => {
      isTouchInteractionRef.current = false;
    }, 600);
  };

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
    title: undefined, // Suppress native title to avoid duplicate tooltip
    onPointerEnter: (e: React.PointerEvent) => {
      childProps.onPointerEnter?.(e);
      if (e.pointerType === 'touch') {
        isTouchInteractionRef.current = true;
        scheduleTouchReset();
        return;
      }
      isTouchInteractionRef.current = false;
      handleOpen();
    },
    onPointerLeave: (e: React.PointerEvent) => {
      childProps.onPointerLeave?.(e);
      if (e.pointerType === 'touch') return;
      handleClose();
    },
    onTouchStart: (e: React.TouchEvent) => {
      childProps.onTouchStart?.(e);
      isTouchInteractionRef.current = true;
      scheduleTouchReset();

      // On action buttons, prioritize natural single-tap execution; do not flash tooltip
      if (isButtonElement) {
        return;
      }

      // For purely informative elements, show tooltip with auto-dismiss after 3s
      handleOpen();
      clearTouchTimer();
      touchTimerRef.current = window.setTimeout(() => {
        handleClose();
      }, 3000);
    },
    onFocus: (e: React.FocusEvent) => {
      childProps.onFocus?.(e);
      // If focus originated from an internal descendant rather than the trigger element itself, do not open
      if (e.target !== e.currentTarget) {
        return;
      }
      // If focus was provoked by a touch interaction on an action button, do not pop open tooltip
      if (isTouchInteractionRef.current && isButtonElement) {
        return;
      }
      handleOpen();
    },
    onBlur: (e: React.FocusEvent) => {
      childProps.onBlur?.(e);
      handleClose();
    },
    onClick: (e: React.MouseEvent) => {
      childProps.onClick?.(e);
      // Close tooltip immediately on mouse click/navigation; don't flash-close on touch
      if (!isTouchInteractionRef.current) {
        handleClose();
      }
    },
  });

  const renderedContent =
    typeof content === 'string' || typeof content === 'number' ? (
      <div
        className={`px-2.5 py-1.5 rounded-lg bg-[var(--hc-surface)] border border-[var(--hc-border)] text-[var(--hc-text)] text-xs font-medium shadow-xl backdrop-blur-md max-w-xs text-center leading-snug ${className}`}
      >
        {content}
      </div>
    ) : (
      content
    );

  // Controlled z-index scale:
  // Layer hierarchy:
  // z-40: Sticky header
  // z-45: Page Tooltips (above cards & header, beneath modal backdrop z-50)
  // z-50: Modals & dialogs
  // z-60: Popovers (DatePickers)
  // z-70: Tooltips inside modals (above modal and popovers)
  const isInsideModal = Boolean(triggerRef.current?.closest('[role="dialog"], .fixed.inset-0.z-50'));
  const tooltipZIndex = isInsideModal ? 70 : 45;

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
              zIndex: tooltipZIndex,
              opacity: coords.top === 0 && coords.left === 0 ? 0 : 1,
            }}
            className="pointer-events-none animate-in fade-in zoom-in-95 duration-150 select-none motion-reduce:animate-none motion-reduce:transition-none"
          >
            {renderedContent}
          </div>,
          document.body
        )}
    </>
  );
}
