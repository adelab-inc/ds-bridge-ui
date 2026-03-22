import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from './utils';
import { RadioValue, Interaction } from '../types';

const radioVariants = cva(
  'flex items-center justify-center flex-shrink-0 w-[16px] h-[16px] rounded-full border transition-colors',
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
        "class": "border-control-stroke-default bg-bg-surface bg-[linear-gradient(0deg,#0000000f,#0000000f)]",
        "interaction": ["hover", "pressed"],
        "value": "unchecked",
      },
      {
        "class": "border-control-stroke-disabled bg-bg-disabled-on-light",
        "interaction": "disabled",
        "value": "unchecked",
      },
      {
        "class": "border-control-stroke-default bg-bg-surface",
        "interaction": "default",
        "value": "checked",
      },
      {
        "class": "border-control-stroke-default bg-bg-surface",
        "interaction": ["hover", "pressed"],
        "value": "checked",
      },
      {
        "class": "border-control-stroke-disabled bg-control-bg-disabled",
        "interaction": "disabled",
        "value": "checked",
      },
      {
        "class": "peer-focus-visible:shadow-[0_0_0_1px_var(--color-role-border-contrast,#FFF)_inset,0_0_0_2px_var(--color-role-focus,#0033A0)]",
        "interaction": "default",
        "value": "unchecked",
      },
      {
        "class": "peer-focus-visible:shadow-[0_0_0_1px_var(--color-role-border-contrast,#FFF)_inset,0_0_0_2px_var(--color-role-focus,#0033A0)]",
        "interaction": "default",
        "value": "checked",
      },
    ],
  })
);

export interface RadioProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'disabled' | 'value'>,
    VariantProps<typeof radioVariants> {
  size?: '16' | '18' | '20' | '24' | '28';
  value?: 'unchecked' | 'checked';
  interaction?: 'default' | 'hover' | 'pressed' | 'disabled';
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  'aria-label'?: string;
  renderContainer?: 'label' | 'div';
}

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, size = '18', value = RadioValue.UNCHECKED, interaction, onChange, 'aria-label': ariaLabel, renderContainer = 'label', ...props }, ref) => {
    const isDisabled = interaction === Interaction.DISABLED;
    const isChecked = value === RadioValue.CHECKED;

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

    return (
      <Container className={cn("group inline-flex items-center cursor-pointer", isDisabled && "cursor-not-allowed", containerSizeClass)}>
        <input
          type="radio"
          className="sr-only peer"
          checked={isChecked}
          disabled={isDisabled}
          onChange={handleChange}
          ref={ref}
          role="radio"
          aria-checked={isChecked}
          aria-label={ariaLabel}
          {...props}
        />
        <span
          className={cn(
            radioVariants({
              value,
              interaction,
              className,
            })
          )}
        >
          {isChecked && (
            <svg width="10" height="10" viewBox="0 0 10 10" className={isDisabled ? 'text-control-icon-disabled' : 'text-control-bg-on group-hover:text-brand-primary-hover group-active:text-brand-primary-hover'}>
              <circle cx="5" cy="5" r="5" fill="currentColor" />
            </svg>
          )}
        </span>
      </Container>
    );
  }
);

Radio.displayName = 'Radio';

export { Radio, radioVariants };
