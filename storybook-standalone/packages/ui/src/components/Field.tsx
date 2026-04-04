import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';

const fieldVariants = cva('flex flex-col w-full', ({
    variants: {
      "hasError": {
        "false": "",
        "true": "",
      },
      "interaction": {
        "default": "",
        "disabled": "",
        "display": "",
        "editing": "",
        "readonly": "",
        "value": "",
      },
      "mode": {
        "base": "",
        "compact": "",
      },
      "size": {
        "md": "",
        "sm": "",
      },
    },
    defaultVariants: {
      "hasError": false,
      "interaction": "default",
      "mode": "base",
      "size": "md",
    },
    compoundVariants: [
      {
        "class": "gap-component-gap-content-sm",
        "mode": "base",
      },
      {
        "class": "gap-component-gap-content-sm-compact",
        "mode": "compact",
      },
    ],
  }));

const fieldLabelVariants = cva('flex items-center self-stretch min-w-0 overflow-hidden', {
  variants: {
    size: {
      md: 'text-form-label-md-medium text-text-primary gap-layout-inline-xs',
      sm: 'text-form-label-sm-medium text-text-primary gap-layout-inline-xs',
    },
    isDisabled: {
      true: 'text-text-disabled',
      false: '',
    },
  },
  defaultVariants: {
    size: 'md',
    isDisabled: false,
  },
});

const fieldInputWrapperVariants = cva(
  'flex items-center border transition-colors',
  {
    variants: {
      size: {
        md: 'rounded-lg gap-component-gap-icon-label-sm',
        sm: 'rounded-md gap-component-gap-icon-label-xs',
      },
      mode: {
        base: '',
        compact: '',
      },
      hasError: {
        true: 'border-field-border-error',
        false: 'border-field-border-default',
      },
      isDisabled: {
        true: 'border-field-border-disabled bg-field-bg-disabled cursor-not-allowed',
        false: '',
      },
      isReadOnly: {
        true: 'bg-field-bg-readonly',
        false: '',
      },
      isDisplay: {
        true: 'bg-field-bg-filled border-transparent cursor-default',
        false: '',
      },
      isEditing: {
        true: 'border-field-border-focus',
        false: '',
      },
      isFocusVisible: {
        true: 'border-field-border-focus outline outline-2 outline-focus outline-offset-[-2px]',
        false: '',
      },
    },
    compoundVariants: [
      {
        mode: 'base',
        class: 'px-component-inset-input-x',
      },
      {
        mode: 'compact',
        class: 'px-component-inset-input-x-compact',
      },
      {
        isDisabled: false,
        isReadOnly: false,
        isDisplay: false,
        class: 'bg-field-bg-surface',
      },
      {
        isDisabled: false,
        hasError: false,
        class: 'hover:border-field-border-focus',
      },
      {
        isReadOnly: true,
        hasError: false,
        class: 'border-field-border-default',
      },
    ],
    defaultVariants: {
      size: 'md',
      mode: 'base',
      hasError: false,
      isDisabled: false,
      isReadOnly: false,
      isDisplay: false,
      isEditing: false,
      isFocusVisible: false,
    },
  },
);

