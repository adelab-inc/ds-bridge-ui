import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from './utils';

const optionVariants = cva(
  'cursor-pointer inline-flex items-center gap-layout-inline-md',
  ({
    variants: {
    },
    defaultVariants: {
    },
  })
);

const labelVariants = cva(
  'text-text-primary',
  {
    variants: {
      inputSize: {
        '16': 'text-body-sm-regular',
        '18': 'text-body-sm-regular',
        '20': 'text-body-sm-regular',
        '24': 'text-body-md-regular',
        '28': 'text-body-lg-regular',
      },
    },
    defaultVariants: {
      inputSize: '18',
    },
  }
);

export interface OptionProps
  extends Omit<React.LabelHTMLAttributes<HTMLLabelElement>, 'children'>,
    VariantProps<typeof optionVariants> {
  children: React.ReactNode;
  label: string;
  inputSize?: '16' | '18' | '20' | '24' | '28';
}

const Option = React.forwardRef<HTMLLabelElement, OptionProps>(
  ({ className, children, label, inputSize = '18', ...props }, ref) => {
    // 고유 ID 생성 (접근성)
    const inputId = React.useId();

    // children에 renderContainer="div", size, id 전달
    const childWithProps = React.isValidElement(children)
      ? React.cloneElement(children as React.ReactElement<any>, {
          renderContainer: 'div',
          id: inputId,
          ...(inputSize && { size: inputSize }),
        })
      : children;

    return (
      <label
        ref={ref}
        htmlFor={inputId}
        className={cn(optionVariants({ className }))}
        {...props}
      >
        {childWithProps}
        <span className={cn(labelVariants({ inputSize }))}>
          {label}
        </span>
      </label>
    );
  }
);

Option.displayName = 'Option';

export { Option, optionVariants };
