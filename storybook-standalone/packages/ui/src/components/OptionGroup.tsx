import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';
import { Radio } from './Radio';

// OptionGroup Context - Option에 size 전달
interface OptionGroupContextValue {
  size: 'sm' | 'md' | 'lg';
}

const OptionGroupContext = React.createContext<OptionGroupContextValue | undefined>(undefined);

export const useOptionGroupContext = () => {
  return React.useContext(OptionGroupContext);
};

const optionGroupVariants = cva(
  'inline-flex flex-col items-start w-full',
  ({
    variants: {
      "mode": {
        "base": "",
        "compact": "",
      },
      "orientation": {
        "horizontal": "",
        "vertical": "",
      },
      "size": {
        "lg": "",
        "md": "",
        "sm": "",
      },
    },
    defaultVariants: {
      "mode": "base",
      "orientation": "vertical",
      "size": "md",
    },
    compoundVariants: [
      {
        "class": "gap-component-gap-content-sm",
        "mode": "base",
      },
      {
        "class": "gap-component-gap-content-sm-compact",
        "mode": "compact",
      },
    ],
  })
);

const optionsContainerVariants = cva(
  'flex min-h-[32px] items-center gap-component-gap-selection-group',
  {
    variants: {
      orientation: {
        horizontal: 'flex-row flex-wrap',
        vertical: 'flex-col',
      },
    },
    defaultVariants: {
      orientation: 'vertical',
    },
  }
);

const labelVariants = cva(
  'flex items-center text-text-primary gap-layout-inline-xs',
  {
    variants: {
      size: {
        lg: 'text-form-label-md-medium',
        md: 'text-form-label-md-medium',
        sm: 'text-form-label-sm-medium',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const helptextVariants = cva(
  'text-field-text-help',
  {
    variants: {
      size: {
        lg: 'text-form-helper-text-md-regular',
        md: 'text-form-helper-text-md-regular',
        sm: 'text-form-helper-text-sm-regular',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export interface OptionGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof optionGroupVariants> {
  label?: string;
  /** Label 표시 여부 (Figma: Show Label) */
  showLabel?: boolean;
  /** 필수 입력 표시 (asterisk *) (Figma: Show Asterisk) */
  showAsterisk?: boolean;
  helptext?: string;
  /** Helptext 표시 여부 (Figma: Show Helptext) */
  showHelptext?: boolean;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  orientation?: 'horizontal' | 'vertical';
}

const OptionGroup = React.forwardRef<HTMLDivElement, OptionGroupProps>(
  (
    {
      className,
      label,
      showLabel = true,
      showAsterisk = false,
      helptext,
      showHelptext = true,
      children,
      size = 'md',
      orientation = 'vertical',
      mode: propMode,
      ...props
    },
    ref
  ) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    // 고유 ID 생성 (접근성)
    const uniqueId = React.useId();
    const labelId = showLabel && label ? `${uniqueId}-label` : undefined;
    const helptextId = showHelptext && helptext ? `${uniqueId}-helptext` : undefined;

    // groupType 자동 감지 (children의 첫 번째 Option 내부의 Radio/Checkbox로 판단)
    const firstChild = React.Children.toArray(children)[0];
    let groupType: 'radio' | 'checkbox' = 'checkbox';

    if (React.isValidElement(firstChild)) {
      const optionChildren = firstChild.props.children;
      if (React.isValidElement(optionChildren)) {
        // Radio 컴포넌트와 직접 비교 (가장 확실한 방법)
        groupType = optionChildren.type === Radio ? 'radio' : 'checkbox';
      }
    }

    // 접근성 속성
    const role = groupType === 'radio' ? 'radiogroup' : 'group';

    // Context value 생성 (Go 템플릿 충돌 회피)
    const contextValue = React.useMemo(() => ({ size }), [size]);

    return (
      <OptionGroupContext.Provider value={contextValue}>
        <div
          ref={ref}
          className={cn(optionGroupVariants({ size, orientation, mode, className }))}
          role={role}
          aria-labelledby={labelId}
          aria-describedby={helptextId}
          {...props}
        >
          {showLabel && label && (
            <div id={labelId} className={cn(labelVariants({ size }))}>
              <span>{label}</span>
              {showAsterisk && (
                <span
                  className={cn(
                    'text-text-accent',
                    size === 'sm' ? 'text-form-label-sm-medium' : 'text-form-label-md-medium'
                  )}
                  aria-hidden="true"
                >
                  *
                </span>
              )}
            </div>
          )}
          <div className={cn(optionsContainerVariants({ orientation }))}>
            {children}
          </div>
          {showHelptext && helptext && (
            <div id={helptextId} className={cn(helptextVariants({ size }))}>
              {helptext}
            </div>
          )}
        </div>
      </OptionGroupContext.Provider>
    );
  }
);

OptionGroup.displayName = 'OptionGroup';

export { OptionGroup, optionGroupVariants };
