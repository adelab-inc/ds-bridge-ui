import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { Icon } from './Icon';
import { Menu, type MenuItem } from './Menu';
import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';

const selectVariants = cva(
  'flex items-center flex-1 border appearance-none',
  ({
    variants: {
      "error": {
        "false": "",
        "true": "",
      },
      "hasValue": {
        "false": "",
        "true": "",
      },
      "mode": {
        "base": "",
        "compact": "",
      },
      "size": {
        "md": "rounded-lg text-body-md-medium",
        "sm": "rounded-md text-body-sm-medium",
      },
    },
    defaultVariants: {
      "error": false,
      "hasValue": false,
      "mode": "base",
      "size": "md",
    },
    compoundVariants: [
      {
        "class": "py-component-inset-input-y px-component-inset-input-x gap-component-gap-icon-label-md",
        "mode": "base",
        "size": "md",
      },
      {
        "class": "py-component-inset-input-y px-component-inset-input-x gap-component-gap-icon-label-xs",
        "mode": "base",
        "size": "sm",
      },
      {
        "class": "py-component-inset-input-y-compact px-component-inset-input-x-compact gap-component-gap-icon-label-md-compact",
        "mode": "compact",
        "size": "md",
      },
      {
        "class": "py-component-inset-input-y-compact px-component-inset-input-x-compact gap-component-gap-icon-label-xs-compact",
        "mode": "compact",
        "size": "sm",
      },
      {
        "class": "border-field-border-default bg-field-bg-surface text-text-primary hover:bg-[#f0f0f0] active:bg-[#e6e6e6] focus:outline focus:outline-2 focus:outline-focus focus:outline-offset-[-2px]",
        "error": false,
        "hasValue": false,
      },
      {
        "class": "text-text-accent border-field-border-focus bg-bg-selection hover:bg-[#dde1eb] active:bg-[#d3d7e1] focus:outline focus:outline-2 focus:outline-focus focus:outline-offset-[-2px]",
        "error": false,
        "hasValue": true,
      },
      {
        "class": "border-field-border-error bg-field-bg-surface text-text-primary hover:bg-[#f0f0f0] active:bg-[#e6e6e6] focus:outline focus:outline-2 focus:outline-focus focus:outline-offset-[-2px]",
        "error": true,
      },
    ],
  })
);

const selectLabelVariants = cva('flex items-center self-stretch min-w-0 overflow-hidden', {
  variants: {
    size: {
      md: 'text-form-label-md-medium text-text-primary gap-layout-inline-xs',
      sm: 'text-form-label-sm-medium text-text-primary gap-layout-inline-xs',
    },
    isDisabled: {
      true: 'text-text-disabled',
      false: '',
    },
  },
  defaultVariants: {
    size: 'md',
    isDisabled: false,
  },
});

const selectIconVariants = cva('shrink-0 flex items-center justify-center text-icon-interactive-default', {
  variants: {
    size: {
      md: 'w-[14px] h-[14px]',
      sm: 'w-[12px] h-[12px]',
    },
    isDisabled: {
      true: 'text-icon-interactive-disabled',
      false: '',
    },
  },
  defaultVariants: {
    size: 'md',
    isDisabled: false,
  },
});

const selectHelperTextVariants = cva('', {
  variants: {
    size: {
      md: 'text-form-helper-text-md-regular text-field-text-help',
      sm: 'text-form-helper-text-sm-regular text-field-text-help',
    },
    hasError: {
      true: 'text-semantic-error',
      false: '',
    },
    isDisabled: {
      true: 'text-text-disabled',
      false: '',
    },
  },
  defaultVariants: {
    size: 'md',
    hasError: false,
    isDisabled: false,
  },
});