const fieldInputAreaVariants = cva('flex items-center flex-1 min-w-0', {
  variants: {
    size: {
      md: 'gap-component-gap-icon-label-sm',
      sm: 'gap-component-gap-icon-label-xs',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const fieldInputVariants = cva(
  'flex-1 min-w-0 bg-transparent outline-none caret-field-caret placeholder:text-field-text-placeholder resize-none',
  {
    variants: {
      size: {
        md: 'text-body-md-regular',
        sm: 'text-body-sm-regular',
      },
      isDisabled: {
        true: 'text-text-disabled placeholder:text-text-disabled cursor-not-allowed',
        false: 'text-text-primary',
      },
    },
    defaultVariants: {
      size: 'md',
      isDisabled: false,
    },
  },
);

const fieldPrefixVariants = cva('shrink-0', {
  variants: {
    size: {
      md: 'text-body-md-regular text-field-text-help',
      sm: 'text-body-sm-regular text-field-text-help',
    },
    isDisabled: {
      true: 'text-text-disabled',
      false: '',
    },
  },
  defaultVariants: {
    size: 'md',
    isDisabled: false,
  },
});

const fieldIconVariants = cva('shrink-0 flex items-center justify-center text-icon-interactive-default', {
  variants: {
    size: {
      md: 'w-[20px] h-[20px]',
      sm: 'w-[16px] h-[16px]',
    },
    isDisabled: {
      true: 'text-icon-interactive-disabled',
      false: '',
    },
  },
  defaultVariants: {
    size: 'md',
    isDisabled: false,
  },
});

const fieldHelperTextVariants = cva('', {
  variants: {
    size: {
      md: 'text-form-helper-text-md-regular text-field-text-help',
      sm: 'text-form-helper-text-sm-regular text-field-text-help',
    },
    hasError: {
      true: 'text-semantic-error',
      false: '',
    },
    isDisabled: {
      true: 'text-text-disabled',
      false: '',
    },
  },
  defaultVariants: {
    size: 'md',
    hasError: false,
    isDisabled: false,
  },
});

// ─── show* Discriminated Union 타입 ───

type LabelProps =
  | { showLabel: true; label: string; labelProps?: React.LabelHTMLAttributes<HTMLLabelElement> }
  | { showLabel: false; label?: never; labelProps?: never };

type HelptextProps =
  | { showHelptext: true; helptext: string; helperTextProps?: React.HTMLAttributes<HTMLSpanElement> }
  | { showHelptext: false; helptext?: never; helperTextProps?: never };

type PrefixProps =
  | { showPrefix: true; prefix: React.ReactNode }
  | { showPrefix: false; prefix?: never };

type StartIconProps =
  | { showStartIcon: true; startIcon: React.ReactNode; onStartIconClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; startIconProps?: React.HTMLAttributes<HTMLElement> }
  | { showStartIcon: false; startIcon?: never; onStartIconClick?: never; startIconProps?: never };

type EndIconProps =
  | { showEndIcon: true; endIcon: React.ReactNode; onEndIconClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; endIconProps?: React.HTMLAttributes<HTMLElement> }
  | { showEndIcon: false; endIcon?: never; onEndIconClick?: never; endIconProps?: never };

// ─── 기반 Props ───

interface FieldBaseProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>, 'size' | 'prefix' | 'disabled' | 'readOnly'>,
    VariantProps<typeof fieldVariants> {
  required?: boolean;
  hasError?: boolean;
  size?: 'md' | 'sm';
  /** 내부 input/textarea 요소에 전달할 추가 props */
  inputProps?: React.HTMLAttributes<HTMLInputElement | HTMLTextAreaElement>;
}

// ─── Single-line vs Multiline Discriminated Union ───

/** Single-line: prefix, startIcon, endIcon 사용 가능 */
interface SingleLineFieldProps extends FieldBaseProps {
  multiline?: false;
  rowsVariant?: never;
}

/** Multiline: prefix, startIcon, endIcon 사용 불가 */
interface MultilineFieldProps extends FieldBaseProps {
  multiline: true;
  rowsVariant?: 'flexible' | 'rows4' | 'rows6' | 'rows8';
}

// ─── 최종 FieldProps ───

/** Single-line: 모든 show* discriminated union 적용 */
type SingleLineProps = SingleLineFieldProps
  & LabelProps
  & HelptextProps
  & PrefixProps
  & StartIconProps
  & EndIconProps;

/** Multiline: label, helptext만 허용. prefix, icon 계열 차단 */
type MultilineProps = MultilineFieldProps
  & LabelProps
  & HelptextProps
  & {
    showPrefix?: never; prefix?: never;
    showStartIcon?: never; startIcon?: never; onStartIconClick?: never; startIconProps?: never;
    showEndIcon?: never; endIcon?: never; onEndIconClick?: never; endIconProps?: never;
  };

export type FieldProps = SingleLineProps | MultilineProps;

const rowsMap = {
  flexible: 1,
  rows4: 4,
  rows6: 6,
  rows8: 8,
} as const;

const Field = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, FieldProps>(
  (
    {
      className,
      interaction,
      hasError = false,
      required = false,
      showLabel,
      label,
      labelProps,
      showHelptext,
      helptext,
      helperTextProps,
      showPrefix,
      prefix,
      showStartIcon,
      startIcon,
      onStartIconClick,
      startIconProps,
      showEndIcon,
      endIcon,
      onEndIconClick,
      endIconProps,
      multiline = false,
      rowsVariant = 'flexible',
      size = 'md',
      mode: propMode,
      id,
      inputProps,
      name,
      ...props
    },
    ref,
  ) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    // interaction에서 파생
    const interactionValue = interaction as string | undefined;
    const isDisabled = interactionValue === 'disabled';
    const isReadOnly = interactionValue === 'readonly';
    const isDisplay = interactionValue === 'display';

    // display 모드: 탭 포커스 제외 + 폼 제출 제외
    const displayTabIndex = isDisplay ? -1 : undefined;
    const displayName = isDisplay ? undefined : name;

    const [isEditing, setIsEditing] = React.useState(false);
    const [isFocusVisible, setIsFocusVisible] = React.useState(false);
    const hadMouseDownRef = React.useRef(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const inputId = id || `field-${React.useId()}`;
    const helperTextId = (showHelptext && helptext) ? `${inputId}-helper` : undefined;

    // Auto-grow for flexible multiline (no max height limit)
    const adjustTextareaHeight = React.useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea || !multiline) return;

      // For non-flexible variants, remove any inline height style
      if (rowsVariant !== 'flexible') {
        textarea.style.height = '';
        return;
      }

      // Reset height to calculate scrollHeight correctly
      textarea.style.height = 'auto';

      // Get line height from computed style
      const computedStyle = window.getComputedStyle(textarea);
      const lineHeight = parseFloat(computedStyle.lineHeight) || 20;
      const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
      const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;

      const minHeight = lineHeight + paddingTop + paddingBottom;

      // Set height based on content (no max limit - grows indefinitely)
      const newHeight = Math.max(textarea.scrollHeight, minHeight);
      textarea.style.height = `${newHeight}px`;
    }, [multiline, rowsVariant]);

    React.useLayoutEffect(() => {
      adjustTextareaHeight();
    }, [adjustTextareaHeight, props.value]);

    const handleMouseDown = () => {
      hadMouseDownRef.current = true;
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setIsEditing(true);
      if (!hadMouseDownRef.current) {
        setIsFocusVisible(true);
      }
      hadMouseDownRef.current = false;
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setIsEditing(false);
      setIsFocusVisible(false);
      // blur 완료 후 비동기로 리셋하여 blur→재focus 시 mousedown 이벤트가 먼저 처리되도록 함
      requestAnimationFrame(() => { hadMouseDownRef.current = false; });
      props.onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setIsEditing(true);
      adjustTextareaHeight();
      props.onChange?.(e);
    };

    // Combine refs for textarea (internal + forwarded)
    const setTextareaRef = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
        }
      },
      [ref],
    );

    const containerClassName = cn(
      fieldVariants({ size, mode, hasError, interaction }),
      'overflow-hidden',
      className
    );

    const inputWrapperClassName = cn(
      fieldInputWrapperVariants({
        size,
        mode,
        hasError,
        isDisabled,
        isReadOnly,
        isDisplay,
        isEditing,
        isFocusVisible,
      }),
      multiline
        ? `items-start ${mode === 'compact' ? 'py-component-inset-input-multiline-y-compact' : 'py-component-inset-input-multiline-y'}`
        : mode === 'compact' ? 'py-component-inset-input-y-compact' : 'py-component-inset-input-y',
    );

    const inputAreaClassName = cn(
      fieldInputAreaVariants({ size }),
      multiline && 'items-start',
    );

    const inputClassName = fieldInputVariants({
      size,
      isDisabled,
    });

    return (
      <div className={containerClassName} onMouseDown={handleMouseDown}>
        {showLabel && (
          <label
            htmlFor={inputId}
            {...labelProps}
            className={cn(fieldLabelVariants({ size, isDisabled }), labelProps?.className)}
          >
            <span className="truncate">{label}</span>
            {required && (
              <span
                className={cn(
                  'text-text-accent',
                  size === 'md' ? 'text-form-label-md-medium' : 'text-form-label-sm-medium'
                )}
                aria-hidden="true"
              >
                *
              </span>
            )}
          </label>
        )}

        <div
          className={inputWrapperClassName}
        >
          {!multiline && showPrefix && (
            <span className={fieldPrefixVariants({ size, isDisabled })}>
              {prefix}
            </span>
          )}

          <div className={inputAreaClassName}>
            {!multiline && showStartIcon && (
              onStartIconClick ? (
                <button
                  type="button"
                  onClick={onStartIconClick}
                  disabled={isDisabled}
                  tabIndex={-1}
                  {...(startIconProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
                  className={cn(fieldIconVariants({ size, isDisabled }), startIconProps?.className)}
                >
                  {startIcon}
                </button>
              ) : (
                <span
                  {...startIconProps}
                  className={cn(fieldIconVariants({ size, isDisabled }), startIconProps?.className)}
                >
                  {startIcon}
                </span>
              )
            )}

            {multiline ? (
              <textarea
                ref={setTextareaRef}
                id={inputId}
                disabled={isDisabled}
                readOnly={isReadOnly || isDisplay}
                required={required}
                aria-invalid={hasError}
                aria-describedby={helperTextId}
                aria-required={required}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onChange={handleChange}
                rows={rowsVariant === 'flexible' ? 1 : rowsMap[rowsVariant]}
                {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
                {...(inputProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
                name={displayName}
                tabIndex={displayTabIndex}
                className={cn(inputClassName, inputProps?.className)}
              />
            ) : (
              <input
                ref={ref as React.Ref<HTMLInputElement>}
                id={inputId}
                disabled={isDisabled}
                readOnly={isReadOnly || isDisplay}
                required={required}
                aria-invalid={hasError}
                aria-describedby={helperTextId}
                aria-required={required}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onChange={handleChange}
                {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
                {...(inputProps as React.InputHTMLAttributes<HTMLInputElement>)}
                name={displayName}
                tabIndex={displayTabIndex}
                className={cn(inputClassName, inputProps?.className)}
              />
            )}

            {!multiline && showEndIcon && (
              onEndIconClick ? (
                <button
                  type="button"
                  onClick={onEndIconClick}
                  disabled={isDisabled}
                  tabIndex={-1}
                  {...(endIconProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
                  className={cn(fieldIconVariants({ size, isDisabled }), endIconProps?.className)}
                >
                  {endIcon}
                </button>
              ) : (
                <span
                  {...endIconProps}
                  className={cn(fieldIconVariants({ size, isDisabled }), endIconProps?.className)}
                >
                  {endIcon}
                </span>
              )
            )}
          </div>
        </div>

        {showHelptext && (
          <span
            id={helperTextId}
            {...helperTextProps}
            className={cn(fieldHelperTextVariants({ size, hasError, isDisabled }), helperTextProps?.className)}
          >
            {helptext}
          </span>
        )}
      </div>
    );
  },
);

Field.displayName = 'Field';

export { Field, fieldVariants };
