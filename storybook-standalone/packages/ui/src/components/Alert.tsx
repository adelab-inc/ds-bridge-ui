import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Icon } from './Icon';
import { cn } from './utils';

const alertVariants = cva('inline-flex items-center min-w-[483px] py-component-inset-alert-inline-y px-component-inset-alert-inline-x gap-component-gap-alert-inline-label-close-x rounded-lg', ({
    variants: {
      "variant": {
        "default": "bg-[var(--color-role-bg-container-low,rgba(0,0,0,0.04))] text-text-primary",
        "error": "",
        "info": "",
        "success": "",
        "warning": "",
      },
      "isToast": {
        "false": "",
        "true": "w-[360px] shadow-[0_4px_8px_0_rgba(0,0,0,0.20)]",
      },
    },
    defaultVariants: {
      "isToast": false,
      "variant": "default",
    },
    compoundVariants: [
      {
        "class": "bg-alert-info-bg text-alert-info-text",
        "variant": "info",
      },
      {
        "class": "bg-alert-success-bg text-alert-success-text",
        "variant": "success",
      },
      {
        "class": "bg-alert-warning-bg text-alert-warning-text",
        "variant": "warning",
      },
      {
        "class": "bg-alert-error-bg text-alert-error-text",
        "variant": "error",
      },
    ],
  }));

export interface AlertAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  actions?: AlertAction[];
  onClose?: () => void;
  hasCloseButton?: boolean;
}

const stateIconMap = {
  info: 'alert-info',
  success: 'alert-success',
  warning: 'alert-warning',
  error: 'alert-error',
} as const;

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      variant = 'default',
      isToast = false,
      title,
      children,
      icon,
      actions,
      onClose,
      hasCloseButton,
      ...props
    },
    ref,
  ) => {
    // State variant가 있으면 해당 아이콘 자동 표시
    const shouldShowIcon = !!icon || (variant !== 'default' && variant !== null);
    const displayIcon =
      variant && variant !== 'default' && variant in stateIconMap
        ? <Icon name={stateIconMap[variant as keyof typeof stateIconMap]} size={20} />
        : icon;

    // 제목 유무 자동 감지 (title prop으로만 판단)
    const hasTitleContent = !!title;
    // hasCloseButton이 명시적으로 설정된 경우 그 값 사용, 아니면 onClose 존재 여부로 판단
    const shouldShowCloseButton = hasCloseButton !== undefined ? hasCloseButton : !!onClose;

    // 1줄 레이아웃 (제목 없음)
    if (!hasTitleContent) {
      return (
        <div
          ref={ref}
          role="alert"
          className={cn(
            alertVariants({
              variant,
              isToast,
            }),
            className,
          )}
          {...props}
        >
          {shouldShowIcon && displayIcon && (
            <span className="flex-shrink-0">{displayIcon}</span>
          )}
          <div className="flex flex-1 items-center gap-component-gap-alert-inline-label-close-x">
            <div className="flex-1 text-body-sm-regular">{children}</div>
            {actions && actions.length > 0 && (
              <div className="flex items-center gap-[8px]">
                {actions.slice(0, 2).map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className="text-body-sm-medium hover:opacity-70"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {shouldShowCloseButton && onClose && (
            <button
              onClick={onClose}
              className="flex-shrink-0 w-[16px] h-[16px] flex items-center justify-center hover:opacity-70"
              aria-label="Close alert"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      );
    }

    // 2줄 레이아웃 (제목 있음)
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          alertVariants({
            variant,
            isToast,
          }),
          className,
        )}
        {...props}
      >
        <div className="flex w-full gap-component-gap-alert-inline-label-close-x">
          {/* 왼쪽: 아이콘 */}
          {shouldShowIcon && displayIcon && (
            <span className="flex-shrink-0">{displayIcon}</span>
          )}

          {/* 중앙: 제목 + 본문 + 액션 버튼 */}
          <div className="flex flex-1 flex-col gap-1">
            {/* 제목 행 */}
            <div className="flex w-full items-start justify-between gap-component-gap-alert-inline-label-close-x">
              {title && <h5 className="text-body-sm-medium">{title}</h5>}
              {shouldShowCloseButton && onClose && (
                <button
                  onClick={onClose}
                  className="flex-shrink-0 w-[16px] h-[16px] flex items-center justify-center hover:opacity-70"
                  aria-label="Close alert"
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>

            {/* 본문 */}
            <div className="w-full text-body-sm-regular">{children}</div>

            {/* 푸터: 액션 버튼 (우측 정렬) */}
            {actions && actions.length > 0 && (
              <div className="flex w-full items-center justify-end gap-[8px]">
                {actions.slice(0, 2).map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className="text-body-sm-medium hover:opacity-70"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);
Alert.displayName = 'Alert';

export { Alert, alertVariants };
