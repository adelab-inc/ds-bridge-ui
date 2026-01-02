import { cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../utils';

const ellipsisVariants = cva(({
    variants: {
    },
    defaultVariants: {
    },
  }));

export interface EllipsisProps
  extends React.HTMLAttributes<HTMLSpanElement> {}

const Ellipsis = React.forwardRef<
  HTMLSpanElement,
  EllipsisProps
>(({ className, children, ...props }, ref) => {
  return (
    <span
      className={cn(ellipsisVariants({ className }))}
      ref={ref}
      {...props}
    >
      {children || '...'}
    </span>
  );
});
Ellipsis.displayName = 'Ellipsis';

export { Ellipsis };
