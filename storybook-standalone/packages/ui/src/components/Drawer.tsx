import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { cn } from './utils';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useModalStack } from '../hooks/useModalStack';
import { useSpacingMode } from './SpacingModeProvider';

const drawerVariants = cva('flex h-screen flex-col items-center bg-bg-surface shadow-[0_8px_16px_0_rgba(0,0,0,0.24)]', ({
    variants: {
      "mode": {
        "base": "",
        "compact": "",
      },
      "size": {
        "lg": "w-[752px]",
        "md": "w-[552px]",
        "sm": "w-[352px]",
        "xl": "w-[1152px]",
      },
    },
    defaultVariants: {
      "mode": "base",
      "size": "md",
    },
    compoundVariants: [
      {
        "class": "py-component-inset-drawer-y px-component-inset-drawer-x gap-layout-stack-lg2",
        "mode": "base",
      },
      {
        "class": "py-component-inset-drawer-y px-component-inset-drawer-x gap-layout-stack-lg2",
        "mode": "compact",
      },
    ],
  }));

// Drawer Context for Compound components
interface DrawerContextValue {
  size?: 'sm' | 'md' | 'lg' | 'xl' | null;
  mode?: 'base' | 'compact' | null;
  onClose: () => void;
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

const useDrawerContext = () => {
  const context = React.useContext(DrawerContext);
  if (!context) {
    throw new Error('Drawer compound components must be used within Drawer');
  }
  return context;
};

export interface DrawerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof drawerVariants> {
  /** 드로워 열림 상태 */
  open?: boolean;
  children: React.ReactNode;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** Dim(배경 어둡게) 처리 여부 (기본: true) */
  dim?: boolean;
}

const DrawerRoot = React.forwardRef<HTMLDivElement, DrawerProps>(
  (
    {
      open = false,
      className,
      children,
      size,
      mode: propMode,
      onClose,
      dim = true,
      ...props
    },
    ref,
  ) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    // 내부 ref (Focus Trap용)
    const internalRef = React.useRef<HTMLDivElement | null>(null);

    // 외부 ref와 내부 ref 합성
    const setRefs = React.useCallback(
      (element: HTMLDivElement | null) => {
        internalRef.current = element;
        if (typeof ref === 'function') {
          ref(element);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = element;
        }
      },
      [ref]
    );

    // 모달 스택 관리: z-index 자동 계산 + 최상위 모달 판별
    const { backdropZIndex, dialogZIndex, isTopModal } = useModalStack({ enabled: open });

    // ESC 키로 닫기 (최상위 모달에만 반응)
    useEscapeKey(open && isTopModal ? onClose : () => {});

    // Focus Trap: dim 모드일 때 최상위 모달에만 적용
    useFocusTrap(internalRef, { enabled: open && dim && isTopModal });

    // Body 스크롤 막기 (dim=true이고 open일 때만)
    React.useEffect(() => {
      if (!open || !dim) return;

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }, [open, dim]);

    // open이 false면 렌더링하지 않음
    if (!open) return null;

    const containerStyle = { zIndex: dialogZIndex };
    const backdropStyle = { zIndex: backdropZIndex };

    const contextValue: DrawerContextValue = {
      size,
      mode,
      onClose,
    };

    return createPortal(
      <>
        {/* Backdrop (dim=true일 때만 표시) */}
        {dim && (
          <div
            className="fixed inset-0 bg-black/50"
            style={backdropStyle}
            onClick={isTopModal ? onClose : undefined}
            aria-hidden="true"
          />
        )}

        {/* Drawer Container - 오른쪽 끝에서 슬라이드 */}
        <div
          className="fixed top-0 right-0 h-full animate-slide-in-right"
          style={containerStyle}
        >
          <DrawerContext.Provider value={contextValue}>
            <div
              className={cn(drawerVariants({ size, mode, className }))}
              ref={setRefs}
              role="dialog"
              aria-modal={dim ? 'true' : undefined}
              aria-labelledby="drawer-title"
              {...props}
            >
              {children}
            </div>
          </DrawerContext.Provider>
        </div>
      </>,
      document.body
    );
  },
);
DrawerRoot.displayName = 'Drawer';

// ========================================
// Compound Components
// ========================================

/**
 * Drawer.Header - 드로워 헤더 영역
 *
 * @example
 * ```tsx
 * <Drawer.Header title="제목" />
 * ```
 */
export interface DrawerHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 드로워 제목 (필수) */
  title: string;
  /** 닫기 버튼 표시 여부 (기본: true) */
  showCloseButton?: boolean;
}

const DrawerHeader: React.FC<DrawerHeaderProps> = ({
  title,
  showCloseButton = true,
  className,
  ...props
}) => {
  const { onClose } = useDrawerContext();

  return (
    <div className={cn("flex items-start gap-component-gap-content-md self-stretch", className)} {...props}>
      <h2 id="drawer-title" className="flex-1 text-heading-lg-bold text-text-primary">
        {title}
      </h2>
      {showCloseButton && (
        <button
          onClick={onClose}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center"
          aria-label="닫기"
        >
          <Icon name="close" size={24} className="text-icon-interactive-default" />
        </button>
      )}
    </div>
  );
};
DrawerHeader.displayName = 'Drawer.Header';

/**
 * Drawer.Body - 드로워 본문 슬롯 영역
 *
 * @example
 * ```tsx
 * <Drawer.Body>
 *   <p>본문 내용</p>
 * </Drawer.Body>
 * ```
 */
export interface DrawerBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const DrawerBody: React.FC<DrawerBodyProps> = ({ children, className, ...props }) => {
  return (
    <div
      className={cn(
        "flex h-[85%] flex-col items-center gap-layout-stack-md2 self-stretch overflow-y-auto",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
DrawerBody.displayName = 'Drawer.Body';

/**
 * Drawer.Footer - 드로워 푸터 영역 (버튼 그룹 등)
 *
 * @example
 * ```tsx
 * <Drawer.Footer>
 *   <Button variant="outline">취소</Button>
 *   <Button variant="primary">확인</Button>
 * </Drawer.Footer>
 * ```
 */
export interface DrawerFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const DrawerFooter: React.FC<DrawerFooterProps> = ({ children, className, ...props }) => {
  return (
    <div
      className={cn("flex justify-end items-center gap-component-gap-control-group flex-1 self-stretch", className)}
      {...props}
    >
      {children}
    </div>
  );
};
DrawerFooter.displayName = 'Drawer.Footer';

// ========================================
// Export with Compound Components
// ========================================

type DrawerComponent = typeof DrawerRoot & {
  Header: typeof DrawerHeader;
  Body: typeof DrawerBody;
  Footer: typeof DrawerFooter;
};

const Drawer = DrawerRoot as DrawerComponent;
Drawer.Header = DrawerHeader;
Drawer.Body = DrawerBody;
Drawer.Footer = DrawerFooter;

export { Drawer, drawerVariants };
