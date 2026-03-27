import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';
import { designTokens } from '../tokens/design-tokens';

const buttonVariants = cva('inline-flex justify-center items-center', ({
    variants: {
      "buttonType": {
        "destructive": "",
        "ghost": "",
        "ghost-inverse": "",
        "primary": "bg-bg-accent",
        "secondary": "bg-bg-accent-secondary",
        "secondary-destructive": "bg-bg-semantic-error-subtle",
        "tertiary": "bg-bg-container-high",
      },
      "interaction": {
        "default": "",
        "disabled": "cursor-not-allowed",
        "focused": "",
        "hover": "",
        "loading": "cursor-wait",
        "pressed": "",
      },
      "mode": {
        "base": "",
        "compact": "",
      },
      "size": {
        "lg": "min-w-[56px] text-button-lg-medium rounded-lg",
        "md": "min-w-[52px] text-button-md-medium rounded-lg",
        "sm": "min-w-[49px] text-button-sm-medium rounded-md",
      },
    },
    defaultVariants: {
      "buttonType": "primary",
      "interaction": "default",
      "mode": "base",
      "size": "md",
    },
    compoundVariants: [
      {
        "class": "px-component-inset-button-lg-x py-component-inset-button-y gap-component-gap-icon-label-md",
        "mode": "base",
        "size": "lg",
      },
      {
        "class": "px-component-inset-button-md-x py-component-inset-button-y gap-component-gap-icon-label-md",
        "mode": "base",
        "size": "md",
      },
      {
        "class": "px-component-inset-button-sm-x py-component-inset-button-y gap-component-gap-icon-label-sm",
        "mode": "base",
        "size": "sm",
      },
      {
        "class": "px-component-inset-button-lg-x-compact py-component-inset-button-y-compact gap-component-gap-icon-label-md-compact",
        "mode": "compact",
        "size": "lg",
      },
      {
        "class": "px-component-inset-button-md-x-compact py-component-inset-button-y-compact gap-component-gap-icon-label-md-compact",
        "mode": "compact",
        "size": "md",
      },
      {
        "class": "px-component-inset-button-sm-x-compact py-component-inset-button-y-compact gap-component-gap-icon-label-sm-compact",
        "mode": "compact",
        "size": "sm",
      },
      {
        "buttonType": ["primary", "secondary", "destructive"],
        "class": "bg-bg-disabled-on-filled text-text-disabled",
        "interaction": "disabled",
      },
      {
        "buttonType": "ghost",
        "class": "text-text-disabled",
        "interaction": "disabled",
      },
      {
        "buttonType": "secondary-destructive",
        "class": "bg-bg-disabled-on-light text-text-disabled",
        "interaction": "disabled",
      },
      {
        "buttonType": "tertiary",
        "class": "bg-bg-disabled-on-light text-text-disabled",
        "interaction": "disabled",
      },
      {
        "buttonType": "ghost-inverse",
        "class": "text-text-disabled",
        "interaction": "disabled",
      },
      {
        "buttonType": "primary",
        "class": "hover:bg-brand-primary-hover active:bg-brand-primary-pressed focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "interaction": "default",
      },
      {
        "buttonType": "secondary",
        "class": "hover:bg-brand-secondary-hover active:bg-brand-secondary-pressed focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "interaction": "default",
      },
      {
        "buttonType": "ghost",
        "class": "hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "interaction": "default",
      },
      {
        "buttonType": "tertiary",
        "class": "hover:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-hover),theme(colors.state-overlay-on-neutral-hover))] active:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-pressed),theme(colors.state-overlay-on-neutral-pressed))] focus-visible:outline-none focus-visible:bg-bg-subtle focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "interaction": "default",
      },
      {
        "buttonType": "destructive",
        "class": "hover:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-colored-hover),theme(colors.state-overlay-on-colored-hover))] active:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-colored-pressed),theme(colors.state-overlay-on-colored-pressed))] focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "interaction": "default",
      },
      {
        "buttonType": "secondary-destructive",
        "class": "hover:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-colored-hover),theme(colors.state-overlay-on-colored-hover))] active:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-colored-pressed),theme(colors.state-overlay-on-colored-pressed))] focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_theme(colors.border-semantic-error)_inset,0_0_0_2px_theme(colors.focus)]",
        "interaction": "default",
      },
      {
        "buttonType": "ghost-inverse",
        "class": "hover:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-inverse-hover),theme(colors.state-overlay-on-inverse-hover))] active:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-inverse-pressed),theme(colors.state-overlay-on-inverse-pressed))] focus-visible:outline-none focus-visible:bg-[rgba(255,255,255,0.01)] focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "interaction": "default",
      },
      {
        "buttonType": "primary",
        "class": "text-text-inverse",
        "interaction": ["default", "hover", "pressed", "focused", "loading"],
      },
      {
        "buttonType": "secondary",
        "class": "text-text-primary",
        "interaction": ["default", "hover", "pressed", "focused", "loading"],
      },
      {
        "buttonType": "ghost",
        "class": "text-text-accent",
        "interaction": ["default", "hover", "pressed", "focused", "loading"],
      },
      {
        "buttonType": "tertiary",
        "class": "text-text-primary",
        "interaction": ["default", "hover", "pressed", "focused", "loading"],
      },
      {
        "buttonType": "destructive",
        "class": "text-text-inverse",
        "interaction": ["default", "hover", "pressed", "focused", "loading"],
      },
      {
        "buttonType": "secondary-destructive",
        "class": "text-text-semantic-error",
        "interaction": ["default", "hover", "pressed", "focused", "loading"],
      },
      {
        "buttonType": "ghost-inverse",
        "class": "text-text-inverse",
        "interaction": ["default", "hover", "pressed", "focused", "loading"],
      },
      {
        "buttonType": "destructive",
        "class": "bg-bg-semantic-error",
        "interaction": ["default", "hover", "pressed", "focused", "loading"],
      },
    ],
  }));

