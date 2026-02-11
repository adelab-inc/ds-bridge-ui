import { cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../utils';

const headingVariants = cva('flex items-center self-stretch pt-component-inset-menu-item-y px-component-inset-menu-item-x pb-layout-stack-xs text-text-tertiary text-button-sm-medium');

/**
 * MenuHeading Props
 */
interface HeadingProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * MenuHeading 컴포넌트 (그룹 제목)
 */
const Heading = React.forwardRef<HTMLDivElement, HeadingProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(headingVariants(), className)} {...props}>
        {children}
      </div>
    );
  }
);
Heading.displayName = 'Heading';

export { Heading };
