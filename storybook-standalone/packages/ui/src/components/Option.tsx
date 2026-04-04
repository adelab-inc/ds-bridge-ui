import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';
import { useOptionGroupContext } from './OptionGroup';

const optionVariants = cva(
  'inline-flex items-start',
  ({
    variants: {
      "disabled": {
        "false": "cursor-pointer",
        "true": "cursor-not-allowed",
      },
      "mode": {
        "base": "",
        "compact": "",
      },
      "size": {
        "lg": "",
        "md": "",
        "sm": "",
      },
    },
    defaultVariants: {
      "disabled": false,
      "mode": "base",
      "size": "md",
    },
    compoundVariants: [
      {
        "class": "gap-layout-inline-md",
        "mode": "base",
      },
      {
        "class": "gap-layout-inline-md-compact",
        "mode": "compact",
      },
    ],
  })
);

const labelVariants = cva(
  'break-all',
  {
    variants: {
      size: {
        sm: 'text-body-sm-regular',
        md: 'text-body-md-regular',
        lg: 'text-body-lg-regular',
      },
      disabled: {
        true: 'text-text-disabled',
        false: 'text-text-primary',
      },
    },
    defaultVariants: {
      size: 'md',
      disabled: false,
    },
  }
);

const sizeToInputSize = { sm: '20', md: '24', lg: '28' } as const;

export interface OptionProps
  extends Omit<React.LabelHTMLAttributes<HTMLLabelElement>, 'children'>,
    VariantProps<typeof optionVariants> {
  children: React.ReactNode;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const Option = React.forwardRef<HTMLLabelElement, OptionProps>(
  ({ className, children, label, size: propSize, disabled = false, mode: propMode, ...props }, ref) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    // Size 우선순위: 1. prop (명시적) → 2. Context (OptionGroup) → 3. 기본값
    const optionGroupContext = useOptionGroupContext();
    const size = propSize ?? optionGroupContext?.size ?? 'md';

    // 고유 ID 생성 (접근성)
    const inputId = React.useId();

    // size → Checkbox/Radio 픽셀 높이 변환
    const inputSize = sizeToInputSize[size];

    // children에 renderContainer="div", size, id, disabled 전달
    const childWithProps = React.isValidElement(children)
      ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
          renderContainer: 'div',
          id: inputId,
          size: inputSize,
          ...(disabled && { disabled: true }),
        })
      : children;

    return (
      <label
        ref={ref}
        htmlFor={inputId}
        className={cn(optionVariants({ size, mode, disabled, className }))}
        {...props}
      >
        {childWithProps}
        <span className={cn(labelVariants({ size, disabled }))}>
          {label}
        </span>
      </label>
    );
  }
);

Option.displayName = 'Option';

export { Option, optionVariants };
