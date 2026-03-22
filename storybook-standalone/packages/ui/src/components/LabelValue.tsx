import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';

const labelValueVariants = cva('flex items-start', ({
    variants: {
      "labelWidth": {
        "compact": "",
        "default": "",
        "wide": "",
      },
      "size": {
        "md": "",
        "sm": "",
      },
    },
    defaultVariants: {
      "labelWidth": "default",
      "size": "md",
    },
    compoundVariants: [
      {
        "class": "gap-component-gap-content-md",
        "size": "md",
      },
      {
        "class": "gap-component-gap-content-md",
        "size": "sm",
      },
    ],
  }));

const labelValueLabelVariants = cva('flex items-center shrink-0 min-w-0 overflow-hidden', {
  variants: {
    size: {
      md: 'h-[36px] text-form-label-md-medium text-text-primary gap-layout-inline-xs',
      sm: 'h-[32px] text-form-label-sm-medium text-text-primary gap-layout-inline-xs',
    },
    labelWidth: {
      compact: 'w-[120px]',
      default: 'w-[160px]',
      wide: 'w-[200px]',
    },
  },
  defaultVariants: {
    size: 'md',
    labelWidth: 'default',
  },
});

const labelValueOutputVariants = cva(
  'flex items-center flex-1 min-w-0 bg-field-bg-filled gap-component-gap-icon-label-sm',
  {
    variants: {
      size: {
        md: 'h-[36px] rounded-lg',
        sm: 'h-[32px] rounded-md',
      },
      mode: {
        base: 'px-component-inset-label-value-x py-component-inset-label-value-y',
        compact: 'px-component-inset-label-value-x-compact py-component-inset-label-value-y-compact',
      },
    },
    defaultVariants: {
      size: 'md',
      mode: 'base',
    },
  },
);

const labelValueTextVariants = cva('flex-1 min-w-0 truncate text-text-primary', {
  variants: {
    size: {
      md: 'text-body-md-regular',
      sm: 'text-body-sm-regular',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const labelValuePrefixVariants = cva('shrink-0', {
  variants: {
    size: {
      md: 'text-body-md-regular text-field-text-help',
      sm: 'text-body-sm-regular text-field-text-help',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const labelValueIconVariants = cva('shrink-0 flex items-center justify-center text-icon-interactive-default', {
  variants: {
    size: {
      md: 'w-[20px] h-[20px]',
      sm: 'w-[16px] h-[16px]',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const labelValueHelperTextVariants = cva('', {
  variants: {
    size: {
      md: 'text-form-helper-text-md-regular text-field-text-help',
      sm: 'text-form-helper-text-sm-regular text-field-text-help',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

// ─── show* Discriminated Union 타입 ───

type LabelProps =
  | { showLabel: true; label: string }
  | { showLabel: false; label?: never };

type HelptextProps =
  | { showHelptext: true; helptext: string }
  | { showHelptext: false; helptext?: never };

type PrefixProps =
  | { showPrefix: true; prefix: React.ReactNode }
  | { showPrefix: false; prefix?: never };

type StartIconProps =
  | { showStartIcon: true; startIcon: React.ReactNode }
  | { showStartIcon: false; startIcon?: never };

type EndIconProps =
  | { showEndIcon: true; endIcon: React.ReactNode }
  | { showEndIcon: false; endIcon?: never };

// ─── 기반 Props ───

interface LabelValueBaseProps
  extends VariantProps<typeof labelValueVariants> {
  size?: 'md' | 'sm';
  labelWidth?: 'compact' | 'default' | 'wide';
  mode?: 'base' | 'compact' | null;
  text: string;
  className?: string;
}

// ─── 최종 LabelValueProps ───

export type LabelValueProps = LabelValueBaseProps
  & LabelProps
  & HelptextProps
  & PrefixProps
  & StartIconProps
  & EndIconProps;

const LabelValue = React.forwardRef<HTMLDivElement, LabelValueProps>(
  (
    {
      className,
      size = 'md',
      labelWidth = 'default',
      mode: propMode,
      text,
      showLabel,
      label,
      showHelptext,
      helptext,
      showPrefix,
      prefix,
      showStartIcon,
      startIcon,
      showEndIcon,
      endIcon,
    },
    ref,
  ) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    const labelId = `label-value-label-${React.useId()}`;
    const valueId = `label-value-value-${React.useId()}`;

    const containerClassName = cn(
      labelValueVariants({ size }),
      className,
    );

    return (
      <div ref={ref} className={containerClassName}>
        {showLabel && (
          <div
            id={labelId}
            className={labelValueLabelVariants({ size, labelWidth })}
          >
            <span className="truncate">{label}</span>
          </div>
        )}

        <div className="flex flex-col flex-1 min-w-0 gap-component-gap-content-sm">
          <div
            id={valueId}
            role="status"
            aria-labelledby={showLabel ? labelId : undefined}
            className={labelValueOutputVariants({ size, mode })}
          >
            {showPrefix && (
              <span className={labelValuePrefixVariants({ size })}>
                {prefix}
              </span>
            )}

            {showStartIcon && (
              <span className={labelValueIconVariants({ size })}>
                {startIcon}
              </span>
            )}

            <p className={labelValueTextVariants({ size })}>
              {text}
            </p>

            {showEndIcon && (
              <span className={labelValueIconVariants({ size })}>
                {endIcon}
              </span>
            )}
          </div>

          {showHelptext && (
            <span className={labelValueHelperTextVariants({ size })}>
              {helptext}
            </span>
          )}
        </div>
      </div>
    );
  },
);

LabelValue.displayName = 'LabelValue';

export { LabelValue, labelValueVariants };
