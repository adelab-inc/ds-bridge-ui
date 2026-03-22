import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from './utils';
import { CheckboxValue, Interaction } from '../types';

const checkboxVariants = cva(
  'flex items-center justify-center flex-shrink-0 w-[16px] h-[16px] rounded-[2px] border transition-colors',
  ({
    variants: {
      "interaction": {
        "default": "",
        "disabled": "cursor-not-allowed",
        "hover": "",
        "pressed": "",
      },
      "value": {
        "checked": "",
        "indeterminate": "",
        "unchecked": "",
      },
    },
    defaultVariants: {
      "interaction": "default",
      "value": "unchecked",
    },
    compoundVariants: [
      {
        "class": "border-control-stroke-default bg-bg-surface hover:bg-[linear-gradient(0deg,#0000000f,#0000000f)] active:bg-[linear-gradient(0deg,#0000000f,#0000000f)]",
        "interaction": "default",
        "value": "unchecked",
      },
      {
        "class": "border-control-stroke-disabled bg-bg-disabled-on-light",
        "interaction": "disabled",
        "value": "unchecked",
      },
      {
        "class": "bg-control-bg-on border-0 hover:bg-brand-primary-hover active:bg-brand-primary-hover",
        "interaction": "default",
        "value": ["checked", "indeterminate"],
      },
      {
        "class": "bg-control-bg-disabled border-0",
        "interaction": "disabled",
        "value": ["checked", "indeterminate"],
      },
      {
        "class": "peer-focus-visible:shadow-[0_0_0_1px_var(--color-role-border-contrast,#FFF)_inset,0_0_0_2px_var(--color-role-focus,#0033A0)]",
        "interaction": "default",
        "value": "unchecked",
      },
      {
        "class": "peer-focus-visible:shadow-[0_0_0_1px_var(--color-role-border-contrast,#FFF)_inset,0_0_0_2px_var(--color-role-focus,#0033A0)]",
        "interaction": "default",
        "value": ["checked", "indeterminate"],
      },
    ],
  })
);

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'checked' | 'disabled' | 'value'>,
    VariantProps<typeof checkboxVariants> {
  size?: '16' | '18' | '20' | '24' | '28';
  value?: 'unchecked' | 'checked' | 'indeterminate';
  interaction?: 'default' | 'hover' | 'pressed' | 'disabled';
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  'aria-label'?: string;
  renderContainer?: 'label' | 'div';
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, size = '18', value = CheckboxValue.UNCHECKED, interaction, onChange, 'aria-label': ariaLabel, renderContainer = 'label', ...props }, ref) => {
    const isDisabled = interaction === Interaction.DISABLED;
    const isChecked = value !== CheckboxValue.UNCHECKED;

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isDisabled) return;
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

    const iconColorClass = isDisabled ? 'text-control-icon-disabled' : 'text-white';

    const checkIcon = (
      <svg width="12" height="9" viewBox="0 0 12 9" fill="none" className={iconColorClass}>
        <path d="M1 3.76923L4.5 7L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );

    const indeterminateIcon = (
      <svg width="12" height="2" viewBox="0 0 12 2" fill="none" className={iconColorClass}>
        <path d="M1 1H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );

    return (
      <Container className={cn("inline-flex items-center cursor-pointer", isDisabled && "cursor-not-allowed", containerSizeClass)}>
        <input
          type="checkbox"
          className="sr-only peer"
          checked={isChecked}
          disabled={isDisabled}
          onChange={handleChange}
          ref={ref}
          role="checkbox"
          aria-checked={value === CheckboxValue.INDETERMINATE ? 'mixed' : value === CheckboxValue.CHECKED}
          aria-label={ariaLabel}
          {...props}
        />
        <span
          className={cn(
            checkboxVariants({
              value,
              interaction,
              className,
            })
          )}
        >
          {isChecked && (value === CheckboxValue.INDETERMINATE ? indeterminateIcon : checkIcon)}
        </span>
      </Container>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox, checkboxVariants };
