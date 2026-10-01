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

    let left = rect.left;
    let top = rect.bottom + 6;

    // Check popover dimensions if rendered
    if (popoverRef.current) {
      const popoverRect = popoverRef.current.getBoundingClientRect();
      // If overflows right edge of screen, shift left
      if (left + popoverRect.width > viewportWidth - 12) {
        left = Math.max(12, viewportWidth - popoverRect.width - 12);
      }
      // If overflows bottom edge of screen, place above trigger
      if (top + popoverRect.height > viewportHeight - 12 && rect.top > popoverRect.height + 12) {
        top = rect.top - popoverRect.height - 6;
      }
    }

    setCoords({
      top: Math.max(6, top),
      left: Math.max(6, left),
      width: matchWidth ? rect.width : undefined,
    });
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleMouseDownOutside = (e: MouseEvent) => {
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

    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    document.addEventListener('mousedown', handleMouseDownOutside);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handleMouseDownOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        width: coords.width ? `${coords.width}px` : undefined,
        zIndex: 9999,
      }}
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
};
