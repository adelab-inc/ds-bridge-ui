import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Icon } from './Icon';
import { cn } from './utils';

const actionBarVariants = cva('flex items-center whitespace-nowrap bg-bg-inverse rounded-full shadow-[0_4px_8px_0_rgba(0,0,0,0.20)]', ({
    variants: {
      "position": {
        "absolute": "",
        "fixed": "",
      },
    },
    defaultVariants: {
      "position": "fixed",
    },
    compoundVariants: [
      {
        "class": "px-component-inset-action-bar-x py-component-inset-action-bar-y gap-layout-inline-lg2",
        "position": "fixed",
      },
      {
        "class": "px-component-inset-action-bar-x py-component-inset-action-bar-y gap-layout-inline-lg2",
        "position": "absolute",
      },
    ],
  }));

export type ActionBarPosition = 'fixed' | 'absolute';

export interface ActionBarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>,
    VariantProps<typeof actionBarVariants> {
  /** 선택된 항목 수 (필수) */
  count: number;
  /** 표시/숨김 + 애니메이션 */
  visible?: boolean;
  /** X 버튼 클릭 콜백 */
  onClose?: () => void;
  /** i18n용 라벨 커스텀 (기본: '개 선택됨') */
  selectionLabel?: string;
  /** 액션 버튼들 (소비자가 Button ghost-inverse 직접 전달) */
  children: React.ReactNode;
}

const positionClasses: Record<ActionBarPosition, string> = {
  fixed: 'fixed bottom-8 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-32px)]',
  absolute: 'absolute bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100%-32px)]',
};

/** 컨테이너 너비에 맞게 표시 가능한 children 수를 계산하는 훅 */
function useVisibleCount(
  toolbarRef: React.RefObject<HTMLDivElement | null>,
  buttonWrapperRef: React.RefObject<HTMLDivElement | null>,
  childCount: number,
  containerGap: number,
  buttonGap: number,
): number {
  const [visibleCount, setVisibleCount] = React.useState(childCount);

  React.useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    const buttonWrapper = buttonWrapperRef.current;
    if (!toolbar || !buttonWrapper || childCount === 0) return;

    const calculate = () => {
      const toolbarWidth = toolbar.clientWidth;
      // jsdom/SSR 환경에서는 측정 불가 → 전체 표시
      if (toolbarWidth === 0) {
        setVisibleCount(childCount);
        return;
      }
      const toolbarChildren = toolbar.children;

      // 고정 영역: 닫기 버튼 + 카운트 + 구분선 (앞 3개 요소)
      const fixedCount = 3;
      let fixedWidth = 0;
      for (let i = 0; i < fixedCount && i < toolbarChildren.length; i++) {
        fixedWidth += (toolbarChildren[i] as HTMLElement).offsetWidth;
      }
      // 고정 영역 gap (fixedCount개 요소 사이 + 버튼 wrapper 앞 gap)
      fixedWidth += (fixedCount + 1) * containerGap;

      const availableWidth = toolbarWidth - fixedWidth;
      const buttons = buttonWrapper.children;
      let usedWidth = 0;
      let count = 0;

      for (let i = 0; i < buttons.length; i++) {
        const childWidth = (buttons[i] as HTMLElement).offsetWidth;
        const nextWidth = usedWidth + childWidth + (count > 0 ? buttonGap : 0);
        if (nextWidth > availableWidth) break;
        usedWidth = nextWidth;
        count++;
      }

      setVisibleCount(count);
    };

    calculate();

    const ro = new ResizeObserver(calculate);
    ro.observe(toolbar);
    return () => ro.disconnect();
  }, [toolbarRef, buttonWrapperRef, childCount, containerGap, buttonGap]);

  return visibleCount;
}

const ActionBar = React.forwardRef<HTMLDivElement, ActionBarProps>(
  (
    {
      className,
      position = 'fixed',
      count,
      visible = true,
      onClose,
      selectionLabel = '개 선택됨',
      children,
      ...props
    },
    ref,
  ) => {
    const [shouldRender, setShouldRender] = React.useState(visible);
    const [isExiting, setIsExiting] = React.useState(false);
    const internalRef = React.useRef<HTMLDivElement>(null);
    const buttonWrapperRef = React.useRef<HTMLDivElement>(null);

    // 외부 ref와 내부 ref 병합
    const setRefs = React.useCallback(
      (el: HTMLDivElement | null) => {
        (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        if (typeof ref === 'function') {
          ref(el);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }
      },
      [ref],
    );

    React.useEffect(() => {
      if (visible) {
        setShouldRender(true);
        setIsExiting(false);
      } else if (shouldRender) {
        setIsExiting(true);
      }
    }, [visible, shouldRender]);

    const handleAnimationEnd = React.useCallback(() => {
      if (!visible) {
        setShouldRender(false);
        setIsExiting(false);
      }
    }, [visible]);

    const childArray = React.Children.toArray(children);
    const CONTAINER_GAP = 16; // layout-inline-lg2 토큰 값
    const BUTTON_GAP = 8; // component-gap-control-group 토큰 값
    const visibleCount = useVisibleCount(internalRef, buttonWrapperRef, childArray.length, CONTAINER_GAP, BUTTON_GAP);

    if (!shouldRender) return null;

    const pos = position ?? 'fixed';

    return (
      <div
        ref={setRefs}
        role="toolbar"
        aria-label={`${count}${selectionLabel}`}
        className={cn(
          actionBarVariants({ position: pos }),
          positionClasses[pos],
          '[&>*]:flex-shrink-0',
          visible && !isExiting && 'animate-action-bar-enter',
          isExiting && 'animate-action-bar-exit',
          className,
        )}
        onAnimationEnd={handleAnimationEnd}
        {...props}
      >
        {/* 닫기 버튼 (항상 표시) — Dialog 패턴: p-2.5 -m-2.5 로 10px 히트영역 확보 */}
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 p-2.5 -m-2.5 flex items-center justify-center rounded-full hover:bg-state-overlay-on-inverse-hover active:bg-state-overlay-on-inverse-pressed"
          aria-label="선택 해제"
        >
          <Icon name="close" size={24} className="text-icon-interactive-inverse" />
        </button>

        {/* 선택 카운트 */}
        <span className="text-body-md-medium text-text-inverse whitespace-nowrap">
          {count}{selectionLabel}
        </span>

        {/* 구분선 */}
        <div className="w-px h-4 bg-border-inverse flex-shrink-0" />

        {/* 액션 버튼 영역 — 버튼 그룹은 control-group gap(8px) 적용 */}
        <div ref={buttonWrapperRef} className="flex items-center gap-component-gap-control-group">
          {childArray.slice(0, visibleCount)}
        </div>
      </div>
    );
  },
);
ActionBar.displayName = 'ActionBar';

export { ActionBar, actionBarVariants };
