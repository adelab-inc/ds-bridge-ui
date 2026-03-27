import { cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../utils';
import { useSpacingMode } from '../SpacingModeProvider';

const headingVariants = cva('flex items-center self-stretch text-text-tertiary text-button-sm-medium', ({
    variants: {
      "mode": {
        "base": "",
        "compact": "",
      },
    },
    defaultVariants: {
      "mode": "base",
    },
    compoundVariants: [
      {
        "class": "pt-component-inset-menu-item-y px-component-inset-menu-item-x pb-layout-stack-xs",
        "mode": "base",
      },
      {
        "class": "pt-component-inset-menu-item-y-compact px-component-inset-menu-item-x-compact pb-layout-stack-xs-compact",
        "mode": "compact",
      },
    ],
  }));

/**
 * MenuHeading Props
 */
interface HeadingProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  mode?: 'base' | 'compact';
}

/**
 * MenuHeading 컴포넌트 (그룹 제목)
 */
const Heading = React.forwardRef<HTMLDivElement, HeadingProps>(
  ({ children, className, mode: propMode, ...props }, ref) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    return (
      <div ref={ref} className={cn(headingVariants({ mode }), className)} {...props}>
        {children}
      </div>
    );
  }
);
Heading.displayName = 'Heading';

export { Heading, headingVariants };
