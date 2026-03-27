import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Icon } from './Icon';
import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';
import { designTokens } from '../tokens/design-tokens';

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
      "type": {
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
      "type": "default",
    },
    compoundVariants: [
      {
        "class": "py-component-inset-alert-toast-y px-component-inset-alert-toast-x gap-component-gap-icon-label-md",
        "isToast": true,
        "mode": "base",
      },
      {
        "class": "py-component-inset-alert-inline-y px-component-inset-alert-inline-x gap-component-gap-icon-label-md",
        "isToast": false,
        "mode": "base",
      },
      {
        "class": "py-component-inset-alert-toast-y-compact px-component-inset-alert-toast-x-compact gap-component-gap-icon-label-md-compact",
        "isToast": true,
        "mode": "compact",
      },
      {
        "class": "py-component-inset-alert-inline-y-compact px-component-inset-alert-inline-x-compact gap-component-gap-icon-label-md-compact",
        "isToast": false,
        "mode": "compact",
      },
      {
        "class": "bg-alert-info-bg text-alert-info-text",
        "type": "info",
      },
      {
        "class": "bg-alert-success-bg text-alert-success-text",
        "type": "success",
      },
      {
        "class": "bg-alert-warning-bg text-alert-warning-text",
        "type": "warning",
      },
      {
        "class": "bg-alert-error-bg text-alert-error-text",
        "type": "error",
      },
    ],
  }));

// --- Discriminated Union Types ---

type AlertIconProps =
  | { showIcon: true; icon?: React.ReactNode }
  | { showIcon?: false; icon?: never };

type AlertTitleProps =
  | { showTitle: true; title: string }
  | { showTitle?: false; title?: never };

type AlertAction1Props =
  | { showAction1: true; action1Label: string; action1OnClick: () => void }
  | { showAction1?: false; action1Label?: never; action1OnClick?: never };

type AlertAction2Props =
  | { showAction2: true; action2Label: string; action2OnClick: () => void }
  | { showAction2?: false; action2Label?: never; action2OnClick?: never };

type AlertActionGroupProps =
  | { showActionGroup?: false; showAction1?: never; action1Label?: never; action1OnClick?: never; showAction2?: never; action2Label?: never; action2OnClick?: never }
  | ({ showActionGroup: true } & AlertAction1Props & AlertAction2Props);

type AlertCloseProps =
  | { isToast: true; onClose: () => void; showClose?: boolean }
  | { isToast?: false; onClose?: () => void; showClose?: boolean };

export type AlertProps =
  Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> &
  Omit<VariantProps<typeof alertVariants>, 'isToast'> &
  AlertIconProps &
  AlertTitleProps &
  AlertActionGroupProps &
  AlertCloseProps & {
    body: React.ReactNode;
  };

