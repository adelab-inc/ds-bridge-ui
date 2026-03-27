import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";
import React from "react";

const dividerVariants = cva(
  'flex-shrink-0',
  ({
    variants: {
      "orientation": {
        "horizontal": "h-px w-full",
        "vertical": "w-px h-full self-stretch",
      },
      "tone": {
        "default": "bg-border-default",
        "inverse": "bg-border-inverse",
        "strong": "bg-border-strong",
        "subtle": "bg-border-subtle",
      },
    },
    defaultVariants: {
      "orientation": "horizontal",
      "tone": "default",
    },
  })
);

export interface DividerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof dividerVariants> {}

const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ className, orientation, tone, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(dividerVariants({ orientation, tone, className }))}
      {...props}
    />
  )
);
Divider.displayName = "Divider";

export { Divider, dividerVariants };
