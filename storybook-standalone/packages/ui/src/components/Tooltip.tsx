import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { cn } from './utils';
import { useSpacingMode } from './SpacingModeProvider';

const tooltipVariants = cva('flex justify-center items-center rounded-md border border-border-default bg-bg-surface shadow-md text-text-primary text-caption-xs-regular word-break-keep-all', ({
    variants: {
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
        "class": "max-w-[320px] line-clamp-2",
        "truncation": false,
      },
      {
        "class": "max-w-[500px] max-h-[320px] overflow-y-auto break-all",
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

    // 위치 계산 함수
    const calculatePosition = React.useCallback(() => {
      if (!triggerRef.current || !tooltipRef.current) return;

      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      // followCursor 모드: 마우스 커서 위치 기반
      if (followCursor) {
        let calculatedCoords = {
          top: cursorPos.y + cursorOffset.y,
          left: cursorPos.x + cursorOffset.x,
        };

        // 화면 경계 체크 및 조정
        if (calculatedCoords.left + tooltipRect.width > window.innerWidth) {
          calculatedCoords.left = cursorPos.x - tooltipRect.width - cursorOffset.x;
        }
        if (calculatedCoords.top + tooltipRect.height > window.innerHeight) {
          calculatedCoords.top = cursorPos.y - tooltipRect.height - cursorOffset.y;
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

      let calculatedCoords = { top: 0, left: 0 };
      let finalPosition: Position = preferredPosition;

      for (const pos of positions) {
        let newCoords = { top: 0, left: 0 };

        switch (pos) {
          case 'top':
            newCoords = {
              top: triggerRect.top - tooltipRect.height - gap,
              left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
            };
            break;
          case 'bottom':
            newCoords = {
              top: triggerRect.bottom + gap,
              left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
            };
            break;
          case 'left':
            newCoords = {
              top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2,
              left: triggerRect.left - tooltipRect.width - gap,
            };
            break;
          case 'right':
            newCoords = {
              top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2,
              left: triggerRect.right + gap,
            };
            break;
        }

        // 화면 경계 체크
        const isInViewport =
          newCoords.top >= 0 &&
          newCoords.left >= 0 &&
          newCoords.top + tooltipRect.height <= window.innerHeight &&
          newCoords.left + tooltipRect.width <= window.innerWidth;

        if (isInViewport) {
          calculatedCoords = newCoords;
          finalPosition = pos;
          break;
        }
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
              className={cn(tooltipVariants({ mode, truncation, className }))}
              style={tooltipStyle}
              role="tooltip"
              onMouseEnter={preventClose}
              onMouseLeave={handleMouseLeave}
              {...props}
            >
              {content}
            </div>,
            document.body,
          )}
      </>
    );
  },
);

Tooltip.displayName = 'Tooltip';

export { Tooltip };