const selectContainerVariants = cva('flex flex-col overflow-hidden', {
  variants: {
    mode: {
      base: 'gap-component-gap-content-sm',
      compact: 'gap-component-gap-content-sm-compact',
    },
  },
  defaultVariants: {
    mode: 'base',
  },
});

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'>,
    VariantProps<typeof selectVariants> {
  label?: string;
  /** 필수 입력 표시 (asterisk *) */
  required?: boolean;
  helperText?: string;
  options: SelectOption[];
  error?: boolean;
  disabled?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Select 시작 아이콘 */
  startIcon?: React.ReactNode;
  /** Select 끝 아이콘 (기본값: chevron-down) */
  endIcon?: React.ReactNode;
  /** Start 아이콘 클릭 핸들러 */
  onStartIconClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** End 아이콘 클릭 핸들러 */
  onEndIconClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** 내부 label 요소에 전달할 추가 props */
  labelProps?: React.LabelHTMLAttributes<HTMLLabelElement>;
  /** 내부 helperText 요소에 전달할 추가 props */
  helperTextProps?: React.HTMLAttributes<HTMLSpanElement>;
  /** 내부 select trigger 요소에 전달할 추가 props */
  selectProps?: React.HTMLAttributes<HTMLDivElement>;
  /** 내부 startIcon wrapper 요소에 전달할 추가 props */
  startIconProps?: React.HTMLAttributes<HTMLElement>;
  /** 내부 endIcon wrapper 요소에 전달할 추가 props */
  endIconProps?: React.HTMLAttributes<HTMLElement>;
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      className,
      size = 'md',
      error = false,
      label,
      required = false,
      helperText,
      options,
      disabled = false,
      id,
      value,
      defaultValue,
      onChange,
      placeholder = '선택하세요',
      mode: propMode,
      startIcon,
      endIcon,
      onStartIconClick,
      onEndIconClick,
      labelProps,
      helperTextProps,
      selectProps,
      startIconProps,
      endIconProps,
      ...props
    },
    ref,
  ) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    // 상태 관리
    const [isOpen, setIsOpen] = React.useState(false);
    const [internalValue, setInternalValue] = React.useState<string>(
      (value as string) || (defaultValue as string) || '',
    );
    const [menuPosition, setMenuPosition] = React.useState({ x: 0, y: 0 });
    const [menuWidth, setMenuWidth] = React.useState<number>(0);

    const triggerRef = React.useRef<HTMLDivElement>(null);
    const combinedRef = ref || triggerRef;

    // 제어 컴포넌트 동기화
    React.useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value);
      }
    }, [value]);

    // 파생 상태
    const currentValue = value !== undefined ? value : internalValue;
    const hasValue = Boolean(currentValue);
    const selectedOption = options.find((opt) => opt.value === currentValue);
    const displayLabel = selectedOption?.label || placeholder;

    // 동적 스타일
    const selectTextColor = disabled ? 'text-text-primary' : hasValue ? 'text-text-accent' : 'text-text-primary';
    const chevronColor = disabled
      ? 'text-icon-interactive-disabled'
      : hasValue
        ? 'text-icon-interactive-on-selection'
        : 'text-icon-interactive-default';
    const chevronSize = size === 'sm' ? 12 : 14;

    // 위치 및 너비 계산 (동기적으로 처리하여 깜빡임 방지)
    React.useLayoutEffect(() => {
      if (isOpen && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setMenuPosition({
          x: rect.left,
          y: rect.bottom + 4,
        });
        setMenuWidth(rect.width);
      }
    }, [isOpen]);

    // 이벤트 핸들러
    const handleTriggerClick = () => {
      if (!disabled) {
        setIsOpen(!isOpen);
      }
    };

    const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return;

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          setIsOpen(!isOpen);
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setIsOpen(true);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setIsOpen(true);
          break;
      }
    };

    const handleItemClick = (selectedValue: string) => {
      // 내부 상태 업데이트
      setInternalValue(selectedValue);

      // Menu 닫기
      setIsOpen(false);

      // trigger로 포커스 복귀
      triggerRef.current?.focus();

      // onChange 콜백 호출
      onChange?.(selectedValue);
    };

    // SelectOption → MenuItem 변환
    const menuItems: MenuItem[] = React.useMemo(
      () =>
        options.map((option) => ({
          id: option.value,
          label: option.label,
          selected: currentValue === option.value,
          disabled: option.disabled ?? false,
        })),
      [options, currentValue],
    );

    // Menu wrapper 스타일 (Portal 내부 위치 제어)
    const menuWrapperStyle = React.useMemo<React.CSSProperties>(() => {
      const style: React.CSSProperties = {
        position: 'fixed',
        left: menuPosition.x,
        top: menuPosition.y,
        zIndex: 9999,
      };
      if (menuWidth > 0) {
        style.width = menuWidth;
      }
      return style;
    }, [menuPosition.x, menuPosition.y, menuWidth]);

    // ID 생성
    const selectId = id || `select-${React.useId()}`;
    const labelId = label ? `${selectId}-label` : undefined;
    const helperTextId = helperText ? `${selectId}-helper-text` : undefined;

    // 기본 endIcon (chevron-down)
    const defaultEndIcon = (
      <div className={cn('flex-shrink-0 transition-transform', chevronColor, !disabled && isOpen && 'rotate-180')}>
        <Icon name="chevron-down" size={chevronSize} />
      </div>
    );

    return (
      <div className={cn(selectContainerVariants({ mode }), className)} {...props}>
        {label && (
          <label
            id={labelId}
            htmlFor={selectId}
            {...labelProps}
            className={cn(selectLabelVariants({ size, isDisabled: disabled }), labelProps?.className)}
          >
            <span className="truncate">{label}</span>
            {required && (
              <span
                className={cn(
                  'text-text-accent',
                  size === 'md' ? 'text-form-label-md-medium' : 'text-form-label-sm-medium'
                )}
                aria-hidden="true"
              >
                *
              </span>
            )}
          </label>
        )}

        <div className="relative">
          <div
            ref={combinedRef as React.RefObject<HTMLDivElement>}
            id={selectId}
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls={isOpen ? `${selectId}-menu` : undefined}
            aria-labelledby={labelId}
            aria-describedby={helperTextId}
            aria-invalid={error}
            aria-disabled={disabled}
            aria-required={required}
            tabIndex={disabled ? -1 : 0}
            {...selectProps}
            className={cn(
              selectVariants({ size, mode, error, hasValue, className }),
              disabled && [
                'cursor-not-allowed opacity-50',
                '!border-field-border-default !bg-field-bg-surface !text-text-primary',
                'hover:!bg-field-bg-surface active:!bg-field-bg-surface',
                'focus:!shadow-none',
              ],
              !disabled && 'cursor-pointer',
              'select-none',
              selectProps?.className,
            )}
            onClick={handleTriggerClick}
            onKeyDown={handleTriggerKeyDown}
          >
            {startIcon && (
              onStartIconClick ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartIconClick(e);
                  }}
                  disabled={disabled}
                  tabIndex={-1}
                  {...(startIconProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
                  className={cn(selectIconVariants({ size, isDisabled: disabled }), startIconProps?.className)}
                >
                  {startIcon}
                </button>
              ) : (
                <span
                  {...startIconProps}
                  className={cn(selectIconVariants({ size, isDisabled: disabled }), startIconProps?.className)}
                >
                  {startIcon}
                </span>
              )
            )}

            <span className={cn('flex-1 truncate', selectTextColor)}>{displayLabel}</span>

            {endIcon ? (
              onEndIconClick ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEndIconClick(e);
                  }}
                  disabled={disabled}
                  tabIndex={-1}
                  {...(endIconProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
                  className={cn(selectIconVariants({ size, isDisabled: disabled }), endIconProps?.className)}
                >
                  {endIcon}
                </button>
              ) : (
                <span
                  {...endIconProps}
                  className={cn(selectIconVariants({ size, isDisabled: disabled }), endIconProps?.className)}
                >
                  {endIcon}
                </span>
              )
            ) : (
              defaultEndIcon
            )}
          </div>

          {isOpen &&
            ReactDOM.createPortal(
              <div style={menuWrapperStyle}>
                <Menu
                  id={`${selectId}-menu`}
                  items={menuItems}
                  size={size}
                  onItemClick={(item) => handleItemClick(item.id)}
                  onClose={() => {
                    setIsOpen(false);
                    triggerRef.current?.focus();
                  }}
                  triggerRef={triggerRef}
                />
              </div>,
              document.body,
            )}
        </div>

        {helperText && (
          <span
            id={helperTextId}
            {...helperTextProps}
            className={cn(selectHelperTextVariants({ size, hasError: error, isDisabled: disabled }), helperTextProps?.className)}
          >
            {helperText}
          </span>
        )}
      </div>
    );
  },
);
Select.displayName = 'Select';

export { Select };
