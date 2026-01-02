import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from './utils';
import { Icon } from './Icon';

const toggleSwitchVariants = cva(
  'relative inline-flex items-center flex-shrink-0 w-[32px] h-[18px] rounded-full transition-colors duration-300 cursor-pointer shadow-[0_0_1px_0_rgba(0,0,0,0.08)]',
  ({
    variants: {
      "disabled": {
        "false": "",
        "true": "bg-control-bg-disabled cursor-not-allowed",
      },
      "checked": {
        "false": "bg-control-bg-off",
        "true": "bg-control-bg-on",
      },
    },
    defaultVariants: {
      "checked": false,
      "disabled": false,
    },
    compoundVariants: [
      {
        "checked": true,
        "class": "bg-control-bg-on",
        "disabled": false,
      },
      {
        "checked": false,
        "class": "bg-control-bg-off",
        "disabled": false,
      },
      {
        "class": "bg-control-bg-disabled",
        "disabled": true,
      },
    ],
  })
);

export interface ToggleSwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>,
    VariantProps<typeof toggleSwitchVariants> {
  checked?: boolean;
  disabled?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  'aria-label'?: string;
}

const ToggleSwitch = React.forwardRef<HTMLInputElement, ToggleSwitchProps>(
  ({ className, checked = false, disabled = false, onChange, 'aria-label': ariaLabel, ...props }, ref) => {
    const knobClass = cn(
      'absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-300',
      checked ? 'right-[2px]' : 'left-[2px]',
      disabled
        ? 'fill-control-knob-disabled'
        : 'fill-control-knob-on',
      'drop-shadow-[0_2px_2px_rgba(0,0,0,0.07)] drop-shadow-[0_0_3px_rgba(0,0,0,0.10)]'
    );

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      onChange?.(event);
    };

    return (
      <label className="inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={handleChange}
          ref={ref}
          role="switch"
          aria-checked={checked}
          aria-label={ariaLabel}
          {...props}
        />
        <span
          className={cn(
            toggleSwitchVariants({
              checked,
              disabled,
              className,
            })
          )}
        >
          <span className={knobClass}>
            <Icon name="toggle-knob" size={14} />
          </span>
        </span>
      </label>
    );
  }
);

ToggleSwitch.displayName = 'ToggleSwitch';

export { ToggleSwitch, toggleSwitchVariants };
