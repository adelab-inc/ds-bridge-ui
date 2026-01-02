import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from './utils';
import { Icon } from './Icon';

const checkboxVariants = cva(
  'flex items-center justify-center flex-shrink-0 w-[18px] h-[18px] rounded-[2px] border transition-colors',
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
        "class": "border-control-stroke-disabled bg-bg-surface",
        "disabled": true,
      },
      {
        "checked": true,
        "class": "bg-control-bg-on border-0 hover:bg-brand-primary-hover active:bg-brand-primary-hover",
        "disabled": false,
      },
      {
        "checked": true,
        "class": "bg-control-bg-disabled border-0",
        "disabled": true,
      },
      {
        "checked": false,
        "class": "focus-visible:shadow-[0_0_0_1px_var(--color-role-border-contrast,#FFF)_inset,0_0_0_2px_var(--color-role-focus,#0033A0)]",
        "disabled": false,
      },
      {
        "checked": true,
        "class": "focus-visible:shadow-[0_0_0_1px_var(--color-role-border-contrast,#FFF)_inset,0_0_0_2px_var(--color-role-focus,#0033A0)]",
        "disabled": false,
      },
    ],
  })
);

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'checked'>,
    VariantProps<typeof checkboxVariants> {
  size?: '16' | '18' | '20' | '24' | '28';
  checked?: boolean;
  variant?: 'checked' | 'indeterminate';
  disabled?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  'aria-label'?: string;
  renderContainer?: 'label' | 'div';
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, size = '18', checked = false, variant = 'checked', disabled = false, onChange, 'aria-label': ariaLabel, renderContainer = 'label', ...props }, ref) => {
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

    const iconName = variant === 'indeterminate' ? 'checkbox-indeterminate' : 'checkbox-checked';

    const Container = renderContainer;

    return (
      <Container className={cn("inline-flex items-center cursor-pointer", containerSizeClass)}>
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={handleChange}
          ref={ref}
          role="checkbox"
          aria-checked={variant === 'indeterminate' ? 'mixed' : checked}
          aria-label={ariaLabel}
          {...props}
        />
        <span
          className={cn(
            checkboxVariants({
              checked,
              disabled,
              className,
            })
          )}
        >
          {checked && (
            <Icon
              name={iconName}
              size={12}
              className={disabled ? 'text-control-icon-disabled' : 'text-white'}
            />
          )}
        </span>
      </Container>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox, checkboxVariants };
