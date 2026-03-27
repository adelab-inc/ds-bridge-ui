import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';

const tooltipVariants = cva('rounded-md bg-bg-surface text-text-primary word-break-keep-all', ({
    variants: {
      "context": {
        "contrast": "border border-border-default shadow-lg",
        "default": "border border-border-subtle shadow-md",
      },
      "mode": {
        "base": "",
        "compact": "",
      },
      "truncation": {
        "false": "",
        "true": "",
      },
    },
    defaultVariants: {
      "context": "default",
      "mode": "base",
      "truncation": false,
    },
    compoundVariants: [
      {
        "class": "py-component-inset-tooltip-y px-component-inset-tooltip-x",
        "mode": "base",
      },
      {
        "class": "py-component-inset-tooltip-y-compact px-component-inset-tooltip-x-compact",
        "mode": "compact",
      },
      {
        "class": "max-w-[320px] max-h-[96px] overflow-hidden text-caption-xs-regular",
        "truncation": false,
      },
      {
        "class": "max-w-[500px] max-h-[256px] overflow-y-auto break-all text-body-sm-regular",
        "truncation": true,
      },
    ],
  }));

type Position = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'content'>,
    VariantProps<typeof tooltipVariants> {
  /** 툴팁에 표시될 내용 */
  content: React.ReactNode;
  /** 툴팁을 트리거할 요소 (children) */
  children: React.ReactElement;
  /** 툴팁 표시 지연 시간 (ms) */
  delay?: number;
  /** 툴팁이 닫히는 지연 시간 (ms) */
  closeDelay?: number;
  /** 초기 위치 우선순위 */
  preferredPosition?: Position;
  /** 마우스 커서를 따라다니는 툴팁 활성화 */
  followCursor?: boolean;
  /** 커서와 툴팁 사이 오프셋 (followCursor가 true일 때만 적용) */
  cursorOffset?: { x: number; y: number };
}

