import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { Icon } from './Icon';
import { Menu, type MenuItem } from './Menu';
import { cn } from './utils';

const selectVariants = cva(
  'flex py-component-inset-fields-y px-component-inset-fields-x items-center flex-1 border appearance-none',
  ({
    variants: {
      "size": {
        "md": "gap-component-gap-icon-label-x-md rounded-lg text-body-md-medium",
        "sm": "gap-component-gap-icon-label-x-xs rounded-md text-body-sm-medium",
      },
      "error": {
        "false": "",
        "true": "",
      },
      "hasValue": {
        "false": "",
        "true": "",
      },
    },
    defaultVariants: {
      "error": false,
      "hasValue": false,
      "size": "md",
    },
    compoundVariants: [
      {
        "class": "border-field-border-default bg-field-bg-surface text-text-primary hover:bg-[#f0f0f0] active:bg-[#e6e6e6] focus:shadow-[0_0_0_1px_#212529_inset_0_0_0_2px_#0066ff]",
        "error": false,
        "hasValue": false,
      },
      {
        "class": "text-text-accent border-field-border-focus bg-bg-selection hover:bg-[#dde1eb] active:bg-[#d3d7e1] focus:shadow-[0_0_0_1px_#212529_inset_0_0_0_2px_#0066ff]",
        "error": false,
        "hasValue": true,
      },
      {
        "class": "border-field-border-error bg-field-bg-surface text-text-primary hover:bg-[#f0f0f0] active:bg-[#e6e6e6] focus:shadow-[0_0_0_1px_#212529_inset_0_0_0_2px_#0066ff]",
        "error": true,
      },
    ],
  })
);

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'>,
    VariantProps<typeof selectVariants> {
  label?: string;
  helperText?: string;
  options: SelectOption[];
  error?: boolean;
  disabled?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      className,
      size,
      error = false,
      label,
      helperText,
      options,
      disabled = false,
      id,
      value,
      defaultValue,
      onChange,
      placeholder = '선택하세요',
      ...props
    },
    ref,
  ) => {
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
    const labelTypography = size === 'sm' ? 'text-form-label-sm-medium' : 'text-form-label-md-medium';
    const helperTextTypography =
      size === 'sm' ? 'text-form-helper-text-sm-regular' : 'text-form-helper-text-md-regular';
    const helperTextColor = error ? 'text-color-role-semantic-error' : 'text-text-secondary';
    const iconColor = disabled
      ? 'text-icon-interactive-default'
      : hasValue
        ? 'text-icon-interactive-on-selection'
        : 'text-icon-interactive-default';
    const selectTextColor = disabled ? 'text-text-primary' : hasValue ? 'text-text-accent' : 'text-text-primary';
    const iconSize = size === 'sm' ? 16 : 20;

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
    const labelId = label ? `${id}-label` : undefined;
    const helperTextId = helperText ? `${id}-helper-text` : undefined;

    return (
      <div className="flex flex-col gap-component-gap-contents-sm w-[240px]" {...props}>
        {label && (
          <label id={labelId} htmlFor={id} className={cn(labelTypography, 'text-text-primary')}>
            {label}
          </label>
        )}

        <div className="relative">
          <div
            ref={combinedRef as React.RefObject<HTMLDivElement>}
            id={id}
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls={isOpen ? `${id}-menu` : undefined}
            aria-labelledby={labelId}
            aria-describedby={helperTextId}
            aria-invalid={error}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            className={cn(
              selectVariants({ size, error, hasValue, className }),
              disabled && [
                'cursor-not-allowed opacity-50',
                '!border-field-border-default !bg-field-bg-surface !text-text-primary',
                'hover:!bg-field-bg-surface active:!bg-field-bg-surface',
                'focus:!shadow-none',
              ],
              !disabled && 'cursor-pointer',
              'select-none',
            )}
            onClick={handleTriggerClick}
            onKeyDown={handleTriggerKeyDown}
          >
            <span className={cn('flex-1 truncate', selectTextColor)}>{displayLabel}</span>

            <div className={cn('flex-shrink-0 transition-transform', iconColor, !disabled && isOpen && 'rotate-180')}>
              <Icon name="chevron-down" size={iconSize} />
            </div>
          </div>

          {isOpen &&
            ReactDOM.createPortal(
              <div style={menuWrapperStyle}>
                <Menu
                  id={`${id}-menu`}
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
          <p id={helperTextId} className={cn(helperTextTypography, helperTextColor)}>
            {helperText}
          </p>
        )}
      </div>
    );
  },
);
Select.displayName = 'Select';

export { Select };
