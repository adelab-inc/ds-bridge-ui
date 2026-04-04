import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { ToggleSwitchSelected } from '../types';
import { cn } from './utils';

const toggleSwitchVariants = cva(
  'relative inline-flex items-center flex-shrink-0 w-[32px] h-[18px] rounded-full transition-colors duration-300 cursor-pointer shadow-[0_0_1px_0_rgba(0,0,0,0.08)]',
  ({
    variants: {
      "selected": {
        "disabled": "bg-control-bg-disabled cursor-not-allowed",
        "off": "bg-control-bg-off",
        "on": "bg-control-bg-on",
      },
    },
    defaultVariants: {
      "selected": "off",
    },
  })
);

export interface ToggleSwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'disabled'>,
    VariantProps<typeof toggleSwitchVariants> {
  selected?: 'on' | 'off' | 'disabled';
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  'aria-label'?: string;
}

const ToggleSwitch = React.forwardRef<HTMLInputElement, ToggleSwitchProps>(
  ({ className, selected = ToggleSwitchSelected.OFF, onChange, 'aria-label': ariaLabel, ...props }, ref) => {
    const isDisabled = selected === ToggleSwitchSelected.DISABLED;
    const isChecked = selected === ToggleSwitchSelected.ON;

    const knobClass = cn(
      'absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-300',
      isChecked ? 'right-[2px]' : 'left-[2px]'
    );

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isDisabled) return;
      onChange?.(event);
    };

    return (
      <label className={cn('inline-flex items-center', isDisabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
        <input
          type="checkbox"
          className="sr-only"
          checked={isChecked}
          disabled={isDisabled}
          onChange={handleChange}
          ref={ref}
          role="switch"
          aria-checked={isChecked}
          aria-label={ariaLabel}
          {...props}
        />
        <span
          className={cn(
            toggleSwitchVariants({
              selected,
              className,
            })
          )}
        >
          <span className={knobClass}>
            <svg width="14" height="14" viewBox="0 0 20 21" fill="none">
              <g filter="url(#filter0_dd_toggle_knob)">
                <circle cx="10" cy="10" r="7" className={isDisabled ? 'fill-control-knob-disabled' : 'fill-control-knob-on'} />
              </g>
              <defs>
                <filter id="filter0_dd_toggle_knob" x="0" y="0" width="20" height="21" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                  <feFlood floodOpacity="0" result="BackgroundImageFix" />
                  <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                  <feOffset dy="2" />
                  <feGaussianBlur stdDeviation="1" />
                  <feComposite in2="hardAlpha" operator="out" />
                  <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.07 0" />
                  <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
                  <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                  <feOffset />
                  <feGaussianBlur stdDeviation="1.5" />
                  <feComposite in2="hardAlpha" operator="out" />
                  <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
                  <feBlend mode="normal" in2="effect1_dropShadow" result="effect2_dropShadow" />
                  <feBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow" result="shape" />
                </filter>
              </defs>
            </svg>
          </span>
        </span>
      </label>
    );
  }
);

ToggleSwitch.displayName = 'ToggleSwitch';

export { ToggleSwitch, toggleSwitchVariants };
