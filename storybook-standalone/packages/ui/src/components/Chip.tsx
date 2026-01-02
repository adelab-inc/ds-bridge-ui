import { cva, type VariantProps } from "class-variance-authority";
import React from "react";
import { Icon } from "./Icon";
import { cn } from "./utils";

const chipVariants = cva('inline-flex items-center rounded-full px-component-inset-chip-x py-component-inset-chip-y cursor-pointer', ({
    variants: {
      "size": {
        "md": "text-chip-label-md-medium",
        "sm": "text-chip-label-sm-medium",
      },
      "state": {
        "default": "bg-chip-bg-off text-text-primary border border-transparent",
        "disabled": "text-text-disabled bg-chip-bg-disabled",
        "selected": "",
      },
      "selectionStyle": {
        "multiple": "",
        "single": "",
      },
      "hasIcon": {
        "false": "",
        "true": "pl-component-inset-chip-with-icon-x",
      },
      "hasCloseButton": {
        "false": "",
        "true": "",
      },
    },
    defaultVariants: {
      "hasCloseButton": false,
      "hasIcon": false,
      "selectionStyle": "multiple",
      "size": "md",
      "state": "default",
    },
    compoundVariants: [
      {
        "class": "hover:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-hover),theme(colors.state-overlay-on-neutral-hover)),theme(colors.chip-bg-off)] active:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-pressed),theme(colors.state-overlay-on-neutral-pressed)),theme(colors.chip-bg-off)] focus:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "state": "default",
      },
      {
        "class": "text-text-on-selection bg-chip-bg-off border border-transparent",
        "selectionStyle": "single",
        "state": "selected",
      },
      {
        "class": "text-text-on-selection border border-border-selection bg-chip-bg-selected",
        "selectionStyle": "multiple",
        "state": "selected",
      },
    ],
  }));
const chipCloseButtonVariants = cva("flex items-center justify-center rounded-full text-icon-interactive-default", {
  variants: {
    size: {
      md: "w-[20px] h-[20px]",
      sm: "w-[16px] h-[16px]",
    },
  },
  compoundVariants: [
    {
      class: "hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed",
    },
  ],
  defaultVariants: {
    size: "md",
  },
});

export interface ChipProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "color">,
    VariantProps<typeof chipVariants> {
  icon?: React.ReactNode;
  onClose?: () => void;
  value?: string;
}

const Chip = React.forwardRef<HTMLDivElement, ChipProps>(
  ({ className, size, state, selectionStyle, hasIcon, hasCloseButton, icon, children, onClose, ...props }, ref) => {
    const isDisabled = state === "disabled";
    const numElements = (icon ? 1 : 0) + (children ? 1 : 0) + (hasCloseButton ? 1 : 0);

    return (
      <div
        ref={ref}
        className={cn(
          chipVariants({ size, state, selectionStyle, hasIcon, hasCloseButton, className }),
          numElements > 1 && "gap-component-gap-icon-label-x-xs"
        )}
        aria-disabled={isDisabled}
        {...props}
      >
        {icon}
        <span>{children}</span>
        {hasCloseButton && (
          <button
            type="button"
            onClick={onClose}
            disabled={isDisabled}
            className={cn(chipCloseButtonVariants({ size }))}
          >
            <Icon name="close" size={size === "sm" ? 16 : 20} />
          </button>
        )}
      </div>
    );
  }
);
Chip.displayName = "Chip";

export { Chip, chipVariants };
