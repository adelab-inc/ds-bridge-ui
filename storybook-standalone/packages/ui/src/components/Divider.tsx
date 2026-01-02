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
      "color": {
        "default": "bg-border-default",
        "strong": "bg-border-strong",
        "subtle": "bg-border-subtle",
      },
    },
    defaultVariants: {
      "color": "default",
      "orientation": "horizontal",
    },
  })
);

export interface DividerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "color">,
    VariantProps<typeof dividerVariants> {
  asChild?: boolean;
}

const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ className, orientation, color, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(dividerVariants({ orientation, color, className }))}
      {...props}
    />
  )
);
Divider.displayName = "Divider";

export { Divider, dividerVariants };
