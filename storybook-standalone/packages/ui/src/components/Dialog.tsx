import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { cn } from './utils';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useModalStack } from '../hooks/useModalStack';
import { useSpacingMode } from './SpacingModeProvider';

const dialogVariants = cva('flex flex-col items-start rounded-xl border border-border-subtle bg-bg-surface shadow-[0_4px_8px_0_rgba(0,0,0,0.20)]', ({
    variants: {
      "mode": {
        "base": "",
        "compact": "",
      },
      "size": {
        "lg": "w-[928px] max-h-[80vh]",
        "md": "w-[612px] max-h-[760px]",
        "sm": "w-[480px] max-h-[600px]",
        "xl": "w-[1244px] max-h-[80vh]",
      },
    },
    defaultVariants: {
      "mode": "base",
      "size": "md",
    },
    compoundVariants: [
      {
        "class": "py-component-inset-dialog-y gap-component-gap-dialog-structure",
        "mode": "base",
      },
      {
        "class": "py-component-inset-dialog-y-compact gap-component-gap-dialog-structure-compact",
        "mode": "compact",
      },
    ],
  }));

// Dialog Context for Compound components
interface DialogContextValue {
  size?: 'sm' | 'md' | 'lg' | 'xl' | null;
  mode?: 'base' | 'compact' | null;
  onClose: () => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

const useDialogContext = () => {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error('Dialog compound components must be used within Dialog');
  }
  return context;
};

export interface DialogProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof dialogVariants> {
  open?: boolean;
  children: React.ReactNode;
  x?: string;
  y?: string;
  onClose: () => void;
}

const DialogRoot = React.forwardRef<HTMLDivElement, DialogProps>(
  (
    {
      open = true,
      className,
      children,
      x = '50%',
      y = '50%',
      size,
      mode: propMode,
      onClose,
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

    // Focus Trap: 최상위 모달에만 적용
    useFocusTrap(internalRef, { enabled: open && isTopModal });

    // Body 스크롤 막기 (open일 때만)
    React.useEffect(() => {
      if (!open) return;

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }, [open]);

    // open이 false면 렌더링하지 않음
    if (!open) return null;

    const dialogPosition = {
      left: x,
      top: y,
      transform: 'translate(-50%, -50%)',
    };

    const backdropStyle = { zIndex: backdropZIndex };
    const containerStyle = { ...dialogPosition, zIndex: dialogZIndex };

    const contextValue: DialogContextValue = {
      size,
      mode,
      onClose,
    };

    return createPortal(
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50"
          style={backdropStyle}
          onClick={isTopModal ? onClose : undefined}
          aria-hidden="true"
        />

        {/* Dialog Container */}
        <div className="fixed" style={containerStyle}>
          <DialogContext.Provider value={contextValue}>
            <div
              className={cn(dialogVariants({ size, mode, className }))}
              ref={setRefs}
              role="dialog"
              aria-modal="true"
              aria-labelledby="dialog-title"
              {...props}
            >
              {children}
            </div>
          </DialogContext.Provider>
        </div>
      </>,
      document.body
    );
  },
);
DialogRoot.displayName = 'Dialog';

// ========================================
// Compound Components
// ========================================

/**
 * Dialog.Header - 다이얼로그 헤더 영역
 *
 * @example
 * ```tsx
 * <Dialog.Header
 *   title="제목"
 *   subtitle="부제목 (선택)"
 *   icon={<Icon name="info" />}
 *   showCloseButton={true}
 * />
 * ```
 */
export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 다이얼로그 제목 (필수) */
  title: string;
  /** 다이얼로그 부제목 (선택) */
  subtitle?: string;
  /** 제목 앞에 표시할 아이콘 (선택) */
  icon?: React.ReactNode;
  /** 닫기 버튼 표시 여부 (기본: true) */
  showCloseButton?: boolean;
}

