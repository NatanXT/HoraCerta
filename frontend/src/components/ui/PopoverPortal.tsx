import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

export interface PopoverPortalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
  matchWidth?: boolean;
}

export const PopoverPortal: React.FC<PopoverPortalProps> = ({
  isOpen,
  onClose,
  triggerRef,
  children,
  className = '',
  matchWidth = false,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width?: number }>({
    top: 0,
    left: 0,
  });

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const MARGIN = 8;
    const GAP = 6;

    const spaceBelow = viewportHeight - rect.bottom - GAP - MARGIN;
    const spaceAbove = rect.top - GAP - MARGIN;

    const popoverRect = popoverRef.current?.getBoundingClientRect();
    const popoverHeight = popoverRect?.height ?? 320;
    const popoverWidth = popoverRect?.width ?? (matchWidth ? rect.width : 288);

    // 1. Vertical placement preference:
    // Try opening below if it fits completely
    let top: number;
    if (popoverHeight <= spaceBelow) {
      top = rect.bottom + GAP;
    } else if (popoverHeight <= spaceAbove) {
      // Flip above if it fits above
      top = rect.top - GAP - popoverHeight;
    } else {
      // Neither fits completely: place in direction with more available space
      if (spaceBelow >= spaceAbove) {
        top = rect.bottom + GAP;
      } else {
        top = rect.top - GAP - popoverHeight;
      }
    }

    // Safety clamp: ensure top stays strictly within viewport margins
    top = Math.max(MARGIN, Math.min(top, viewportHeight - popoverHeight - MARGIN));

    // 2. Horizontal placement:
    let left = rect.left;
    if (left + popoverWidth > viewportWidth - MARGIN) {
      left = Math.max(MARGIN, viewportWidth - popoverWidth - MARGIN);
    }
    if (left < MARGIN) {
      left = MARGIN;
    }

    setCoords({
      top: Math.round(top),
      left: Math.round(left),
      width: matchWidth ? rect.width : undefined,
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

    const handlePointerDownOutside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    document.addEventListener('pointerdown', handlePointerDownOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('pointerdown', handlePointerDownOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: coords.width ? `${coords.width}px` : undefined,
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: `calc(100vh - ${coords.top + 8}px)`,
        overflowY: 'auto',
        zIndex: 60,
      }}
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
};
