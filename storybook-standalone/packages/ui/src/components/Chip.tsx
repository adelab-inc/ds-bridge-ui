import { cva, type VariantProps } from "class-variance-authority";
import React from "react";
import { Icon } from "./Icon";
import { cn } from "./utils";
import { useSpacingMode } from "./SpacingModeProvider";

const chipVariants = cva('inline-flex items-center rounded-full cursor-pointer', ({
    variants: {
      "hasCloseButton": {
        "false": "",
        "true": "",
      },
      "hasIcon": {
        "false": "",
        "true": "",
      },
      "mode": {
        "base": "",
        "compact": "",
      },
      "selectionStyle": {
        "multiple": "",
        "single": "",
      },
      "size": {
        "md": "text-chip-label-md-medium",
        "sm": "text-chip-label-sm-medium",
      },
      "state": {
        "default": "",
        "disabled": "cursor-not-allowed",
        "selected": "",
      },
      "variant": {
        "default": "",
        "ghost": "",
      },
    },
    defaultVariants: {
      "hasCloseButton": false,
      "hasIcon": false,
      "mode": "base",
      "selectionStyle": "multiple",
      "size": "md",
      "state": "default",
      "variant": "default",
    },
    compoundVariants: [
      {
        "class": "px-component-inset-chip-x py-component-inset-chip-y",
        "mode": "base",
      },
      {
        "class": "px-component-inset-chip-x-compact py-component-inset-chip-y-compact",
        "mode": "compact",
      },
      {
        "class": "pl-component-inset-chip-with-icon-x",
        "hasIcon": true,
        "mode": "base",
      },
      {
        "class": "pl-component-inset-chip-with-icon-x-compact",
        "hasIcon": true,
        "mode": "compact",
      },
      {
        "class": "text-text-primary bg-chip-bg-off border border-transparent hover:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-hover),theme(colors.state-overlay-on-neutral-hover))] [&:active:not(:has(button:active))]:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-pressed),theme(colors.state-overlay-on-neutral-pressed))] focus:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "state": "default",
        "variant": "default",
      },
      {
        "class": "text-text-disabled bg-chip-bg-disabled border border-transparent",
        "state": "disabled",
        "variant": "default",
      },
      {
        "class": "text-text-on-selection border border-border-selection bg-chip-bg-selected hover:bg-brand-selection-hover [&:active:not(:has(button:active))]:bg-brand-selection-pressed focus:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "state": "selected",
        "variant": "default",
      },
      {
        "class": "text-text-primary border border-transparent hover:bg-state-overlay-on-neutral-hover [&:active:not(:has(button:active))]:bg-state-overlay-on-neutral-pressed focus:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "state": "default",
        "variant": "ghost",
      },
      {
        "class": "text-text-disabled border border-transparent",
        "state": "disabled",
        "variant": "ghost",
      },
      {
        "class": "text-text-on-selection border border-transparent bg-chip-bg-selected hover:bg-brand-selection-hover [&:active:not(:has(button:active))]:bg-brand-selection-pressed focus:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "state": "selected",
        "variant": "ghost",
      },
    ],
  }));
const chipCloseButtonVariants = cva("flex items-center justify-center rounded-full p-[3px] -m-[3px]", {
  variants: {
    size: {
      md: "",
      sm: "",
    },
    state: {
      default: "text-icon-interactive-default hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed",
      selected: "text-icon-interactive-on-selection hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed",
      disabled: "text-icon-interactive-disabled cursor-not-allowed",
    },
  },
  defaultVariants: {
    size: "md",
    state: "default",
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
  ({ className, variant, size, mode: propMode, state, selectionStyle, hasIcon, hasCloseButton, icon, children, onClose, ...props }, ref) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    const isDisabled = state === "disabled";
    const numElements = (icon ? 1 : 0) + (children ? 1 : 0) + (hasCloseButton ? 1 : 0);

    const iconColorClass = {
      default: "text-icon-interactive-default",
      selected: "text-icon-interactive-on-selection",
      disabled: "text-icon-interactive-disabled",
    }[state ?? "default"];

    return (
      <div
        ref={ref}
        className={cn(
          chipVariants({ variant, size, mode, state, selectionStyle, hasIcon, hasCloseButton, className }),
          numElements > 1 && "gap-component-gap-icon-label-xs"
        )}
        aria-disabled={isDisabled}
        {...props}
      >
        {icon && <span className={iconColorClass}>{icon}</span>}
        <span>{children}</span>
        {hasCloseButton && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            disabled={isDisabled}
            className={cn(chipCloseButtonVariants({ size, state: state ?? "default" }))}
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
