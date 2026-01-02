import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from './utils';

const optionGroupVariants = cva(
  'inline-flex flex-col items-start gap-component-gap-contents-sm',
  ({
    variants: {
      "size": {
        "lg": "",
        "md": "",
        "sm": "",
      },
      "orientation": {
        "horizontal": "",
        "vertical": "",
      },
    },
    defaultVariants: {
      "orientation": "vertical",
      "size": "md",
    },
  })
);

const optionsContainerVariants = cva(
  'flex',
  {
    variants: {
      orientation: {
        horizontal: 'flex-row gap-layout-inline-lg',
        vertical: 'flex-col gap-layout-inline-lg',
      },
    },
    defaultVariants: {
      orientation: 'vertical',
    },
  }
);

const titleVariants = cva(
  'text-text-primary',
  {
    variants: {
      size: {
        lg: 'text-form-label-md-medium',
        md: 'text-form-label-md-medium',
        sm: 'text-form-label-sm-medium',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const helperTextVariants = cva(
  'text-field-text-help',
  {
    variants: {
      size: {
        lg: 'text-form-helper-text-md-regular',
        md: 'text-form-helper-text-md-regular',
        sm: 'text-form-helper-text-sm-regular',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export interface OptionGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof optionGroupVariants> {
  title?: string;
  helperText?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  orientation?: 'horizontal' | 'vertical';
  containerWidth?: string | number;
  groupType?: 'radio' | 'checkbox';
}

const OptionGroup = React.forwardRef<HTMLDivElement, OptionGroupProps>(
  ({ className, title, helperText, children, size = 'md', orientation = 'vertical', containerWidth = 279, groupType, ...props }, ref) => {
    // 고유 ID 생성 (접근성)
    const uniqueId = React.useId();
    const titleId = title ? `${uniqueId}-title` : undefined;
    const helperTextId = helperText ? `${uniqueId}-helper` : undefined;

    // Size에 따른 Checkbox/Radio height 매핑
    const inputSize = {
      sm: '20',
      md: '24',
      lg: '28',
    }[size] as '20' | '24' | '28';

    // children에 size prop 전달
    const childrenWithSize = React.Children.map(children, (child) => {
      if (React.isValidElement(child)) {
        return React.cloneElement(child as React.ReactElement<any>, {
          inputSize,
        });
      }
      return child;
    });

    // width 스타일 처리
    const widthValue = typeof containerWidth === 'number' ? `${containerWidth}px` : containerWidth;
    const combinedStyle = { ...props.style, width: widthValue };

    // 접근성 속성
    const role = groupType === 'radio' ? 'radiogroup' : 'group';
    const ariaLabelledBy = titleId;
    const ariaDescribedBy = helperTextId;

    return (
      <div
        ref={ref}
        className={cn(optionGroupVariants({ size, orientation, className }))}
        style={combinedStyle}
        role={role}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        {...props}
      >
        {title && (
          <div id={titleId} className={cn(titleVariants({ size }))}>
            {title}
          </div>
        )}
        <div className={cn(optionsContainerVariants({ orientation }))}>
          {childrenWithSize}
        </div>
        {helperText && (
          <div id={helperTextId} className={cn(helperTextVariants({ size }))}>
            {helperText}
          </div>
        )}
      </div>
    );
  }
);

OptionGroup.displayName = 'OptionGroup';

export { OptionGroup, optionGroupVariants };
