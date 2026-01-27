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
      "isDisabled": {
        "false": "",
        "true": "",
      },
      "isReadOnly": {
        "false": "",
        "true": "",
      },
      "mode": {
        "base": "",
        "compact": "",
      },
      "multiline": {
        "false": "",
        "true": "",
      },
      "rowsVariant": {
        "flexible": "",
        "rows4": "",
        "rows6": "",
        "rows8": "",
      },
      "size": {
        "md": "",
        "sm": "",
      },
    },
    defaultVariants: {
      "hasError": false,
      "isDisabled": false,
      "isReadOnly": false,
      "mode": "base",
      "multiline": false,
      "rowsVariant": "flexible",
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
  'flex items-center rounded-lg border transition-colors',
  {
    variants: {
      size: {
        md: '',
        sm: '',
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
        size: 'md',
        class: 'py-component-inset-input-y px-component-inset-input-x gap-layout-stack-xs',
      },
      {
        mode: 'base',
        size: 'sm',
        class: 'py-component-inset-input-y px-component-inset-input-x gap-layout-stack-xs',
      },
      {
        mode: 'compact',
        size: 'md',
        class: 'py-component-inset-input-y-compact px-component-inset-input-x-compact gap-layout-stack-xs-compact',
      },
      {
        mode: 'compact',
        size: 'sm',
        class: 'py-component-inset-input-y-compact px-component-inset-input-x-compact gap-layout-stack-xs-compact',
      },
      {
        isDisabled: false,
        isReadOnly: false,
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
        true: 'text-text-disabled cursor-not-allowed',
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

const fieldIconVariants = cva('shrink-0 flex items-center justify-center', {
  variants: {
    size: {
      md: 'w-[14px] h-[14px]',
      sm: 'w-[12px] h-[12px]',
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

export interface FieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>, 'size' | 'prefix'>,
    VariantProps<typeof fieldVariants> {
  label?: string;
  required?: boolean;
  helperText?: string;
  error?: boolean;
  prefix?: React.ReactNode;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  onStartIconClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onEndIconClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  multiline?: boolean;
  rowsVariant?: 'flexible' | 'rows4' | 'rows6' | 'rows8';
  size?: 'md' | 'sm';
  /** 내부 input/textarea 요소에 전달할 추가 props */
  inputProps?: React.HTMLAttributes<HTMLInputElement | HTMLTextAreaElement>;
  /** 내부 label 요소에 전달할 추가 props */
  labelProps?: React.LabelHTMLAttributes<HTMLLabelElement>;
  /** 내부 helperText 요소에 전달할 추가 props */
  helperTextProps?: React.HTMLAttributes<HTMLSpanElement>;
  /** 내부 startIcon wrapper 요소에 전달할 추가 props */
  startIconProps?: React.HTMLAttributes<HTMLElement>;
  /** 내부 endIcon wrapper 요소에 전달할 추가 props */
  endIconProps?: React.HTMLAttributes<HTMLElement>;
}

const rowsMap = {
  flexible: 1,
  rows4: 4,
  rows6: 6,
  rows8: 8,
} as const;

const MAX_FLEXIBLE_ROWS = 4;

const Field = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, FieldProps>(
  (
    {
      className,
      label,
      required = false,
      helperText,
      error = false,
      prefix,
      startIcon,
      endIcon,
      onStartIconClick,
      onEndIconClick,
      multiline = false,
      rowsVariant = 'flexible',
      size = 'md',
      mode: propMode,
      disabled = false,
      readOnly = false,
      id,
      inputProps,
      labelProps,
      helperTextProps,
      startIconProps,
      endIconProps,
      ...props
    },
    ref,
  ) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    const [isEditing, setIsEditing] = React.useState(false);
    const [isFocusVisible, setIsFocusVisible] = React.useState(false);
    const hadMouseDownRef = React.useRef(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const inputId = id || `field-${React.useId()}`;
    const helperTextId = helperText ? `${inputId}-helper` : undefined;

    // Auto-grow for flexible multiline
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
      const maxHeight = lineHeight * MAX_FLEXIBLE_ROWS + paddingTop + paddingBottom;

      // Set height based on content, clamped between min and max
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
    }, [multiline, rowsVariant]);

    React.useLayoutEffect(() => {
      adjustTextareaHeight();
    }, [adjustTextareaHeight, props.value]);

    const handleMouseDown = () => {
      hadMouseDownRef.current = true;
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!hadMouseDownRef.current) {
        setIsFocusVisible(true);
      }
      hadMouseDownRef.current = false;
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setIsEditing(false);
      setIsFocusVisible(false);
      hadMouseDownRef.current = false;
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
      fieldVariants({ size, mode, multiline, rowsVariant, hasError: error, isDisabled: disabled, isReadOnly: readOnly }),
      'overflow-hidden',
      className
    );

    const inputWrapperClassName = cn(
      fieldInputWrapperVariants({
        size,
        mode,
        hasError: error,
        isDisabled: disabled,
        isReadOnly: readOnly,
        isEditing,
        isFocusVisible,
      }),
      multiline && 'items-start',
    );

    const inputAreaClassName = cn(
      fieldInputAreaVariants({ size }),
      multiline && 'items-start',
    );

    const inputClassName = fieldInputVariants({
      size,
      isDisabled: disabled,
    });

    return (
      <div className={containerClassName}>
        {label && (
          <label
            htmlFor={inputId}
            {...labelProps}
            className={cn(fieldLabelVariants({ size, isDisabled: disabled }), labelProps?.className)}
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
          onMouseDown={handleMouseDown}
        >
          {!multiline && prefix && (
            <span className={fieldPrefixVariants({ size, isDisabled: disabled })}>
              {prefix}
            </span>
          )}

          <div className={inputAreaClassName}>
            {!multiline && startIcon && (
              onStartIconClick ? (
                <button
                  type="button"
                  onClick={onStartIconClick}
                  disabled={disabled}
                  tabIndex={-1}
                  {...(startIconProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
                  className={cn(fieldIconVariants({ size, isDisabled: disabled }), startIconProps?.className)}
                >
                  {startIcon}
                </button>
              ) : (
                <span
                  {...startIconProps}
                  className={cn(fieldIconVariants({ size, isDisabled: disabled }), startIconProps?.className)}
                >
                  {startIcon}
                </span>
              )
            )}

            {multiline ? (
              <textarea
                ref={setTextareaRef}
                id={inputId}
                disabled={disabled}
                readOnly={readOnly}
                required={required}
                aria-invalid={error}
                aria-describedby={helperTextId}
                aria-required={required}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onChange={handleChange}
                rows={rowsVariant === 'flexible' ? 1 : rowsMap[rowsVariant]}
                {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
                {...(inputProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
                className={cn(inputClassName, inputProps?.className)}
              />
            ) : (
              <input
                ref={ref as React.Ref<HTMLInputElement>}
                id={inputId}
                disabled={disabled}
                readOnly={readOnly}
                required={required}
                aria-invalid={error}
                aria-describedby={helperTextId}
                aria-required={required}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onChange={handleChange}
                {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
                {...(inputProps as React.InputHTMLAttributes<HTMLInputElement>)}
                className={cn(inputClassName, inputProps?.className)}
              />
            )}

            {!multiline && endIcon && (
              onEndIconClick ? (
                <button
                  type="button"
                  onClick={onEndIconClick}
                  disabled={disabled}
                  tabIndex={-1}
                  {...(endIconProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
                  className={cn(fieldIconVariants({ size, isDisabled: disabled }), endIconProps?.className)}
                >
                  {endIcon}
                </button>
              ) : (
                <span
                  {...endIconProps}
                  className={cn(fieldIconVariants({ size, isDisabled: disabled }), endIconProps?.className)}
                >
                  {endIcon}
                </span>
              )
            )}
          </div>
        </div>

        {helperText && (
          <span
            id={helperTextId}
            {...helperTextProps}
            className={cn(fieldHelperTextVariants({ size, hasError: error, isDisabled: disabled }), helperTextProps?.className)}
          >
            {helperText}
          </span>
        )}
      </div>
    );
  },
);

Field.displayName = 'Field';

export { Field, fieldVariants };
