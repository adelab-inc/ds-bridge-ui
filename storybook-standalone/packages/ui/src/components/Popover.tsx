import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useControllableState } from '../hooks/useControllableState';

const popoverVariants = cva('rounded-xl border border-border-subtle bg-bg-surface shadow-[0_4px_8px_0_rgba(0,0,0,0.20)]', ({
    variants: {
      "mode": {
        "base": "",
        "compact": "",
      },
    },
    defaultVariants: {
      "mode": "base",
    },
    compoundVariants: [
      {
        "class": "py-component-inset-popover-y px-component-inset-popover-x",
        "mode": "base",
      },
      {
        "class": "py-component-inset-popover-y-compact px-component-inset-popover-x-compact",
        "mode": "compact",
      },
    ],
  }));

// ─── Popover Context ───

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement>;
  contentId: string;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

const usePopoverContext = () => {
  const context = React.useContext(PopoverContext);
  if (!context) {
    throw new Error('Popover compound components must be used within Popover');
  }
  return context;
};

// ─── Popover Root ───

export interface PopoverRootProps {
  children: React.ReactNode;
  /** Controlled open state */
  open?: boolean;
  /** Default open state for uncontrolled mode */
  defaultOpen?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

const PopoverRoot: React.FC<PopoverRootProps> = ({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
}) => {
  const [open, setOpen] = useControllableState(controlledOpen, defaultOpen, onOpenChange);
  const triggerRef = React.useRef<HTMLElement>(null);
  const contentId = React.useId();

  const contextValue: PopoverContextValue = {
    open,
    setOpen,
    triggerRef,
    contentId,
  };

  return (
    <PopoverContext.Provider value={contextValue}>
      {children}
    </PopoverContext.Provider>
  );
};
PopoverRoot.displayName = 'Popover';

// ─── Popover Trigger ───

export interface PopoverTriggerProps {
  children: React.ReactElement;
}

const PopoverTrigger: React.FC<PopoverTriggerProps> = ({ children }) => {
  const { open, setOpen, triggerRef, contentId } = usePopoverContext();

  const handleClick = (e: React.MouseEvent) => {
    setOpen(!open);
    children.props.onClick?.(e);
  };

  return React.cloneElement(children, {
    ref: (el: HTMLElement | null) => {
      (triggerRef as React.MutableRefObject<HTMLElement | null>).current = el;
      const childRef = (children as unknown as { ref?: React.Ref<HTMLElement> }).ref;
      if (typeof childRef === 'function') {
        childRef(el);
      } else if (childRef) {
        (childRef as React.MutableRefObject<HTMLElement | null>).current = el;
      }
    },
    onClick: handleClick,
    'aria-expanded': open,
    'aria-haspopup': 'dialog' as const,
    'aria-controls': open ? contentId : undefined,
  });
};
PopoverTrigger.displayName = 'Popover.Trigger';

// ─── Popover Content ───

export interface PopoverContentProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'content'>,
    VariantProps<typeof popoverVariants> {
  children: React.ReactNode;
  /** Width mode: match trigger width or hug content */
  widthMode?: 'match-trigger' | 'hug-content';
  /** Horizontal alignment relative to trigger */
  align?: 'start' | 'center' | 'end';
  /** Preferred side to open */
  side?: 'bottom' | 'top';
  /** Gap between trigger and content (px) */
  sideOffset?: number;
  /** Maximum height of content area (px) */
  maxHeight?: number;
}

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  (
    {
      className,
      children,
      mode: propMode,
      widthMode = 'hug-content',
      align = 'start',
      side = 'bottom',
      sideOffset = 8,
      maxHeight = 420,
      style,
      ...props
    },
    ref,
  ) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;
    const { open, setOpen, triggerRef, contentId } = usePopoverContext();

    const internalRef = React.useRef<HTMLDivElement>(null);
    const [position, setPosition] = React.useState<React.CSSProperties>({
      position: 'fixed',
      top: '-9999px',
      left: '-9999px',
      zIndex: 9999,
    });
    const [isVisible, setIsVisible] = React.useState(false);

