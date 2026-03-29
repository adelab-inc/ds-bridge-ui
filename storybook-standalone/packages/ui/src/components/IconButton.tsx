import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { Tooltip, type TooltipProps } from './Tooltip';
import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';

const iconButtonVariants = cva('flex justify-center items-center flex-shrink-0', ({
    variants: {
      "iconButtonType": {
        "ghost": "text-icon-interactive-default",
        "ghost-destructive": "",
        "secondary": "bg-bg-accent-secondary",
        "tertiary": "bg-bg-subtle",
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
        "lg": "text-button-lg-medium rounded-lg",
        "md": "text-button-md-medium rounded-lg",
        "sm": "text-button-sm-medium rounded-[6px]",
      },
    },
    defaultVariants: {
      "iconButtonType": "ghost",
      "interaction": "default",
      "mode": "base",
      "size": "md",
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
        "class": "hover:bg-state-overlay-on-neutral-hover active:bg-state-overlay-on-neutral-pressed focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "iconButtonType": "ghost",
        "interaction": "default",
      },
      {
        "class": "text-icon-interactive-disabled",
        "iconButtonType": "ghost",
        "interaction": "disabled",
      },
      {
        "class": "hover:bg-brand-secondary-hover active:bg-brand-secondary-pressed focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "iconButtonType": "secondary",
        "interaction": "default",
      },
      {
        "class": "text-icon-interactive-on-secondary",
        "iconButtonType": "secondary",
        "interaction": ["default", "hover", "pressed", "focused"],
      },
      {
        "class": "bg-bg-disabled-on-filled text-icon-interactive-disabled",
        "iconButtonType": "secondary",
        "interaction": "disabled",
      },
      {
        "class": "hover:bg-[linear-gradient(0deg,#0000000f,#0000000f)] active:bg-[linear-gradient(0deg,#00000019,#00000019)] focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_theme(colors.border-contrast)_inset,0_0_0_2px_theme(colors.focus)]",
        "iconButtonType": "tertiary",
        "interaction": "default",
      },
      {
        "class": "text-icon-interactive-default",
        "iconButtonType": "tertiary",
        "interaction": ["default", "hover", "pressed", "focused"],
      },
      {
        "class": "bg-bg-disabled-on-filled text-icon-interactive-disabled",
        "iconButtonType": "tertiary",
        "interaction": "disabled",
      },
      {
        "class": "hover:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-hover),theme(colors.state-overlay-on-neutral-hover))] active:bg-[linear-gradient(0deg,theme(colors.state-overlay-on-neutral-pressed),theme(colors.state-overlay-on-neutral-pressed))] focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_theme(colors.border-semantic-error)_inset,0_0_0_2px_theme(colors.focus)]",
        "iconButtonType": "ghost-destructive",
        "interaction": "default",
      },
      {
        "class": "bg-bg-surface text-icon-semantic-error",
        "iconButtonType": "ghost-destructive",
        "interaction": ["default", "hover", "pressed", "focused"],
      },
      {
        "class": "text-icon-interactive-disabled",
        "iconButtonType": "ghost-destructive",
        "interaction": "disabled",
      },
      {
        "class": "cursor-wait",
        "interaction": "loading",
      },
    ],
  }));

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'disabled'>,
    VariantProps<typeof iconButtonVariants> {
  // iconButtonType, size, mode, interaction → VariantProps에서 상속
  iconOnly: React.ReactNode;
  /** 접근성 라벨 (필수) — 스크린 리더가 읽는 버튼 이름 */
  'aria-label': string;
  /** Tooltip 텍스트 (있으면 Tooltip 자동 렌더링) */
  tooltip?: string;
  /** Tooltip 세부 설정 */
  tooltipProps?: Partial<Omit<TooltipProps, 'content' | 'children'>>;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      iconButtonType,
      size,
      mode: propMode,
      interaction,
      iconOnly,
      tooltip,
      tooltipProps,
      ...props
    },
    ref,
  ) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    const isDisabled = interaction === 'disabled';
    const isLoading = interaction === 'loading';

    const iconSize = {
      lg: 24,
      md: 20,
      sm: 16,
    }[size || 'md'];

    const renderIcon = (iconNode: React.ReactNode) => {
      if (React.isValidElement(iconNode)) {
        return React.cloneElement(iconNode as React.ReactElement<{ size?: number }>, {
          size: iconSize,
        });
      }
      return iconNode;
    };

    const buttonElement = (
      <button
        className={cn(iconButtonVariants({ iconButtonType, size, mode, interaction, className }))}
        ref={ref}
        disabled={isDisabled || isLoading}
        {...props}
      >
        {isLoading ? <LoadingSpinner variant={iconButtonType || 'ghost'} size={iconSize} componentType="iconButton" /> : renderIcon(iconOnly)}
      </button>
    );

    if (tooltip) {
      return (
        <Tooltip content={tooltip} {...tooltipProps}>
          {buttonElement}
        </Tooltip>
      );
    }

    return buttonElement;
  },
);
IconButton.displayName = 'IconButton';

export { IconButton, iconButtonVariants };
