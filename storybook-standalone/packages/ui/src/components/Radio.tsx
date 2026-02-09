import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from './utils';
import { Icon } from './Icon';

const radioVariants = cva(
  'flex items-center justify-center flex-shrink-0 w-[18px] h-[18px] rounded-full border transition-colors',
  ({
    variants: {
      "checked": {
        "false": "",
        "true": "",
      },
      "disabled": {
        "false": "",
        "true": "cursor-not-allowed",
      },
    },
    defaultVariants: {
      "checked": false,
      "disabled": false,
    },
    compoundVariants: [
      {
        "checked": false,
        "class": "border-control-stroke-default bg-bg-surface",
        "disabled": false,
      },
      {
        "checked": false,
        "class": "border-control-stroke-disabled bg-control-bg-disabled",
        "disabled": true,
      },
      {
        "checked": true,
        "class": "border-control-stroke-default bg-bg-surface hover:border-control-bg-on active:border-control-bg-on peer-focus-visible:shadow-[0_0_0_1px_var(--color-role-border-contrast,#FFF)_inset,0_0_0_2px_var(--color-role-focus,#0033A0)]",
        "disabled": false,
      },
      {
        "checked": true,
        "class": "border-control-stroke-disabled bg-control-bg-disabled",
        "disabled": true,
      },
      {
        "checked": false,
        "class": "peer-focus-visible:shadow-[0_0_0_1px_var(--color-role-border-contrast,#FFF)_inset,0_0_0_2px_var(--color-role-focus,#0033A0)]",
        "disabled": false,
      },
    ],
  })
);

export interface RadioProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>,
    VariantProps<typeof radioVariants> {
  size?: '16' | '18' | '20' | '24' | '28';
  checked?: boolean;
  disabled?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  'aria-label'?: string;
  renderContainer?: 'label' | 'div';
}

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, size = '18', checked = false, disabled = false, onChange, 'aria-label': ariaLabel, renderContainer = 'label', ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      onChange?.(event);
    };

    // 외부 컨테이너 크기 클래스
    const containerSizeClass = {
      '16': 'h-[16px]',
      '18': 'h-[18px]',
      '20': 'h-[20px]',
      '24': 'h-[24px]',
      '28': 'h-[28px]',
    }[size];

    const Container = renderContainer;

    return (
      <Container className={cn("inline-flex items-center cursor-pointer", containerSizeClass)}>
        <input
          type="radio"
          className="sr-only peer"
          checked={checked}
          disabled={disabled}
          onChange={handleChange}
          ref={ref}
          role="radio"
          aria-checked={checked}
          aria-label={ariaLabel}
          {...props}
        />
        <span
          className={cn(
            radioVariants({
              checked,
              disabled,
              className,
            })
          )}
        >
          {checked && (
            <Icon
              name="radio-check"
              size={10}
              className={disabled ? 'text-control-icon-disabled' : 'text-control-bg-on'}
            />
          )}
        </span>
      </Container>
    );
  }
);

Radio.displayName = 'Radio';

export { Radio, radioVariants };
