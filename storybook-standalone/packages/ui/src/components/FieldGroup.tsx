import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';

const fieldGroupVariants = cva('flex flex-col w-full', ({
    variants: {
      "mode": {
        "base": "",
        "compact": "",
      },
      "size": {
        "md": "",
        "sm": "",
      },
    },
    defaultVariants: {
      "mode": "base",
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
  }));

const fieldGroupLabelVariants = cva('flex items-center self-stretch min-w-0 overflow-hidden', {
  variants: {
    size: {
      md: 'text-form-label-md-medium text-text-primary gap-layout-inline-xs',
      sm: 'text-form-label-sm-medium text-text-primary gap-layout-inline-xs',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const fieldGroupRowVariants = cva('flex items-center', {
  variants: {
    mode: {
      base: 'gap-component-gap-input-group',
      compact: 'gap-component-gap-input-group-compact',
    },
  },
  defaultVariants: {
    mode: 'base',
  },
});

const fieldGroupHelperTextVariants = cva('', {
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

export interface FieldGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'size'>,
    VariantProps<typeof fieldGroupVariants> {
  /** 그룹 라벨 */
  label?: string;
  /** 필수 입력 표시 */
  required?: boolean;
  /** 도움말 텍스트 */
  helperText?: string;
  /** 크기 */
  size?: 'md' | 'sm';
  /** 자식 컴포넌트 (Field, Select, Button 등) */
  children: React.ReactNode;
  /** label 요소 추가 props */
  labelProps?: React.LabelHTMLAttributes<HTMLLabelElement>;
  /** helperText 요소 추가 props */
  helperTextProps?: React.HTMLAttributes<HTMLSpanElement>;
  /** 내부 row 컨테이너 추가 props */
  rowProps?: React.HTMLAttributes<HTMLDivElement>;
  /** maxLength 입력 완료 시 다음 필드로 자동 포커스 이동 */
  autoFocusNext?: boolean;
}

const FieldGroup = React.forwardRef<HTMLDivElement, FieldGroupProps>(
  (
    {
      className,
      label,
      required = false,
      helperText,
      size = 'md',
      mode: propMode,
      children,
      id,
      labelProps,
      helperTextProps,
      rowProps,
      autoFocusNext = false,
      ...props
    },
    ref,
  ) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    const groupId = id || `field-group-${React.useId()}`;
    const helperTextId = helperText ? `${groupId}-helper` : undefined;

    // autoFocusNext를 위한 refs 배열
    const fieldRefs = React.useRef<(HTMLInputElement | HTMLTextAreaElement | null)[]>([]);

    const containerClassName = cn(
      fieldGroupVariants({ size, mode }),
      'overflow-hidden',
      className,
    );

    // autoFocusNext가 활성화된 경우 children을 순회하며 핸들러 주입
    const enhancedChildren = React.useMemo(() => {
      if (!autoFocusNext) return children;

      const childArray = React.Children.toArray(children);
      fieldRefs.current = [];

      return childArray.map((child, index) => {
        if (!React.isValidElement(child)) return child;

        const childProps = child.props as {
          maxLength?: number;
          onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
          ref?: React.Ref<HTMLInputElement | HTMLTextAreaElement>;
        };

        // maxLength가 없는 요소는 그대로 반환
        if (!childProps.maxLength) return child;

        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          // 원래 onChange 호출
          childProps.onChange?.(e);

          // maxLength에 도달하면 다음 필드로 포커스 이동
          const { value, maxLength } = e.target;
          if (maxLength && value.length >= maxLength) {
            const nextIndex = index + 1;
            if (nextIndex < fieldRefs.current.length) {
              fieldRefs.current[nextIndex]?.focus();
            }
          }
        };

        const setRef = (el: HTMLInputElement | HTMLTextAreaElement | null) => {
          fieldRefs.current[index] = el;
          // 원래 ref 처리
          const originalRef = childProps.ref;
          if (typeof originalRef === 'function') {
            originalRef(el);
          } else if (originalRef && 'current' in originalRef) {
            (originalRef as React.MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>).current = el;
          }
        };

        return React.cloneElement(child as React.ReactElement<{
          onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
          ref?: React.Ref<HTMLInputElement | HTMLTextAreaElement>;
        }>, {
          onChange: handleChange,
          ref: setRef,
        });
      });
    }, [autoFocusNext, children]);

    return (
      <div ref={ref} className={containerClassName} {...props}>
        {label && (
          <label
            id={`${groupId}-label`}
            {...labelProps}
            className={cn(
              fieldGroupLabelVariants({ size }),
              labelProps?.className,
            )}
          >
            <span className="truncate">{label}</span>
            {required && (
              <span
                className={cn(
                  'text-text-accent',
                  size === 'md' ? 'text-form-label-md-medium' : 'text-form-label-sm-medium',
                )}
                aria-hidden="true"
              >
                *
              </span>
            )}
          </label>
        )}

        <div
          role="group"
          aria-labelledby={label ? `${groupId}-label` : undefined}
          aria-describedby={helperTextId}
          {...rowProps}
          className={cn(fieldGroupRowVariants({ mode }), rowProps?.className)}
        >
          {enhancedChildren}
        </div>

        {helperText && (
          <span
            id={helperTextId}
            {...helperTextProps}
            className={cn(
              fieldGroupHelperTextVariants({ size }),
              helperTextProps?.className,
            )}
          >
            {helperText}
          </span>
        )}
      </div>
    );
  },
);

FieldGroup.displayName = 'FieldGroup';

export { FieldGroup, fieldGroupVariants };
