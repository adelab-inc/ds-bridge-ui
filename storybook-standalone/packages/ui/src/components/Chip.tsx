import { cva, type VariantProps } from "class-variance-authority";
import React from "react";
import { Icon } from "./Icon";
import { cn } from "./utils";
import { useSpacingMode } from "./SpacingModeProvider";

const chipVariants = cva('inline-flex items-center rounded-full', ({
    variants: {
      "disabled": {
        "false": "cursor-pointer",
        "true": "cursor-not-allowed",
      },
      "iconOnly": {
        "false": "",
        "true": "justify-center",
      },
      "interaction": {
        "default": "",
        "hover": "",
        "pressed": "",
      },
      "mode": {
        "base": "",
        "compact": "",
      },
      "selected": {
        "false": "",
        "true": "",
      },
      "showClose": {
        "false": "",
        "true": "",
      },
      "showIcon": {
        "false": "",
        "true": "",
      },
      "size": {
        "md": "text-chip-label-md-medium",
        "sm": "text-chip-label-sm-medium",
      },
      "type": {
        "default": "",
        "ghost": "",
      },
    },
    defaultVariants: {
      "disabled": false,
      "iconOnly": false,
      "interaction": "default",
      "mode": "base",
      "selected": false,
      "showClose": false,
      "showIcon": false,
      "size": "md",
      "type": "default",
    },
    compoundVariants: [
      {
        "class": "px-component-inset-chip-x py-component-inset-chip-y",
        "iconOnly": false,
        "mode": "base",
        "showClose": false,
        "showIcon": false,
      },
      {
        "class": "px-component-inset-chip-x-compact py-component-inset-chip-y-compact",
        "iconOnly": false,
        "mode": "compact",
        "showClose": false,
        "showIcon": false,
      },
      {
        "class": "pl-component-inset-chip-with-icon-x pr-component-inset-chip-x py-component-inset-chip-y",
        "iconOnly": false,
        "mode": "base",
        "showClose": false,
        "showIcon": true,
      },
      {
        "class": "pl-component-inset-chip-with-icon-x-compact pr-component-inset-chip-x-compact py-component-inset-chip-y-compact",
        "iconOnly": false,
        "mode": "compact",
        "showClose": false,
        "showIcon": true,
      },
      {
        "class": "pl-component-inset-chip-x pr-component-inset-chip-with-icon-x py-component-inset-chip-y",
        "iconOnly": false,
        "mode": "base",
        "showClose": true,
        "showIcon": false,
      },
      {
        "class": "pl-component-inset-chip-x-compact pr-component-inset-chip-with-icon-x-compact py-component-inset-chip-y-compact",
        "iconOnly": false,
        "mode": "compact",
        "showClose": true,
        "showIcon": false,
      },
      {
        "class": "px-component-inset-chip-with-icon-x py-component-inset-chip-y",
        "iconOnly": false,
        "mode": "base",
        "showClose": true,
        "showIcon": true,
      },
      {
        "class": "px-component-inset-chip-with-icon-x-compact py-component-inset-chip-y-compact",
        "iconOnly": false,
        "mode": "compact",
        "showClose": true,
        "showIcon": true,
      },
      {
        "class": "w-8 h-8",
        "iconOnly": true,
        "size": "md",
      },
      {
        "class": "w-7 h-7",
        "iconOnly": true,
        "size": "sm",
      },
      {
        "class": "text-text-primary bg-chip-bg-off border border-transparent hover:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-hover),theme(colors.state-overlay-on-neutral-hover))] [&:active:not(:has(button:active))]:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-pressed),theme(colors.state-overlay-on-neutral-pressed))] focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "disabled": false,
        "selected": false,
        "type": "default",
      },
      {
        "class": "text-text-disabled bg-chip-bg-disabled border border-transparent",
        "disabled": true,
        "type": "default",
      },
      {
        "class": "text-text-on-selection border border-border-selection bg-chip-bg-selected hover:bg-brand-selection-hover [&:active:not(:has(button:active))]:bg-brand-selection-pressed focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "disabled": false,
        "selected": true,
        "type": "default",
      },
      {
        "class": "text-text-disabled bg-chip-bg-disabled border border-transparent",
        "disabled": true,
        "selected": true,
        "type": "default",
      },
      {
        "class": "text-text-primary border border-transparent hover:bg-state-overlay-on-neutral-hover [&:active:not(:has(button:active))]:bg-state-overlay-on-neutral-pressed focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "disabled": false,
        "selected": false,
        "type": "ghost",
      },
      {
        "class": "text-text-disabled border border-transparent",
        "disabled": true,
        "type": "ghost",
      },
      {
        "class": "text-text-on-selection border border-transparent bg-chip-bg-selected hover:bg-brand-selection-hover [&:active:not(:has(button:active))]:bg-brand-selection-pressed focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "disabled": false,
        "selected": true,
        "type": "ghost",
      },
      {
        "class": "text-text-disabled border border-transparent",
        "disabled": true,
        "selected": true,
        "type": "ghost",
      },
    ],
  }));
const chipCloseButtonVariants = cva("flex items-center justify-center rounded-full p-[3px] -m-[3px]", {
  variants: {
    size: {
      md: "",
      sm: "",
    },
    selected: {
      true: "text-icon-interactive-on-selection hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed",
      false: "text-icon-interactive-default hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed",
    },
    disabled: {
      true: "text-icon-interactive-disabled cursor-not-allowed",
      false: "",
    },
  },
  compoundVariants: [
    {
      disabled: true,
      class: "text-icon-interactive-disabled cursor-not-allowed hover:bg-transparent active:bg-transparent",
    },
  ],
  defaultVariants: {
    size: "md",
    selected: false,
    disabled: false,
  },
});

type ChipIconProps =
  | { showIcon: true; icon: React.ReactNode }
  | { showIcon: false; icon?: never };

type ChipIconOnlyProps =
  | { iconOnly: true; label?: never; showClose?: false }
  | { iconOnly?: false; label?: React.ReactNode };

export type ChipProps =
  React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof chipVariants> &
  ChipIconProps &
  ChipIconOnlyProps & {
    disabled?: boolean;
    onClose?: () => void;
    value?: string;
  };

const Chip = React.forwardRef<HTMLDivElement, ChipProps>(
  ({ className, type, size, mode: propMode, interaction, selected, disabled = false, showIcon, showClose, iconOnly, icon, label, onClose, ...props }, ref) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    const numElements = (icon ? 1 : 0) + (label ? 1 : 0) + (showClose ? 1 : 0);

    const iconColorClass = disabled
      ? "text-icon-interactive-disabled"
      : selected
        ? "text-icon-interactive-on-selection"
        : "text-icon-interactive-default";

    return (
      <div
        ref={ref}
        className={cn(
          chipVariants({ type, size, mode, interaction, selected, disabled, showIcon, showClose, iconOnly, className }),
          numElements > 1 && "gap-component-gap-icon-label-xs"
        )}
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        {...props}
      >
        {icon && <span className={iconColorClass}>{icon}</span>}
        {!iconOnly && label && <span>{label}</span>}
        {!iconOnly && showClose && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            disabled={disabled}
            className={cn(chipCloseButtonVariants({ size, selected: selected ?? false, disabled }))}
          >
            <Icon name="close" size={size === "sm" ? 16 : 20} />
          </button>
        )}
      </div>
    );
  }
);
Chip.displayName = "Chip";

export { Chip, chipVariants, chipCloseButtonVariants };
