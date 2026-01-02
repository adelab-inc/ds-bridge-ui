import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from './utils';

const fieldVariants = cva('flex flex-col w-[222px] gap-component-gap-contents-sm', ({
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
      "size": {
        "md": "",
        "sm": "",
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
    },
    defaultVariants: {
      "hasError": false,
      "isDisabled": false,
      "isReadOnly": false,
      "multiline": false,
      "rowsVariant": "flexible",
      "size": "md",
    },
  }));

const fieldLabelVariants = cva('', {
  variants: {
    size: {
      md: 'text-form-label-md-medium text-text-primary',
      sm: 'text-form-label-sm-medium text-text-primary',
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

const fieldInputVariants = cva(
  'py-component-inset-fields-y px-component-inset-fields-x rounded-lg border transition-colors focus:outline-none caret-field-caret placeholder:text-field-text-placeholder resize-none',
  {
    variants: {
      size: {
        md: 'text-body-md-regular gap-component-gap-form-fields-inter-x-md',
        sm: 'text-body-sm-regular gap-component-gap-form-fields-inter-x-sm',
      },
      hasError: {
        true: 'border-field-border-error',
        false: 'border-field-border-default',
      },
      isDisabled: {
        true: 'border-field-border-disabled bg-field-bg-disabled text-text-disabled cursor-not-allowed',
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
        true: 'border-field-border-focus shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]',
        false: '',
      },
    },
    compoundVariants: [
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
      hasError: false,
      isDisabled: false,
      isReadOnly: false,
      isEditing: false,
      isFocusVisible: false,
    },
  },
);

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
  extends Omit<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>, 'size'>,
    VariantProps<typeof fieldVariants> {
  label?: string;
  helperText?: string;
  error?: boolean;
  multiline?: boolean;
  rowsVariant?: 'flexible' | 'rows4' | 'rows6' | 'rows8';
  size?: 'md' | 'sm';
}

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
      label,
      helperText,
      error = false,
      multiline = false,
      rowsVariant = 'flexible',
      size = 'md',
      disabled = false,
      readOnly = false,
      id,
      ...props
    },
    ref,
  ) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [isFocusVisible, setIsFocusVisible] = React.useState(false);
    const hadMouseDownRef = React.useRef(false);

    const inputId = id || `field-${React.useId()}`;
    const helperTextId = helperText ? `${inputId}-helper` : undefined;

    const handleMouseDown = () => {
      hadMouseDownRef.current = true;
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // 마우스로 클릭한 직후의 포커스는 키보드 포커스가 아님
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
      props.onChange?.(e);
    };

    const inputClassName = cn(
      fieldInputVariants({
        size,
        hasError: error,
        isDisabled: disabled,
        isReadOnly: readOnly,
        isEditing,
        isFocusVisible,
      }),
    );

    const InputElement = multiline ? 'textarea' : 'input';

    const containerClassName = cn(
      fieldVariants({ size, multiline, rowsVariant, hasError: error, isDisabled: disabled, isReadOnly: readOnly }),
      className
    );

    return (
      <div className={containerClassName}>
        {label && (
          <label
            htmlFor={inputId}
            className={fieldLabelVariants({ size, isDisabled: disabled })}
          >
            {label}
          </label>
        )}

        <InputElement
          ref={ref as any}
          id={inputId}
          className={inputClassName}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={error}
          aria-describedby={helperTextId}
          onMouseDown={handleMouseDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          {...(multiline ? { rows: rowsMap[rowsVariant] } : {})}
          {...(props as any)}
        />

        {helperText && (
          <span
            id={helperTextId}
            className={fieldHelperTextVariants({ size, hasError: error, isDisabled: disabled })}
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
