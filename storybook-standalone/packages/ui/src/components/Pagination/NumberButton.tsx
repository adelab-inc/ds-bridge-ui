import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../utils';

const numberButtonVariants = cva("'flex items-center justify-center w-[32px] h-[32px] rounded-lg text-body-md-regular'", ({
    variants: {
      "variant": {
        "active": "bg-bg-accent text-text-inverse border border-border-accent",
        "default": "text-text-tertiary bg-bg-surface",
      },
    },
    defaultVariants: {
      "variant": "default",
    },
    compoundVariants: [
      {
        "class": "hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed",
        "variant": "default",
      },
    ],
  }));

export interface NumberButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof numberButtonVariants> {}

const NumberButton = React.forwardRef<
  HTMLButtonElement,
  NumberButtonProps
>(({ className, variant, children, disabled, ...props }, ref) => {
  return (
    <button
      className={cn(
        numberButtonVariants({ variant, className }),
        disabled && 'pointer-events-none opacity-50'
      )}
      ref={ref}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
});
NumberButton.displayName = 'NumberButton';

export { NumberButton };