    // Merge external ref and internal ref
    const setRefs = React.useCallback(
      (element: HTMLDivElement | null) => {
        (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = element;
        if (typeof ref === 'function') {
          ref(element);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = element;
        }
      },
      [ref],
    );

    // 2-pass positioning algorithm
    const calculatePosition = React.useCallback(() => {
      const triggerEl = triggerRef.current;
      const contentEl = internalRef.current;
      if (!triggerEl || !contentEl) return;

      const triggerRect = triggerEl.getBoundingClientRect();
      const contentRect = contentEl.getBoundingClientRect();
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const VIEWPORT_MARGIN = 8;

      // Width
      const contentWidth = widthMode === 'match-trigger'
        ? triggerRect.width
        : contentRect.width;

      // Y-axis: side preference + auto-flip
      const spaceBelow = viewportH - triggerRect.bottom - sideOffset;
      const spaceAbove = triggerRect.top - sideOffset;

      let actualSide = side;
      let actualMaxHeight = maxHeight;

      if (side === 'bottom') {
        if (spaceBelow < Math.min(contentRect.height, maxHeight) && spaceAbove > spaceBelow) {
          actualSide = 'top';
        }
      } else {
        if (spaceAbove < Math.min(contentRect.height, maxHeight) && spaceBelow > spaceAbove) {
          actualSide = 'bottom';
        }
      }

      // Clamp maxHeight to available space
      const availableSpace = actualSide === 'bottom' ? spaceBelow : spaceAbove;
      if (availableSpace < actualMaxHeight) {
        actualMaxHeight = Math.max(availableSpace - VIEWPORT_MARGIN, 100);
      }

      let top: number;
      if (actualSide === 'bottom') {
        top = triggerRect.bottom + sideOffset;
      } else {
        top = triggerRect.top - sideOffset - Math.min(contentRect.height, actualMaxHeight);
      }

      // X-axis: alignment + viewport clamping
      let left: number;
      if (align === 'start') {
        left = triggerRect.left;
      } else if (align === 'center') {
        left = triggerRect.left + (triggerRect.width - contentWidth) / 2;
      } else {
        left = triggerRect.right - contentWidth;
      }

      // Viewport X clamp
      if (left + contentWidth > viewportW - VIEWPORT_MARGIN) {
        left = viewportW - VIEWPORT_MARGIN - contentWidth;
      }
      if (left < VIEWPORT_MARGIN) {
        left = VIEWPORT_MARGIN;
      }

      setPosition({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 9999,
        ...(widthMode === 'match-trigger' ? { width: `${triggerRect.width}px` } : {}),
        maxHeight: `${actualMaxHeight}px`,
      });
    }, [triggerRef, widthMode, align, side, sideOffset, maxHeight]);

    // useLayoutEffect: 페인트 전에 위치를 계산하여 첫 열기 시 깜빡임 방지
    React.useLayoutEffect(() => {
      if (!open) {
        setIsVisible(false);
        return;
      }

      // 페인트 전에 동기적으로 위치 계산 (DOM은 이미 커밋됨)
      setIsVisible(false);
      calculatePosition();

      // 다음 프레임에서 페이드인 애니메이션 시작
      const frame = requestAnimationFrame(() => {
        setIsVisible(true);
      });

      return () => cancelAnimationFrame(frame);
    }, [open, calculatePosition]);

    // ESC to close
    useEscapeKey(open ? () => setOpen(false) : () => {});

    // Outside click to close (mousedown)
    React.useEffect(() => {
      if (!open) return;

      const handleMouseDown = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          triggerRef.current?.contains(target) ||
          internalRef.current?.contains(target)
        ) {
          return;
        }
        setOpen(false);
      };

      document.addEventListener('mousedown', handleMouseDown);
      return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [open, setOpen, triggerRef]);

    // Scroll/Resize: close popover (Select pattern)
    React.useEffect(() => {
      if (!open) return;

      const handleClose = () => setOpen(false);

      window.addEventListener('scroll', handleClose, true);
      window.addEventListener('resize', handleClose);

      return () => {
        window.removeEventListener('scroll', handleClose, true);
        window.removeEventListener('resize', handleClose);
      };
    }, [open, setOpen]);

    if (!open) return null;

    const contentStyle: React.CSSProperties = {
      ...position,
      opacity: isVisible ? 1 : 0,
      transition: 'opacity 150ms ease-in-out',
      pointerEvents: isVisible ? 'auto' : 'none',
      overflowY: 'auto',
      ...style,
    };

    return ReactDOM.createPortal(
      <div
        id={contentId}
        ref={setRefs}
        role="dialog"
        className={cn(popoverVariants({ mode, className }))}
        style={contentStyle}
        {...props}
      >
        {children}
      </div>,
      document.body,
    );
  },
);
PopoverContent.displayName = 'Popover.Content';

// ─── Compound Export ───

type PopoverComponent = typeof PopoverRoot & {
  Trigger: typeof PopoverTrigger;
  Content: typeof PopoverContent;
};

const Popover = PopoverRoot as PopoverComponent;
Popover.Trigger = PopoverTrigger;
Popover.Content = PopoverContent;

export { Popover, popoverVariants };
