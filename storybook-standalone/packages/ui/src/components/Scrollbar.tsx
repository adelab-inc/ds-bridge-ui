import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import React from 'react';

import { cn } from './utils';

// prettier-ignore
const scrollbarVariants = cva('overflow-auto bg-role-bg-surface', ({
    variants: {
      "variant": {
        "default": "",
      },
    },
    defaultVariants: {
      "variant": "default",
    },
  }));

const scrollbarStyle = `
  .aplus-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .aplus-scrollbar::-webkit-scrollbar:vertical {
    width: 12px;
  }
  .aplus-scrollbar::-webkit-scrollbar:horizontal {
    height: 12px;
  }
  .aplus-scrollbar::-webkit-scrollbar-track {
    background-color: transparent;
  }
  .aplus-scrollbar::-webkit-scrollbar-thumb {
    background-color: var(--color-role-control-stroke-default, #CED4DA);
    border-radius: 3px;
  }
  .aplus-scrollbar::-webkit-scrollbar-thumb:vertical {
    height: 30px;
  }
  .aplus-scrollbar::-webkit-scrollbar-thumb:horizontal {
    width: 30px;
  }
  .aplus-scrollbar:hover::-webkit-scrollbar-thumb {
    background: linear-gradient(0deg, var(--color-role-state-overlay-on-neutral-hover, rgba(0, 0, 0, 0.06)) 0%, var(--color-role-state-overlay-on-neutral-hover, rgba(0, 0, 0, 0.06)) 100%), var(--color-role-control-stroke-default, #CED4DA);
  }
  .aplus-scrollbar::-webkit-scrollbar-thumb:active {
    background: linear-gradient(0deg, var(--color-role-state-overlay-on-neutral-pressed, rgba(0, 0, 0, 0.10)) 0%, var(--color-role-state-overlay-on-neutral-pressed, rgba(0, 0, 0, 0.10)) 100%), var(--color-role-control-stroke-default, #CED4DA);
  }
`;

const ScrollbarStyles = () => <style>{scrollbarStyle}</style>;

export interface ScrollbarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof scrollbarVariants> {}

const Scrollbar = React.forwardRef<HTMLDivElement, ScrollbarProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <>
        <ScrollbarStyles />
        <div
          className={cn('aplus-scrollbar', scrollbarVariants({ variant }), className)}
          ref={ref}
          {...props}
        />
      </>
    );
  },
);
Scrollbar.displayName = 'Scrollbar';

export { Scrollbar };
