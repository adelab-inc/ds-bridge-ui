import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';

const iconButtonVariants = cva('flex justify-center items-center flex-shrink-0', ({
    variants: {
      "isDisabled": {
        "false": "",
        "true": "",
      },
      "isLoading": {
        "false": "",
        "true": "cursor-wait",
      },
      "mode": {
        "base": "",
        "compact": "",
      },
      "size": {
        "lg": "text-button-lg-medium rounded-lg",
        "md": "text-button-md-medium rounded-lg",
        "sm": "text-button-sm-medium rounded-[6px]",
      },
      "variant": {
        "ghost": "text-icon-interactive-default",
        "ghost-destructive": "",
        "secondary": "bg-bg-accent-secondary",
        "tertiary": "bg-bg-subtle",
      },
    },
    defaultVariants: {
      "isDisabled": false,
      "isLoading": false,
      "mode": "base",
      "size": "md",
      "variant": "ghost",
    },
    compoundVariants: [
      {
        "class": "w-[40px] h-[40px]",
        "mode": "base",
        "size": "lg",
      },
      {
        "class": "w-[36px] h-[36px]",
        "mode": "base",
        "size": "md",
      },
      {
        "class": "w-[32px] h-[32px]",
        "mode": "base",
        "size": "sm",
      },
      {
        "class": "w-[40px] h-[40px]",
        "mode": "compact",
        "size": "lg",
      },
      {
        "class": "w-[36px] h-[36px]",
        "mode": "compact",
        "size": "md",
      },
      {
        "class": "w-[32px] h-[32px]",
        "mode": "compact",
        "size": "sm",
      },
      {
        "class": "hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border-contrast focus-visible:ring-2 focus-visible:ring-focus",
        "isDisabled": false,
        "isLoading": false,
        "variant": "ghost",
      },
      {
        "class": "text-icon-interactive-disabled",
        "isDisabled": true,
        "isLoading": false,
        "variant": "ghost",
      },
      {
        "class": "hover:bg-brand-secondary-hover active:bg-brand-secondary-pressed focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border-contrast focus-visible:ring-2 focus-visible:ring-focus",
        "isDisabled": false,
        "isLoading": false,
        "variant": "secondary",
      },
      {
        "class": "text-icon-interactive-default",
        "isDisabled": false,
        "variant": "secondary",
      },
      {
        "class": "bg-bg-disabled-on-filled text-icon-interactive-disabled",
        "isDisabled": true,
        "isLoading": false,
        "variant": "secondary",
      },
      {
        "class": "hover:bg-[linear-gradient(0deg,#0000000f,#0000000f)] active:bg-[linear-gradient(0deg,#00000019,#00000019)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border-contrast focus-visible:ring-2 focus-visible:ring-focus",
        "isDisabled": false,
        "isLoading": false,
        "variant": "tertiary",
      },
      {
        "class": "text-icon-interactive-default",
        "isDisabled": false,
        "variant": "tertiary",
      },
      {
        "class": "bg-bg-disabled-on-filled text-icon-interactive-disabled",
        "isDisabled": true,
        "isLoading": false,
        "variant": "tertiary",
      },
      {
        "class": "hover:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-hover),theme(colors.state-overlay-on-neutral-hover))] active:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-pressed),theme(colors.state-overlay-on-neutral-pressed))] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border-contrast focus-visible:ring-2 focus-visible:ring-focus",
        "isDisabled": false,
        "isLoading": false,
        "variant": "ghost-destructive",
      },
      {
        "class": "bg-bg-surface text-icon-semantic-error",
        "isDisabled": false,
        "variant": "ghost-destructive",
      },
      {
        "class": "bg-bg-disabled-on-light text-icon-interactive-disabled",
        "isDisabled": true,
        "isLoading": false,
        "variant": "ghost-destructive",
      },
      {
        "class": "cursor-wait",
        "isLoading": true,
      },
    ],
  }));

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  isLoading?: boolean;
  icon: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant,
      size,
      mode: propMode,
      icon,
      isLoading,
      disabled,
      ...props
    },
    ref,
  ) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    const isFunctionallyDisabled = isLoading || disabled;
    const iconSize = {
      lg: 24,
      md: 20,
      sm: 16,
    }[size || 'md'];

    const renderIcon = (iconNode: React.ReactNode) => {
      if (React.isValidElement(iconNode)) {
        return React.cloneElement(iconNode as React.ReactElement<any>, {
          size: iconSize,
        });
      }
      return iconNode;
    };

    return (
      <button
        className={cn(iconButtonVariants({ variant, size, mode, isLoading: isLoading && !disabled, isDisabled: isFunctionallyDisabled, className }))}
        ref={ref}
        disabled={isFunctionallyDisabled}
        {...props}
      >
        {isLoading && !disabled ? <LoadingSpinner variant={variant || 'ghost'} size={iconSize} /> : renderIcon(icon)}
      </button>
    );
  },
);
IconButton.displayName = 'IconButton';

export { IconButton, iconButtonVariants };
