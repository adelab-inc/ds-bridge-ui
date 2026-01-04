import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Icon } from './Icon';
import { cn } from './utils';
import { useEscapeKey } from '../hooks/useEscapeKey';

const dialogVariants = cva('flex flex-col items-start py-component-inset-dialog-y px-component-inset-dialog-x gap-component-gap-dialog-contents-y rounded-xl border border-border-subtle bg-bg-surface shadow-[0_4px_8px_0_rgba(0,0,0,0.20)]', ({
    variants: {
      "size": {
        "lg": "w-[928px] max-h-[80vh]",
        "md": "w-[612px] max-h-[80vh]",
        "sm": "w-[480px] max-h-[80vh]",
        "xl": "w-[1244px] max-h-[80vh]",
      },
    },
    defaultVariants: {
      "size": "md",
    },
  }));

export interface DialogProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof dialogVariants> {
  open?: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  x?: string;
  y?: string;
  onClose: () => void;
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
  footerContent?: React.ReactNode;
}

const Dialog = React.forwardRef<HTMLDivElement, DialogProps>(
  (
    {
      open = true,
      className,
      title,
      subtitle,
      children,
      x = '50%',
      y = '50%',
      size,
      onClose,
      onPrimaryClick,
      onSecondaryClick,
      primaryLabel = '확인',
      secondaryLabel = '취소',
      footerContent,
      ...props
    },
    ref,
  ) => {
    // ESC 키로 닫기 (open일 때만)
    useEscapeKey(open ? onClose : () => {});

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

    // Button은 sm/md/lg만 지원하므로 xl을 lg로 매핑
    const buttonSize = size === 'xl' ? 'lg' : size;

    // Title 텍스트 토큰: lg/xl은 heading-lg-bold, sm/md는 heading-md-semibold
    const titleClassName = size === 'lg' || size === 'xl'
      ? 'text-heading-lg-bold text-text-primary'
      : 'text-heading-md-semibold text-text-primary';

    return createPortal(
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Dialog Container */}
        <div
          className="fixed z-50"
          style={dialogPosition}
        >
          <div
            className={cn(dialogVariants({ size, className }))}
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            {...props}
          >
            {/* Header */}
            <div className="flex items-start justify-between w-full">
              <div className="flex flex-col">
                <h2
                  id="dialog-title"
                  className={titleClassName}
                >
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-body-md-regular text-text-primary">
                    {subtitle}
                  </p>
                )}
              </div>
              <IconButton
                variant="ghost"
                size="md"
                onClick={onClose}
                aria-label="닫기"
                icon={<Icon name="close" size={20} />}
              />
            </div>

            {/* Body */}
            <div className="flex-1 w-full overflow-y-auto">
              {children}
            </div>

            {/* Footer */}
            {(onPrimaryClick || onSecondaryClick || footerContent) && (
              <div
                className={cn(
                  "flex gap-component-gap-actions-x w-full",
                  footerContent && (onPrimaryClick || onSecondaryClick)
                    ? "justify-between"
                    : footerContent
                      ? "justify-start"
                      : "justify-end"
                )}
              >
                {footerContent && (
                  <div className="flex gap-component-gap-actions-x items-center">
                    {footerContent}
                  </div>
                )}
                {(onPrimaryClick || onSecondaryClick) && (
                  <div className="flex gap-component-gap-actions-x">
                    {onSecondaryClick && (
                      <Button
                        variant="outline"
                        size={buttonSize}
                        onClick={onSecondaryClick}
                      >
                        {secondaryLabel}
                      </Button>
                    )}
                    {onPrimaryClick && (
                      <Button
                        variant="primary"
                        size={buttonSize}
                        onClick={onPrimaryClick}
                      >
                        {primaryLabel}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </>,
      document.body
    );
  },
);
Dialog.displayName = 'Dialog';

export { Dialog, dialogVariants };