type StartIconProps =
  | { showStartIcon: true; startIcon: React.ReactNode }
  | { showStartIcon: false; startIcon?: never };

type EndIconProps =
  | { showEndIcon: true; endIcon: React.ReactNode }
  | { showEndIcon: false; endIcon?: never };

export type ButtonProps =
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'disabled'> &
  VariantProps<typeof buttonVariants> &
  StartIconProps &
  EndIconProps & {
    label: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      buttonType,
      size,
      mode: propMode,
      interaction,
      label,
      showStartIcon,
      showEndIcon,
      startIcon,
      endIcon,
      ...props
    },
    ref,
  ) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    const isDisabled = interaction === 'disabled';
    const isLoading = interaction === 'loading';

    const iconSize = {
      lg: 20,
      md: 16,
      sm: 16,
    }[size || 'md'];

    const spinnerLineHeight = {
      lg: (designTokens.fontSize['typography-button-lg-medium'][1] as { lineHeight: string }).lineHeight,
      md: (designTokens.fontSize['typography-button-md-medium'][1] as { lineHeight: string }).lineHeight,
      sm: (designTokens.fontSize['typography-button-sm-medium'][1] as { lineHeight: string }).lineHeight,
    }[size || 'md'];

    const spinnerContainerStyle = { height: spinnerLineHeight };

    const iconColorClass = isDisabled
      ? 'text-icon-interactive-disabled'
      : {
          primary: 'text-icon-interactive-inverse',
          secondary: 'text-icon-interactive-on-secondary',
          ghost: 'text-icon-interactive-on-selection',
          tertiary: 'text-icon-interactive-default',
          destructive: 'text-icon-interactive-inverse',
          'secondary-destructive': 'text-icon-semantic-error',
          'ghost-inverse': 'text-icon-interactive-inverse',
        }[buttonType || 'primary'];

    const renderIcon = (icon: React.ReactNode) => {
      if (React.isValidElement(icon)) {
        return React.cloneElement(icon as React.ReactElement<{ size?: number }>, {
          size: iconSize,
        });
      }
      return icon;
    };

    return (
      <button
        className={cn(buttonVariants({ buttonType, size, mode, interaction, className }))}
        ref={ref}
        disabled={isDisabled || isLoading}
        {...props}
      >
        {isLoading ? (
          (showStartIcon || showEndIcon) ? (
            <>
              {showStartIcon && <LoadingSpinner variant={buttonType || 'primary'} size={iconSize} />}
              {label}
              {showEndIcon && <LoadingSpinner variant={buttonType || 'primary'} size={iconSize} />}
            </>
          ) : (
            <span className="inline-flex items-center justify-center" style={spinnerContainerStyle}>
              <LoadingSpinner variant={buttonType || 'primary'} size={iconSize} />
            </span>
          )
        ) : (
          <>
            {showStartIcon && startIcon && <span className={iconColorClass}>{renderIcon(startIcon)}</span>}
            {label}
            {showEndIcon && endIcon && <span className={iconColorClass}>{renderIcon(endIcon)}</span>}
          </>
        )}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