const stateIconMap = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
} as const;

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      type = 'default',
      mode: propMode,
      isToast = false,
      body,
      showIcon,
      icon,
      showTitle,
      title,
      showClose,
      onClose,
      showActionGroup,
      showAction1,
      action1Label,
      action1OnClick,
      showAction2,
      action2Label,
      action2OnClick,
      ...props
    },
    ref,
  ) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    // showTitle이면 항상 Stacked, 아니면 본문 줄 수로 결정
    const isStacked = !!showTitle;

    // 본문 멀티라인 감지 (title 없을 때만 사용)
    const bodyRef = React.useRef<HTMLDivElement>(null);
    const [isMultiline, setIsMultiline] = React.useState(false);

    React.useLayoutEffect(() => {
      if (!isStacked && bodyRef.current) {
        const el = bodyRef.current;
        const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
        setIsMultiline(el.scrollHeight > lineHeight * 1.5);
      } else {
        setIsMultiline(false);
      }
    }, [body, isStacked, isToast]);

    // type에 따른 기본 아이콘 또는 커스텀 아이콘
    const displayIcon =
      icon ??
      (type && type !== 'default' && type in stateIconMap
        ? <Icon name={stateIconMap[type as keyof typeof stateIconMap]} size={20} />
        : null);

    // type별 아이콘 색상 적용
    const iconColorClass = {
      default: 'text-icon-interactive-default',
      info: 'text-icon-semantic-info',
      success: 'text-icon-semantic-success',
      warning: 'text-icon-semantic-warning',
      error: 'text-icon-semantic-error',
    }[type || 'default'] + ' [&_path]:!fill-current';

    // 닫기 버튼 표시 여부
    const shouldShowCloseButton = isToast ? true : (showClose ?? !!onClose);

    // 액션 버튼 렌더링
    const actionButtonClass = "text-body-sm-medium rounded py-[2px] px-[6px] -my-[2px] -mx-[6px] hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed";

    const renderCloseButton = () => {
      if (!shouldShowCloseButton || !onClose) return null;
      return (
        <button
          onClick={onClose}
          className="flex-shrink-0 p-2 -m-2 flex items-center justify-center rounded-full hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed"
          aria-label="알림 닫기"
        >
          <Icon name="close" size={16} className="text-icon-interactive-default" />
        </button>
      );
    };

    const renderBody = (bodyRefProp?: React.Ref<HTMLDivElement>) => {
      // Toast: 2줄 제한 (designTokens에서 line-height 참조, 말줄임표 없음)
      const toastStyle: React.CSSProperties | undefined = isToast ? {
        overflow: 'hidden',
        maxHeight: `calc(${(designTokens.fontSize['typography-body-sm-regular'][1] as { lineHeight: string }).lineHeight} * 2)`,
      } : undefined;

      return (
        <div
          ref={bodyRefProp}
          className="flex-1 min-w-0 text-body-sm-regular break-all"
          style={toastStyle}
        >
          {body}
        </div>
      );
    };

    // 내부 gap 클래스 (본문↔닫기, 행↔액션: content-lg for toast, content-md for inline)
    const innerGapClass = isToast ? 'gap-component-gap-content-lg' : 'gap-component-gap-content-md';

    // 액션 버튼 렌더
    const renderActionGroup = (inline?: boolean) => {
      if (!showActionGroup) return null;
      return (
        <div className={cn('flex items-center justify-end gap-component-gap-control-group', !inline && 'w-full', inline && 'flex-shrink-0')}>
          {showAction1 && (
            <button onClick={action1OnClick} className={actionButtonClass}>
              {action1Label}
            </button>
          )}
          {showAction2 && (
            <button onClick={action2OnClick} className={actionButtonClass}>
              {action2Label}
            </button>
          )}
        </div>
      );
    };

    // 제목 없음 + 본문 1줄: Single 레이아웃
    // 구조: [아이콘] [본문] [액션 버튼들] [닫기]  ← 모두 한 줄, 수직 가운데 정렬
    if (!isStacked && !isMultiline) {
      return (
        <div
          ref={ref}
          role="alert"
          className={cn(
            alertVariants({ type, mode, isToast }),
            'items-center',
            className,
          )}
          {...props}
        >
          {showIcon && displayIcon && (
            <span className={cn('flex-shrink-0', iconColorClass)}>{displayIcon}</span>
          )}
          <div className={cn('flex flex-1 min-w-0 items-center', innerGapClass)}>
            {renderBody(bodyRef)}
            {renderActionGroup(true)}
            {renderCloseButton()}
          </div>
        </div>
      );
    }

    // 제목 없음 + 본문 2줄 이상: Multiline 레이아웃
    // 구조: [아이콘] [본문+닫기] / [액션 버튼들]
    if (!isStacked && isMultiline) {
      return (
        <div
          ref={ref}
          role="alert"
          className={cn(
            alertVariants({ type, mode, isToast }),
            className,
          )}
          {...props}
        >
          {showIcon && displayIcon && (
            <span className={cn('flex-shrink-0', iconColorClass)}>{displayIcon}</span>
          )}
          <div className={cn('flex flex-1 min-w-0 flex-col', innerGapClass)}>
            <div className={cn('flex w-full items-start', innerGapClass)}>
              {renderBody(bodyRef)}
              {renderCloseButton()}
            </div>
            {renderActionGroup()}
          </div>
        </div>
      );
    }

    // 제목 있음: Stacked 레이아웃
    // 구조: [아이콘] [(제목+본문+닫기) + 액션 그룹]
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          alertVariants({ type, mode, isToast }),
          className,
        )}
        {...props}
      >
        {showIcon && displayIcon && (
          <span className={cn('flex-shrink-0', iconColorClass)}>{displayIcon}</span>
        )}
        <div className={cn('flex flex-1 min-w-0 flex-col', innerGapClass)}>
          <div className={cn('flex w-full items-start', innerGapClass)}>
            <div className="flex flex-1 min-w-0 flex-col gap-component-gap-content-xs">
              <h5 className="text-body-sm-medium">{title}</h5>
              {renderBody()}
            </div>
            {renderCloseButton()}
          </div>
          {renderActionGroup()}
        </div>
      </div>
    );
  },
);
Alert.displayName = 'Alert';

export { Alert, alertVariants };
