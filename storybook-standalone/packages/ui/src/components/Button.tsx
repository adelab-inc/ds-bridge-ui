import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { cn } from './utils';

const buttonVariants = cva('inline-flex justify-center items-center py-component-inset-button-y', ({
    variants: {
      "size": {
        "lg": "min-w-[56px] px-component-inset-button-lg-x text-button-lg-medium rounded-lg gap-component-gap-icon-label-x-md",
        "md": "min-w-[52px] px-component-inset-button-md-x text-button-md-medium rounded-lg gap-component-gap-icon-label-x-md",
        "sm": "min-w-[49px] px-component-inset-button-sm-x text-button-sm-medium rounded-md gap-component-gap-icon-label-x-sm",
      },
      "isLoading": {
        "false": "",
        "true": "cursor-wait",
      },
      "isDisabled": {
        "false": "",
        "true": "",
      },
      "variant": {
        "destructive": "",
        "outline": "outline outline-1 outline-border-accent",
        "outline-destructive": "outline outline-1",
        "primary": "bg-bg-accent",
        "secondary": "bg-bg-accent-secondary",
        "tertiary": "bg-bg-container-medium",
      },
    },
    defaultVariants: {
      "isDisabled": false,
      "isLoading": false,
      "size": "md",
      "variant": "primary",
    },
    compoundVariants: [
      {
        "class": "bg-bg-disabled-on-filled text-text-disabled",
        "isDisabled": true,
        "isLoading": false,
        "variant": ["primary", "secondary", "destructive"],
      },
      {
        "class": "bg-bg-disabled-on-light outline outline-1 outline-border-disabled text-text-disabled",
        "isDisabled": true,
        "isLoading": false,
        "variant": ["outline", "outline-destructive"],
      },
      {
        "class": "bg-bg-disabled-on-light text-text-disabled",
        "isDisabled": true,
        "isLoading": false,
        "variant": "tertiary",
      },
      {
        "class": "hover:bg-brand-primary-hover active:bg-brand-primary-pressed focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border-contrast focus-visible:ring-2 focus-visible:ring-focus",
        "isDisabled": false,
        "isLoading": false,
        "variant": "primary",
      },
      {
        "class": "hover:bg-brand-secondary-hover active:bg-brand-secondary-pressed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border-contrast focus-visible:ring-2 focus-visible:ring-focus",
        "isDisabled": false,
        "isLoading": false,
        "variant": "secondary",
      },
      {
        "class": "hover:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-hover),theme(colors.state-overlay-on-neutral-hover))] active:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-pressed),theme(colors.state-overlay-on-neutral-pressed))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border-contrast focus-visible:ring-2 focus-visible:ring-focus",
        "isDisabled": false,
        "isLoading": false,
        "variant": "outline",
      },
      {
        "class": "hover:bg-[linear-gradient(0deg,#0000000f,#0000000f)] active:bg-[linear-gradient(0deg,#00000019,#00000019)] focus-visible:bg-bg-subtle focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "isDisabled": false,
        "isLoading": false,
        "variant": "tertiary",
      },
      {
        "class": "hover:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-colored-hover),theme(colors.state-overlay-on-colored-hover))] active:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-colored-pressed),theme(colors.state-overlay-on-colored-pressed))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border-contrast focus-visible:ring-2 focus-visible:ring-focus",
        "isDisabled": false,
        "isLoading": false,
        "variant": "destructive",
      },
      {
        "class": "hover:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-hover),theme(colors.state-overlay-on-neutral-hover))] active:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-pressed),theme(colors.state-overlay-on-neutral-pressed))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border-contrast focus-visible:ring-2 focus-visible:ring-focus",
        "isDisabled": false,
        "isLoading": false,
        "variant": "outline-destructive",
      },
      {
        "class": "text-text-inverse",
        "isDisabled": false,
        "variant": "primary",
      },
      {
        "class": "text-text-primary",
        "isDisabled": false,
        "variant": "secondary",
      },
      {
        "class": "text-text-accent",
        "isDisabled": false,
        "variant": "outline",
      },
      {
        "class": "text-text-primary",
        "isDisabled": false,
        "variant": "tertiary",
      },
      {
        "class": "text-text-inverse",
        "isDisabled": false,
        "variant": "destructive",
      },
      {
        "class": "text-text-semantic-error",
        "isDisabled": false,
        "variant": "outline-destructive",
      },
      {
        "class": "bg-bg-semantic-error",
        "isDisabled": false,
        "variant": "destructive",
      },
      {
        "class": "bg-bg-surface",
        "isDisabled": false,
        "variant": "outline-destructive",
      },
      {
        "class": "bg-bg-surface",
        "isDisabled": false,
        "variant": "outline",
      },
    ],
  }));

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      children,
      isLoading,
      leftIcon,
      rightIcon,
      disabled,
      ...props
    },
    ref,
  ) => {
    const isFunctionallyDisabled = disabled;
    const iconSize = {
      lg: 24,
      md: 20,
      sm: 16,
    }[size || 'md'];

    const iconColorClass = isFunctionallyDisabled
      ? 'text-icon-interactive-disabled'
      : {
          primary: 'text-icon-interactive-inverse',
          secondary: 'text-icon-interactive-on-secondary',
          outline: 'text-icon-interactive-on-selection',
          tertiary: 'text-icon-interactive-default',
          destructive: 'text-icon-interactive-inverse',
          'outline-destructive': 'text-icon-semantic-error',
        }[variant || 'primary'];

    const renderIcon = (icon: React.ReactNode) => {
      if (React.isValidElement(icon)) {
        return React.cloneElement(icon as React.ReactElement<any>, {
          size: iconSize,
        });
      }
      return icon;
    };

    return (
      <button
        className={cn(buttonVariants({ variant, size, isLoading: isLoading && !isFunctionallyDisabled, isDisabled: isFunctionallyDisabled, className }))}
        ref={ref}
        disabled={isFunctionallyDisabled || isLoading}
        {...props}
      >
        {isLoading && !isFunctionallyDisabled ? (
          (leftIcon || rightIcon) ? (
            <>
              {leftIcon && <LoadingSpinner variant={variant || 'primary'} size={iconSize} />}
              {children}
              {rightIcon && <LoadingSpinner variant={variant || 'primary'} size={iconSize} />}
            </>
          ) : (
            <LoadingSpinner variant={variant || 'primary'} size={iconSize} />
          )
        ) : (
          <>
            {leftIcon && <span className={iconColorClass}>{renderIcon(leftIcon)}</span>}
            {children}
            {rightIcon && <span className={iconColorClass}>{renderIcon(rightIcon)}</span>}
          </>
        )}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };