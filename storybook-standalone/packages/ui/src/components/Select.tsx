import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { Icon } from './Icon';
import { Menu, type MenuItemBase } from './Menu';
import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';
import { TruncateWithTooltip } from '../utils';

const selectVariants = cva(
  'flex items-center flex-1 border appearance-none',
  ({
    variants: {
      "interaction": {
        "default": "",
        "disabled": "",
        "error": "",
        "hover": "",
        "pressed": "",
        "selected": "",
      },
      "isOpen": {
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
      "interaction": "default",
      "isOpen": false,
      "mode": "base",
      "size": "md",
    },
    compoundVariants: [
      {
        "class": "py-component-inset-input-y px-component-inset-input-x gap-component-gap-icon-label-sm",
        "mode": "base",
        "size": "md",
      },
      {
        "class": "py-component-inset-input-y px-component-inset-input-x gap-component-gap-icon-label-sm",
        "mode": "base",
        "size": "sm",
      },
      {
        "class": "py-component-inset-input-y-compact px-component-inset-input-x-compact gap-component-gap-icon-label-sm-compact",
        "mode": "compact",
        "size": "md",
      },
      {
        "class": "py-component-inset-input-y-compact px-component-inset-input-x-compact gap-component-gap-icon-label-sm-compact",
        "mode": "compact",
        "size": "sm",
      },
      {
        "class": "border-field-border-default bg-field-bg-surface text-text-primary hover:bg-[#f0f0f0] active:bg-[#e6e6e6]",
        "interaction": "default",
        "isOpen": false,
      },
      {
        "class": "text-text-accent border-field-border-focus bg-bg-selection hover:bg-[#dde1eb] active:bg-[#d3d7e1]",
        "interaction": "default",
        "isOpen": true,
      },
      {
        "class": "border-field-border-default bg-[#f0f0f0] text-text-primary",
        "interaction": "hover",
        "isOpen": false,
      },
      {
        "class": "text-text-accent border-field-border-focus bg-[#dde1eb]",
        "interaction": "hover",
        "isOpen": true,
      },
      {
        "class": "border-field-border-default bg-[#e6e6e6] text-text-primary",
        "interaction": "pressed",
        "isOpen": false,
      },
      {
        "class": "text-text-accent border-field-border-focus bg-[#d3d7e1]",
        "interaction": "pressed",
        "isOpen": true,
      },
      {
        "class": "text-text-accent border-field-border-focus bg-bg-selection hover:bg-[#dde1eb] active:bg-[#d3d7e1]",
        "interaction": "selected",
      },
      {
        "class": "border-field-border-error bg-field-bg-surface text-text-primary hover:bg-[#f0f0f0] active:bg-[#e6e6e6]",
        "interaction": "error",
        "isOpen": false,
      },
      {
        "class": "text-text-accent border-field-border-focus bg-bg-selection hover:bg-[#dde1eb] active:bg-[#d3d7e1]",
        "interaction": "error",
        "isOpen": true,
      },
      {
        "class": "cursor-not-allowed border-field-border-disabled bg-field-bg-disabled text-text-disabled",
        "interaction": "disabled",
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

const selectIconVariants = cva('shrink-0 flex items-center justify-center', {
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

const selectContainerVariants = cva('flex flex-col overflow-hidden w-full', {
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

// ─── show* Discriminated Union 타입 ───

type LabelProps =
  | { showLabel: true; label: string; labelProps?: React.LabelHTMLAttributes<HTMLLabelElement> }
  | { showLabel: false; label?: never; labelProps?: never };

type HelptextProps =
  | { showHelptext: true; helptext: string; helperTextProps?: React.HTMLAttributes<HTMLSpanElement> }
  | { showHelptext: false; helptext?: never; helperTextProps?: never };

type StartIconProps =
  | {
      showStartIcon: true;
      startIcon: React.ReactNode;
      onStartIconClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
      startIconProps?: React.HTMLAttributes<HTMLElement>;
    }
  | { showStartIcon: false; startIcon?: never; onStartIconClick?: never; startIconProps?: never };

interface SelectOptionBase {
  /** 선택 시 반환되는 값 (MenuItem의 id에 매핑됨) */
  value: string;
  label?: string;
  disabled?: boolean;
  danger?: boolean;
}

/** type 생략 시 기존 동작 유지 (text-only / leadingIcon 있으면 icon-label) */
interface SelectOptionDefault extends SelectOptionBase {
  type?: 'text-only';
  leadingIcon?: React.ReactNode;
}

interface SelectOptionDescription extends SelectOptionBase {
  type: 'description';
  description: string;
}

interface SelectOptionProfile extends SelectOptionBase {
  type: 'profile';
  avatarContent: React.ReactNode;
  description: string;
}

interface SelectOptionBadge extends SelectOptionBase {
  type: 'badge';
  badgeContent: React.ReactNode;
}

interface SelectOptionIconLabelBadge extends SelectOptionBase {
  type: 'icon-label-badge';
  leadingIcon: React.ReactNode;
  badgeContent: React.ReactNode;
}

export type SelectOption =
  | SelectOptionDefault
  | SelectOptionDescription
  | SelectOptionProfile
  | SelectOptionBadge
  | SelectOptionIconLabelBadge;

// ─── 기반 Props ───

export type SelectProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> &
  VariantProps<typeof selectVariants> &
  LabelProps &
  HelptextProps &
  StartIconProps & {
    required?: boolean;
    options: SelectOption[];
    value?: string | string[];
    defaultValue?: string | string[];
    onChange?: (value: string | string[]) => void;
    placeholder?: string;
    /** 다중 선택 모드 */
    multiSelect?: boolean;
    /** Select 끝 아이콘 (기본값: chevron-down) */
    endIcon?: React.ReactNode;
    /** End 아이콘 클릭 핸들러 */
    onEndIconClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    /** 내부 select trigger 요소에 전달할 추가 props */
    selectProps?: React.HTMLAttributes<HTMLDivElement>;
    /** 내부 endIcon wrapper 요소에 전달할 추가 props */
    endIconProps?: React.HTMLAttributes<HTMLElement>;
  };

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      className,
      size = 'md',
      interaction,
      showLabel,
      label,
      required = false,
      showHelptext,
      helptext,
      showStartIcon,
      startIcon,
      options,
      id,
      value,
      defaultValue,
      onChange,
      placeholder = '선택하세요',
      multiSelect,
      mode: propMode,
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

    // interaction에서 파생
    const interactionValue = interaction as string | undefined;
    const isDisabled = interactionValue === 'disabled';
    const isError = interactionValue === 'error';

    // 상태 관리
    const [isOpen, setIsOpen] = React.useState(false);
    const [isFocused, setIsFocused] = React.useState(false);
    const [isFocusVisible, setIsFocusVisible] = React.useState(false);
    const [isMousePressed, setIsMousePressed] = React.useState(false);
    const [internalValue, setInternalValue] = React.useState<string | string[]>(
      defaultValue ?? (multiSelect ? [] : ''),
    );
    const [menuPosition, setMenuPosition] = React.useState({ x: 0, y: 0 });
    const [menuWidth, setMenuWidth] = React.useState<number>(0);
    const [menuMaxHeight, setMenuMaxHeight] = React.useState<number | undefined>(undefined);

    // pressed 상태는 Figma 정적 스냅샷 — 런타임 활성 스타일 제외
    const isPressed = interactionValue === 'pressed';

    // 활성 상태: 열려있거나 포커스가 있을 때 (pressed, mousedown 중 제외)
    const isActive = !isPressed && !isMousePressed && (isOpen || isFocused);

    // aria-activedescendant: 키보드 탐색 시 포커스를 트리거에 유지하고 하이라이트만 이동
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
    const focusableOptions = React.useMemo(
      () => options.filter((opt) => !opt.disabled),
      [options],
    );

    const triggerRef = React.useRef<HTMLDivElement>(null);
    const menuWrapperRef = React.useRef<HTMLDivElement>(null);
    const hadMouseDownRef = React.useRef(false);
    const combinedRef = ref || triggerRef;

    // 제어 컴포넌트 동기화
    React.useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value);
      }
    }, [value]);

    // 파생 상태
    const currentValue = value !== undefined ? value : internalValue;
    const currentValues: string[] = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
    const selectedOption = !multiSelect ? options.find((opt) => opt.value === currentValue) : undefined;
    const displayLabel = multiSelect
      ? (currentValues.length > 0 ? `${currentValues.length}개 선택됨` : placeholder)
      : (selectedOption?.label || placeholder);

    // 동적 스타일 (isActive: 열려있거나 포커스가 있을 때 selection 스타일 적용)
    const isSelected = interactionValue === 'selected';
    const selectTextColor = isDisabled ? 'text-text-disabled' : (isActive || isSelected) ? 'text-text-accent' : 'text-text-primary';
    const chevronColor = isDisabled
      ? 'text-icon-interactive-disabled'
      : (isActive || isSelected)
        ? 'text-icon-interactive-on-selection'
        : 'text-icon-interactive-default';
    const chevronSize = size === 'sm' ? 16 : 20;

    // 위치 및 너비 계산 — 2패스: 1차(추정)→렌더→2차(실측)
    // Y축 Flip: 하단 공간 부족 시 상단으로 전환
    const computePosition = React.useCallback((rect: DOMRect, actualMenuHeight?: number) => {
      const vh = document.documentElement.clientHeight;
      const gap = 4;

      // 실측값이 있으면 사용, 없으면 추정
      const menuH = actualMenuHeight ?? Math.min(options.length * 40 + 16, 640);

      const spaceBelow = vh - rect.bottom - gap;
      const spaceAbove = rect.top - gap;

      let y: number;
      let maxH: number | undefined = undefined;

      if (spaceBelow >= menuH) {
        // 하단에 충분한 공간
        y = rect.bottom + gap;
      } else if (spaceAbove >= menuH) {
        // 상단에 충분한 공간
        y = rect.top - menuH - gap;
      } else {
        // 양쪽 다 부족 → 더 넓은 쪽에 배치하되, 가용 공간에 맞게 max-height 제한
        if (spaceBelow >= spaceAbove) {
          y = rect.bottom + gap;
          maxH = spaceBelow;
        } else {
          maxH = spaceAbove;
          y = gap; // 상단 끝에 붙이고 max-height로 제한
        }
      }

      // X축 Shift: 우측 넘침 시 좌측으로 밀기 (우측 마진 24px)
      const vw = document.documentElement.clientWidth;
      const rightMargin = 24;
      let x = rect.left;
      const menuRight = x + rect.width;
      if (menuRight > vw - rightMargin) {
        x = Math.max(0, x - (menuRight - (vw - rightMargin)));
      }

      return { x, y, maxH };
    }, [options.length]);

    React.useLayoutEffect(() => {
      if (isOpen && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        // 1차: 추정값으로 위치 설정 (메뉴 렌더링 가능하도록)
        const pos1 = computePosition(rect);
        setMenuPosition({ x: pos1.x, y: pos1.y });
        setMenuMaxHeight(pos1.maxH);
        setMenuWidth(rect.width);

        // 2차: 메뉴 실측 후 보정 (다음 프레임에서)
        requestAnimationFrame(() => {
          if (menuWrapperRef.current && triggerRef.current) {
            const actualRect = triggerRef.current.getBoundingClientRect();
            const menuEl = menuWrapperRef.current.firstElementChild as HTMLElement | null;
            if (menuEl) {
              const actualMenuHeight = menuEl.getBoundingClientRect().height;
              const pos2 = computePosition(actualRect, actualMenuHeight);
              setMenuPosition({ x: pos2.x, y: pos2.y });
              setMenuMaxHeight(pos2.maxH);
            }
          }
        });
      }
    }, [isOpen, computePosition]);

    // mouseup 시 pressed 해제 (window 레벨로 등록하여 외부 mouseup도 감지)
    React.useEffect(() => {
      const handleMouseUp = () => setIsMousePressed(false);
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    // 스크롤 시 드롭다운 닫기
    React.useEffect(() => {
      if (!isOpen) return;
      const handleScroll = () => {
        setIsOpen(false);
        triggerRef.current?.focus();
      };
      window.addEventListener('scroll', handleScroll, true);
      return () => window.removeEventListener('scroll', handleScroll, true);
    }, [isOpen]);

    // 이벤트 핸들러
    const handleMouseDown = () => {
      hadMouseDownRef.current = true;
      if (!isDisabled) {
        setIsMousePressed(true);
      }
    };

    const handleTriggerClick = () => {
      if (!isDisabled) {
        if (!isOpen) {
          setIsOpen(true);
          // 마우스 클릭으로 열 때는 하이라이트 없음 (hover로 자연스럽게 진입)
          setHighlightedIndex(-1);
        } else {
          setIsOpen(false);
          setHighlightedIndex(-1);
        }
      }
    };

    const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
      if (isDisabled) return;

      if (isOpen) {
        // 메뉴 열린 상태: 포커스는 트리거에 유지, highlightedIndex만 변경
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setHighlightedIndex((prev) => (prev + 1) % focusableOptions.length);
            break;
          case 'ArrowUp':
            e.preventDefault();
            setHighlightedIndex((prev) =>
              prev <= 0 ? focusableOptions.length - 1 : prev - 1,
            );
            break;
          case 'Home':
            e.preventDefault();
            setHighlightedIndex(0);
            break;
          case 'End':
            e.preventDefault();
            setHighlightedIndex(focusableOptions.length - 1);
            break;
          case 'Enter':
          case ' ':
            e.preventDefault();
            if (highlightedIndex >= 0 && focusableOptions[highlightedIndex]) {
              handleItemClick(focusableOptions[highlightedIndex].value);
            }
            break;
          case 'Escape':
            e.preventDefault();
            setIsOpen(false);
            setHighlightedIndex(-1);
            break;
        }
      } else {
        // 메뉴 닫힌 상태
        switch (e.key) {
          case 'Enter':
          case ' ':
            e.preventDefault();
            setIsOpen(true);
            setHighlightedIndex(0);
            break;
          case 'ArrowDown':
            e.preventDefault();
            setIsOpen(true);
            setHighlightedIndex(0);
            break;
          case 'ArrowUp':
            e.preventDefault();
            setIsOpen(true);
            setHighlightedIndex(focusableOptions.length - 1);
            break;
        }
      }
    };

    // multiSelect: 아이템 클릭에 의한 onClose를 무시하기 위한 플래그
    const skipCloseRef = React.useRef(false);

    const handleItemClick = (selectedValue: string) => {
      if (multiSelect) {
        // 아이템 클릭에 의한 onClose를 무시
        skipCloseRef.current = true;
        // 토글 로직
        const next = currentValues.includes(selectedValue)
          ? currentValues.filter((v) => v !== selectedValue)
          : [...currentValues, selectedValue];
        setInternalValue(next);
        onChange?.(next);
        // 포커스를 트리거에 복귀 (aria-activedescendant 패턴)
        triggerRef.current?.focus();
      } else {
        // 기존 단일 선택 동작
        setInternalValue(selectedValue);
        setIsOpen(false);
        setHighlightedIndex(-1);
        triggerRef.current?.focus();
        onChange?.(selectedValue);
      }
    };

    // SelectOption → MenuItemBase 변환
    // 선택된 항목의 체크 아이콘은 Menu.Item에서 itemRole="option" + selected 시 자동 표시
    const menuItems: MenuItemBase[] = React.useMemo(
      () =>
        options.map((option): MenuItemBase => {
          if (multiSelect) {
            return {
              type: 'checkbox',
              id: option.value,
              label: option.label,
              selected: currentValues.includes(option.value),
              disabled: option.disabled ?? false,
              danger: option.danger,
            };
          }

          const base = {
            id: option.value,
            label: option.label,
            selected: currentValue === option.value,
            disabled: option.disabled ?? false,
            danger: option.danger,
          };

          switch (option.type) {
            case 'description':
              return { ...base, type: 'description', description: option.description };
            case 'profile':
              return { ...base, type: 'profile', avatarContent: option.avatarContent, description: option.description };
            case 'badge':
              return { ...base, type: 'badge', badgeContent: option.badgeContent };
            case 'icon-label-badge':
              return { ...base, type: 'icon-label-badge', leadingIcon: option.leadingIcon, badgeContent: option.badgeContent };
            default:
              // 기존 동작: leadingIcon 있으면 icon-label, 없으면 text-only
              if ('leadingIcon' in option && option.leadingIcon) {
                return { ...base, type: 'icon-label', leadingIcon: option.leadingIcon };
              }
              return { ...base, type: 'text-only' };
          }
        }),
      [options, currentValue, currentValues, multiSelect],
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

    // Menu 컴포넌트 인라인 스타일 (trigger 너비에 맞춤 + 가용 공간 max-height)
    const menuInlineStyle = React.useMemo<React.CSSProperties | undefined>(() => {
      if (menuWidth > 0) {
        const style: React.CSSProperties = { width: menuWidth, minWidth: 0 };
        if (menuMaxHeight !== undefined) {
          style.maxHeight = menuMaxHeight;
          style.overflow = 'auto';
        }
        return style;
      }
      return undefined;
    }, [menuWidth, menuMaxHeight]);

    // ID 생성
    const selectId = id || `select-${React.useId()}`;
    const labelId = (showLabel && label) ? `${selectId}-label` : undefined;
    const helperTextId = (showHelptext && helptext) ? `${selectId}-helper-text` : undefined;

    // 기본 endIcon (chevron-down)
    const defaultEndIcon = (
      <div className={cn('flex-shrink-0 transition-transform', chevronColor, !isDisabled && isOpen && 'rotate-180')}>
        <Icon name="chevron-down" size={chevronSize} />
      </div>
    );

    return (
      <div className={cn(selectContainerVariants({ mode }), className)} {...props}>
        {showLabel && (
          <label
            id={labelId}
            htmlFor={selectId}
            {...labelProps}
            className={cn(selectLabelVariants({ size, isDisabled }), labelProps?.className)}
            onMouseDown={() => { hadMouseDownRef.current = true; }}
            onClick={() => {
              if (!isDisabled) {
                (combinedRef as React.RefObject<HTMLDivElement>).current?.focus();
              }
            }}
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
            aria-activedescendant={
              isOpen && highlightedIndex >= 0 && focusableOptions[highlightedIndex]
                ? `${selectId}-option-${focusableOptions[highlightedIndex].value}`
                : undefined
            }
            aria-invalid={isError}
            aria-disabled={isDisabled}
            aria-required={required}
            tabIndex={isDisabled ? -1 : 0}
            {...selectProps}
            className={cn(
              selectVariants({ size, mode, interaction, isOpen: isActive }),
              'outline-none',
              isFocusVisible && 'outline outline-2 outline-focus outline-offset-[-2px]',
              !isDisabled && 'cursor-pointer',
              'select-none',
              selectProps?.className,
            )}
            onMouseDown={handleMouseDown}
            onClick={handleTriggerClick}
            onKeyDown={handleTriggerKeyDown}
            onFocus={(e) => {
              if (!isDisabled) {
                setIsFocused(true);
                if (hadMouseDownRef.current) {
                  // 마우스 클릭으로 포커스된 경우 focus-ring 숨김
                  setIsFocusVisible(false);
                } else {
                  try {
                    setIsFocusVisible(e.currentTarget.matches(':focus-visible'));
                  } catch {
                    // fallback for older browsers
                    setIsFocusVisible(true);
                  }
                }
                hadMouseDownRef.current = false;
              }
            }}
            onBlur={(e) => {
              setIsFocused(false);
              setIsFocusVisible(false);
              // blur 완료 후 비동기로 리셋하여 blur→재focus 시 mousedown 이벤트가 먼저 처리되도록 함
              requestAnimationFrame(() => { hadMouseDownRef.current = false; });

              // 포커스가 Menu(Portal) 내부로 이동한 경우 닫지 않음
              // (마우스 클릭 시 blur → click 순서이므로, handleItemClick이 처리)
              const relatedTarget = e.relatedTarget as Node | null;
              if (relatedTarget && menuWrapperRef.current?.contains(relatedTarget)) {
                return;
              }

              setIsOpen(false);
              setHighlightedIndex(-1);
            }}
          >
            {showStartIcon && (
              onStartIconClick ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartIconClick(e);
                  }}
                  disabled={isDisabled}
                  tabIndex={-1}
                  {...(startIconProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
                  className={cn(selectIconVariants({ size }), chevronColor, startIconProps?.className)}
                >
                  {startIcon}
                </button>
              ) : (
                <span
                  {...startIconProps}
                  className={cn(selectIconVariants({ size }), chevronColor, startIconProps?.className)}
                >
                  {startIcon}
                </span>
              )
            )}

            <TruncateWithTooltip text={displayLabel} className={cn('flex-1', selectTextColor)} />

            {endIcon ? (
              onEndIconClick ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEndIconClick(e);
                  }}
                  disabled={isDisabled}
                  tabIndex={-1}
                  {...(endIconProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
                  className={cn(selectIconVariants({ size }), chevronColor, endIconProps?.className)}
                >
                  {endIcon}
                </button>
              ) : (
                <span
                  {...endIconProps}
                  className={cn(selectIconVariants({ size }), chevronColor, endIconProps?.className)}
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
              <div ref={menuWrapperRef} style={menuWrapperStyle}>
                <Menu
                  id={`${selectId}-menu`}
                  items={menuItems}
                  size={size}
                  className="max-w-none"
                  style={menuInlineStyle}
                  listRole="listbox"
                  itemRole="option"
                  autoFocusMenu={false}
                  highlightedIndex={highlightedIndex}
                  onHighlightedIndexChange={setHighlightedIndex}
                  itemIdPrefix={`${selectId}-option`}
                  onItemClick={(item) => handleItemClick(item.id)}
                  onClose={() => {
                    if (skipCloseRef.current) {
                      skipCloseRef.current = false;
                      return;
                    }
                    setIsOpen(false);
                    setHighlightedIndex(-1);
                    triggerRef.current?.focus();
                  }}
                  triggerRef={triggerRef}
                />
              </div>,
              document.body,
            )}
        </div>

        {showHelptext && (
          <span
            id={helperTextId}
            {...helperTextProps}
            className={cn(selectHelperTextVariants({ size, hasError: isError, isDisabled }), helperTextProps?.className)}
          >
            {helptext}
          </span>
        )}
      </div>
    );
  },
);
Select.displayName = 'Select';

export { Select, selectVariants };