const DialogHeader: React.FC<DialogHeaderProps> = ({
  title,
  subtitle,
  icon,
  showCloseButton = true,
  className,
  ...props
}) => {
  const { size, mode, onClose } = useDialogContext();
  const pxClass = mode === 'compact' ? 'px-component-inset-dialog-x-compact' : 'px-component-inset-dialog-x';

  // Title 텍스트 토큰: lg/xl은 heading-lg-bold, sm/md는 heading-md-semibold
  const titleClassName = size === 'lg' || size === 'xl'
    ? 'text-heading-lg-bold text-text-primary'
    : 'text-heading-md-semibold text-text-primary';

  // Close icon size: sm=16, md=20, lg/xl=24
  const closeIconSize = size === 'sm' ? 16 : size === 'md' ? 20 : 24;

  return (
    <div className={cn("flex items-start gap-component-gap-content-md w-full", pxClass, className)} {...props}>
      {icon && <div className="flex-shrink-0">{icon}</div>}
      <div className="flex flex-col flex-1 min-w-0 gap-layout-stack-xs">
        <h2 id="dialog-title" className={titleClassName}>
          {title}
        </h2>
        {subtitle && (
          <p id="dialog-subtitle" className="text-body-md-regular text-text-primary">
            {subtitle}
          </p>
        )}
      </div>
      {showCloseButton && (
        <button
          onClick={onClose}
          className="flex-shrink-0 p-2.5 -m-2.5 flex items-center justify-center rounded-full hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed"
          aria-label="닫기"
        >
          <Icon name="close" size={closeIconSize} className="text-icon-interactive-default" />
        </button>
      )}
    </div>
  );
};
DialogHeader.displayName = 'Dialog.Header';

/**
 * Dialog.Body - 다이얼로그 본문 영역
 *
 * @example
 * ```tsx
 * <Dialog.Body>
 *   <p>본문 내용</p>
 * </Dialog.Body>
 * ```
 */
export interface DialogBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const DialogBody: React.FC<DialogBodyProps> = ({ children, className, ...props }) => {
  const { mode } = useDialogContext();
  const pxClass = mode === 'compact' ? 'px-component-inset-dialog-x-compact' : 'px-component-inset-dialog-x';

  return (
    <div className={cn("flex-1 w-full overflow-y-auto [scrollbar-gutter:stable] text-body-md-medium text-text-primary", pxClass, className)} {...props}>
      {children}
    </div>
  );
};
DialogBody.displayName = 'Dialog.Body';

/**
 * Dialog.Footer - 다이얼로그 푸터 영역 (버튼 그룹 등)
 *
 * 기본적으로 `justify-end`로 오른쪽 정렬됩니다.
 * 좌우 분리 배치가 필요하면 `className="justify-between"`으로 오버라이드하세요.
 *
 * @example
 * ```tsx
 * // 기본: 오른쪽 정렬
 * <Dialog.Footer>
 *   <Button variant="outline">취소</Button>
 *   <Button variant="primary">확인</Button>
 * </Dialog.Footer>
 *
 * // 좌우 분리 배치
 * <Dialog.Footer className="justify-between">
 *   <Option label="다시 보지 않기"><Checkbox /></Option>
 *   <div className="flex gap-component-gap-control-group">
 *     <Button variant="outline">취소</Button>
 *     <Button variant="primary">확인</Button>
 *   </div>
 * </Dialog.Footer>
 * ```
 */
export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const DialogFooter: React.FC<DialogFooterProps> = ({ children, className, ...props }) => {
  const { mode } = useDialogContext();
  const pxClass = mode === 'compact' ? 'px-component-inset-dialog-x-compact' : 'px-component-inset-dialog-x';

  return (
    <div className={cn("flex items-center justify-end gap-component-gap-control-group w-full text-text-primary", pxClass, className)} {...props}>
      {children}
    </div>
  );
};
DialogFooter.displayName = 'Dialog.Footer';

// ========================================
// Export with Compound Components
// ========================================

type DialogComponent = typeof DialogRoot & {
  Header: typeof DialogHeader;
  Body: typeof DialogBody;
  Footer: typeof DialogFooter;
};

const Dialog = DialogRoot as DialogComponent;
Dialog.Header = DialogHeader;
Dialog.Body = DialogBody;
Dialog.Footer = DialogFooter;

export { Dialog, dialogVariants };