const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  (
    {
      className,
      content,
      children,
      context,
      truncation,
      delay = 300,
      closeDelay = 100,
      preferredPosition = 'top',
      followCursor = false,
      cursorOffset = { x: 10, y: 10 },
      mode: propMode,
      ...props
    },
    _ref,
  ) => {
    const contextMode = useSpacingMode();
    const mode = propMode ?? contextMode;

    const [isVisible, setIsVisible] = React.useState(false);
    const [isMounted, setIsMounted] = React.useState(false);
    const [isAnimating, setIsAnimating] = React.useState(false);
    const [_position, setPosition] = React.useState<Position>(preferredPosition);
    const [coords, setCoords] = React.useState({ top: 0, left: 0 });
    const [cursorPos, setCursorPos] = React.useState({ x: 0, y: 0 });

    const triggerRef = React.useRef<HTMLElement>(null);
    const tooltipRef = React.useRef<HTMLDivElement>(null);
    const timeoutRef = React.useRef<NodeJS.Timeout>();
    const closeTimeoutRef = React.useRef<NodeJS.Timeout>();
    const animationTimeoutRef = React.useRef<NodeJS.Timeout>();
    const tooltipId = React.useId();
    // CSS class에서 정의된 원본 max-height를 캐싱 (최초 1회)
    const cssMaxHeightRef = React.useRef<number | null>(null);

    // 위치 계산 함수
    const calculatePosition = React.useCallback(() => {
      if (!triggerRef.current || !tooltipRef.current) return;

      const tooltipEl = tooltipRef.current;
      const tooltipWidth = tooltipEl.getBoundingClientRect().width;

      // CSS class의 원본 max-height를 최초 1회 캐싱 (inline style 적용 전)
      if (cssMaxHeightRef.current === null) {
        const computed = window.getComputedStyle(tooltipEl);
        const parsed = parseFloat(computed.maxHeight);
        cssMaxHeightRef.current = isNaN(parsed) ? Infinity : parsed;
      }

      // 참조 높이: scrollHeight(전체 콘텐츠)를 CSS max-height로 제한
      // inline style을 건드리지 않으므로 스크롤 위치가 보존됨
      const referenceHeight = Math.min(tooltipEl.scrollHeight, cssMaxHeightRef.current);

      // followCursor 모드: 마우스 커서 위치 기반
      if (followCursor) {
        let calculatedCoords = {
          top: cursorPos.y + cursorOffset.y,
          left: cursorPos.x + cursorOffset.x,
        };

        // 화면 경계 체크 및 조정
        if (calculatedCoords.left + tooltipWidth > window.innerWidth) {
          calculatedCoords.left = cursorPos.x - tooltipWidth - cursorOffset.x;
        }
        if (calculatedCoords.top + referenceHeight > window.innerHeight) {
          calculatedCoords.top = cursorPos.y - referenceHeight - cursorOffset.y;
        }
        if (calculatedCoords.left < 0) {
          calculatedCoords.left = 0;
        }
        if (calculatedCoords.top < 0) {
          calculatedCoords.top = 0;
        }

        setCoords(calculatedCoords);
        return;
      }

      // 기본 모드: 트리거 요소 기반 위치 계산
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const gap = 4; // 트리거와 툴팁 사이 간격

      const positions: Position[] = [preferredPosition, 'bottom', 'right', 'left', 'top'].filter(
        (p, i, arr) => arr.indexOf(p) === i,
      ) as Position[];

      const getCoords = (pos: Position) => {
        switch (pos) {
          case 'top':
            return {
              top: triggerRect.top - referenceHeight - gap,
              left: triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2,
            };
          case 'bottom':
            return {
              top: triggerRect.bottom + gap,
              left: triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2,
            };
          case 'left':
            return {
              top: triggerRect.top + triggerRect.height / 2 - referenceHeight / 2,
              left: triggerRect.left - tooltipWidth - gap,
            };
          case 'right':
            return {
              top: triggerRect.top + triggerRect.height / 2 - referenceHeight / 2,
              left: triggerRect.right + gap,
            };
        }
      };

      const isInViewport = (coords: { top: number; left: number }) =>
        coords.top >= 0 &&
        coords.left >= 0 &&
        coords.top + referenceHeight <= window.innerHeight &&
        coords.left + tooltipWidth <= window.innerWidth;

      // 1차: 완전히 viewport 안에 들어가는 위치 찾기
      let calculatedCoords = getCoords(positions[0]);
      let finalPosition: Position = positions[0];

      for (const pos of positions) {
        const coords = getCoords(pos);
        if (isInViewport(coords)) {
          calculatedCoords = coords;
          finalPosition = pos;
          break;
        }
      }

      // 2차: 어떤 방향에도 완전히 안 맞으면, 가용 공간이 가장 큰 방향 선택 후 높이 조정
      if (!isInViewport(calculatedCoords)) {
        const spaceTop = triggerRect.top - gap;
        const spaceBottom = window.innerHeight - triggerRect.bottom - gap;
        const bestVertical: Position = spaceBottom >= spaceTop ? 'bottom' : 'top';
        const availableSpace = Math.max(spaceTop, spaceBottom);

        finalPosition = bestVertical;
        calculatedCoords = getCoords(bestVertical);
        calculatedCoords.left = Math.max(0, Math.min(calculatedCoords.left, window.innerWidth - tooltipWidth));

        // 가용 공간이 참조 높이보다 작으면 max-height를 축소하여 viewport 안에 수용
        if (availableSpace < referenceHeight) {
          tooltipEl.style.maxHeight = `${availableSpace}px`;
        }
      } else {
        // viewport에 맞으면 동적 제한 해제 (CSS class max-height로 복원)
        tooltipEl.style.maxHeight = '';
      }

      setCoords(calculatedCoords);
      setPosition(finalPosition);
    }, [preferredPosition, followCursor, cursorPos, cursorOffset]);

    const handleMouseEnter = () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delay);
    };

    const handleMouseLeave = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      closeTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, closeDelay);
    };

    // followCursor 모드일 때 마우스 위치 추적
    const handleMouseMove = React.useCallback((e: MouseEvent) => {
      if (followCursor) {
        setCursorPos({ x: e.clientX, y: e.clientY });
      }
    }, [followCursor]);

    // 애니메이션 상태 관리
    React.useEffect(() => {
      if (isVisible) {
        // Fade in: 먼저 마운트, 다음 프레임에 애니메이션 시작
        setIsMounted(true);
        animationTimeoutRef.current = setTimeout(() => {
          setIsAnimating(true);
        }, 10); // 다음 프레임 대기 (브라우저가 초기 상태를 렌더링하도록)
      } else {
        // Fade out: 먼저 애니메이션 종료, transition 완료 후 언마운트
        setIsAnimating(false);
        animationTimeoutRef.current = setTimeout(() => {
          setIsMounted(false);
        }, 150); // CSS transition 시간과 동일
      }

      return () => {
        if (animationTimeoutRef.current) {
          clearTimeout(animationTimeoutRef.current);
        }
      };
    }, [isVisible]);

    React.useEffect(() => {
      if (isMounted) {
        // Portal이 DOM에 완전히 마운트될 때까지 기다림
        const frame = requestAnimationFrame(() => {
          calculatePosition();
        });

        window.addEventListener('scroll', calculatePosition);
        window.addEventListener('resize', calculatePosition);

        // followCursor 모드일 때 mousemove 이벤트 리스너 추가
        if (followCursor) {
          window.addEventListener('mousemove', handleMouseMove as EventListener);
        }

        return () => {
          cancelAnimationFrame(frame);
          window.removeEventListener('scroll', calculatePosition);
          window.removeEventListener('resize', calculatePosition);
          if (followCursor) {
            window.removeEventListener('mousemove', handleMouseMove as EventListener);
          }
        };
      }
    }, [isMounted, calculatePosition, followCursor, handleMouseMove]);

    // followCursor 모드에서 커서 위치 변경 시 tooltip 위치 업데이트
    React.useEffect(() => {
      if (followCursor && isMounted) {
        calculatePosition();
      }
    }, [cursorPos, followCursor, isMounted, calculatePosition]);

    // Cleanup on unmount
    React.useEffect(() => {
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
      };
    }, []);

    // Escape 키로 툴팁 닫기 (접근성)
    React.useEffect(() => {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && isVisible) {
          setIsVisible(false);
        }
      };

      if (isVisible) {
        document.addEventListener('keydown', handleEscape);
      }

      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }, [isVisible]);

    const clonedChildren = React.cloneElement(children, {
      ref: triggerRef,
      'aria-describedby': isVisible ? tooltipId : undefined,
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
        if (followCursor) {
          setCursorPos({ x: e.clientX, y: e.clientY });
        }
        handleMouseEnter();
        children.props.onMouseEnter?.(e);
      },
      onMouseMove: followCursor ? (e: React.MouseEvent<HTMLElement>) => {
        setCursorPos({ x: e.clientX, y: e.clientY });
        children.props.onMouseMove?.(e);
      } : children.props.onMouseMove,
      onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
        handleMouseLeave();
        children.props.onMouseLeave?.(e);
      },
      onFocus: (e: React.FocusEvent<HTMLElement>) => {
        setIsVisible(true);
        children.props.onFocus?.(e);
      },
      onBlur: (e: React.FocusEvent<HTMLElement>) => {
        setIsVisible(false);
        children.props.onBlur?.(e);
      },
    });

    const tooltipStyle: React.CSSProperties = {
      position: 'fixed',
      top: `${coords.top}px`,
      left: `${coords.left}px`,
      zIndex: 9999,
      opacity: isAnimating ? 1 : 0,
      transition: 'opacity 150ms ease-in-out',
      pointerEvents: isAnimating ? 'auto' : 'none',
    };

    const preventClose = () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };

    return (
      <>
        {clonedChildren}
        {isMounted &&
          ReactDOM.createPortal(
            <div
              id={tooltipId}
              ref={tooltipRef}
              className={cn(tooltipVariants({ context, mode, truncation, className }))}
              style={tooltipStyle}
              role="tooltip"
              onMouseEnter={preventClose}
              onMouseLeave={handleMouseLeave}
              {...props}
            >
              {truncation ? content : <div className="line-clamp-5">{content}</div>}
            </div>,
            document.body,
          )}
      </>
    );
  },
);

Tooltip.displayName = 'Tooltip';

export { Tooltip, tooltipVariants };
