import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';
import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';

const alertVariants = cva('inline-flex items-start rounded-lg', ({
    variants: {
      "isToast": {
        "false": "w-full",
        "true": "w-[480px] shadow-[0_4px_8px_0_rgba(0,0,0,0.20)]",
      },
      "mode": {
        "base": "",
        "compact": "",
      },
      "variant": {
        "default": "bg-bg-container-low text-text-primary",
        "error": "",
        "info": "",
        "success": "",
        "warning": "",
      },
    },
    defaultVariants: {
      "isToast": false,
      "mode": "base",
      "variant": "default",
    },
    compoundVariants: [
      {
        "class": "py-[16px] px-[20px] gap-component-gap-icon-label-md",
        "isToast": true,
        "mode": "base",
      },
      {
        "class": "py-[12px] px-[16px] gap-component-gap-icon-label-md",
        "isToast": false,
        "mode": "base",
      },
      {
        "class": "py-[16px] px-[20px] gap-component-gap-icon-label-md-compact",
        "isToast": true,
        "mode": "compact",
      },
      {
        "class": "py-[12px] px-[16px] gap-component-gap-icon-label-md-compact",
        "isToast": false,
        "mode": "compact",
      },
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
}

/**
 * Alert actions 타입: 최대 2개의 액션만 허용
 * - 빈 배열, 1개, 또는 2개의 액션만 가능
 * - 3개 이상 전달 시 컴파일 에러 발생
 */
export type AlertActions =
  | []
  | [AlertAction]
  | [AlertAction, AlertAction];

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  actions?: AlertActions;
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
      mode: propMode,
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
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    const contentRef = React.useRef<HTMLDivElement>(null);
    const [isMultiline, setIsMultiline] = React.useState(false);
    const [isTruncated, setIsTruncated] = React.useState(false);

    // 본문이 1줄 초과인지 감지 + Toast 2줄 초과 시 truncation 감지
    React.useLayoutEffect(() => {
      if (contentRef.current) {
        const computedStyle = window.getComputedStyle(contentRef.current);
        const lineHeight = parseFloat(computedStyle.lineHeight);
        const height = contentRef.current.scrollHeight;
        const clientHeight = contentRef.current.clientHeight;
        setIsMultiline(height > lineHeight);
        // Toast에서 line-clamp-2 적용 시 실제 잘렸는지 감지
        if (isToast) {
          setIsTruncated(height > clientHeight);
        }
      }
    }, [children, isToast]);

    // State variant가 있으면 해당 아이콘 자동 표시
    const shouldShowIcon = !!icon || (variant !== 'default' && variant !== null);
    const displayIcon =
      variant && variant !== 'default' && variant in stateIconMap
        ? <Icon name={stateIconMap[variant as keyof typeof stateIconMap]} size={20} />
        : icon;

    // default variant일 때 아이콘 색상 적용 (path에 하드코딩된 fill 오버라이드 필요)
    const iconColorClass = variant === 'default' ? 'text-icon-interactive-default [&_path]:!fill-current' : '';

    // hasCloseButton이 명시적으로 설정된 경우 그 값 사용, 아니면 onClose 존재 여부로 판단
    const shouldShowCloseButton = hasCloseButton !== undefined ? hasCloseButton : !!onClose;

    // 제목이 있거나 본문이 멀티라인이면 2줄 레이아웃 사용
    const useMultilineLayout = !!title || isMultiline;

    // 1줄 레이아웃 (제목 없고, 본문 1줄)
    if (!useMultilineLayout) {
      return (
        <div
          ref={ref}
          role="alert"
          className={cn(
            alertVariants({
              variant,
              mode,
              isToast,
            }),
            'items-center gap-component-gap-icon-label-md',
            className,
          )}
          {...props}
        >
          {shouldShowIcon && displayIcon && (
            <span className={cn('flex-shrink-0', iconColorClass)}>{displayIcon}</span>
          )}
          <div className={cn('flex flex-1 items-center', isToast ? 'gap-component-gap-content-lg' : 'gap-component-gap-content-md')}>
            {(() => {
              const contentElement = (
                <div ref={contentRef} className={cn('flex-1 min-w-0 text-body-sm-regular', isToast && 'line-clamp-2')}>
                  {children}
                </div>
              );

              return isToast && isTruncated ? (
                <Tooltip content={children} truncation followCursor>
                  {contentElement}
                </Tooltip>
              ) : (
                contentElement
              );
            })()}
            {actions && actions.length > 0 && (
              <div className="flex-shrink-0 flex items-center gap-component-gap-control-group">
                {actions.slice(0, 2).map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className="text-body-sm-medium rounded py-[2px] px-[6px] -my-[2px] -mx-[6px] hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
            {shouldShowCloseButton && onClose && (
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 -m-2 flex items-center justify-center rounded-full hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed"
                aria-label="알림 닫기"
              >
                <Icon name="close" size={16} className="text-icon-interactive-default" />
              </button>
            )}
          </div>
        </div>
      );
    }

    // 2줄 레이아웃 (제목 있거나, 본문 멀티라인)
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          alertVariants({
            variant,
            mode,
            isToast,
          }),
          className,
        )}
        {...props}
      >
        <div className="flex w-full gap-component-gap-icon-label-md">
          {/* 왼쪽: 아이콘 */}
          {shouldShowIcon && displayIcon && (
            <span className={cn('flex-shrink-0', iconColorClass)}>{displayIcon}</span>
          )}

          {/* 중앙: 제목 + 본문 + 액션 버튼 */}
          <div className={cn('flex flex-1 flex-col', isToast ? 'gap-component-gap-content-lg' : 'gap-component-gap-content-md')}>
            {/* 제목 행 (제목이 있을 때만) */}
            {title && (
              <div className="flex w-full items-start justify-between">
                <h5 className="text-body-sm-medium">{title}</h5>
                {shouldShowCloseButton && onClose && (
                  <button
                    onClick={onClose}
                    className="flex-shrink-0 p-2 -m-2 flex items-center justify-center rounded-full hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed"
                    aria-label="알림 닫기"
                  >
                    <Icon name="close" size={16} className="text-icon-interactive-default" />
                  </button>
                )}
              </div>
            )}

            {/* 본문 (제목 없을 때는 close button과 함께) */}
            {!title ? (
              <div className={cn('flex w-full items-start justify-between', isToast ? 'gap-component-gap-content-lg' : 'gap-component-gap-content-md')}>
                {(() => {
                  const contentElement = (
                    <div ref={contentRef} className={cn('flex-1 text-body-sm-regular', isToast && 'line-clamp-2')}>
                      {children}
                    </div>
                  );

                  return isToast && isTruncated ? (
                    <Tooltip content={children} truncation followCursor>
                      {contentElement}
                    </Tooltip>
                  ) : (
                    contentElement
                  );
                })()}
                {shouldShowCloseButton && onClose && (
                  <button
                    onClick={onClose}
                    className="flex-shrink-0 p-2 -m-2 flex items-center justify-center rounded-full hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed"
                    aria-label="알림 닫기"
                  >
                    <Icon name="close" size={16} className="text-icon-interactive-default" />
                  </button>
                )}
              </div>
            ) : (
              (() => {
                const contentElement = (
                  <div ref={contentRef} className={cn('w-full text-body-sm-regular', isToast && 'line-clamp-2')}>
                    {children}
                  </div>
                );

                return isToast && isTruncated ? (
                  <Tooltip content={children} truncation followCursor>
                    {contentElement}
                  </Tooltip>
                ) : (
                  contentElement
                );
              })()
            )}

            {/* 푸터: 액션 버튼 (우측 정렬) */}
            {actions && actions.length > 0 && (
              <div className="flex w-full items-center justify-end gap-component-gap-control-group">
                {actions.slice(0, 2).map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className="text-body-sm-medium rounded py-[2px] px-[6px] -my-[2px] -mx-[6px] hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed"
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
