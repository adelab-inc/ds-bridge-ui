import * as React from 'react';

import { Tooltip } from '../components/Tooltip';
import { cn } from '../components/utils';

/**
 * 텍스트가 잘릴 때만 Tooltip을 표시하는 컴포넌트 (단일 라인)
 */
export interface TruncateWithTooltipProps {
  text: string;
  className?: string;
}

export const TruncateWithTooltip = ({ text, className }: TruncateWithTooltipProps) => {
  const [isTruncated, setIsTruncated] = React.useState(false);
  const textRef = React.useRef<HTMLSpanElement>(null);

  const checkTruncation = React.useCallback(() => {
    if (textRef.current) {
      setIsTruncated(textRef.current.scrollWidth > textRef.current.clientWidth);
    }
  }, []);

  React.useEffect(() => {
    // 레이아웃 완료 후 체크 (requestAnimationFrame 2번 호출로 paint 이후 체크)
    let rafId: number;
    const checkAfterLayout = () => {
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(() => {
          checkTruncation();
        });
      });
    };

    checkAfterLayout();
    window.addEventListener('resize', checkTruncation);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', checkTruncation);
    };
  }, [checkTruncation, text]);

  const textElement = (
    <span ref={textRef} className={cn('truncate', className)}>
      {text}
    </span>
  );

  if (isTruncated) {
    return <Tooltip content={text}>{textElement}</Tooltip>;
  }

  return textElement;
};

/**
 * 다중 라인 텍스트가 잘릴 때 Tooltip을 표시하는 컴포넌트 (line-clamp용)
 */
export interface MultiLineTruncateWithTooltipProps {
  text: string;
  className?: string;
}

export const MultiLineTruncateWithTooltip = ({ text, className }: MultiLineTruncateWithTooltipProps) => {
  const [isTruncated, setIsTruncated] = React.useState(false);
  const textRef = React.useRef<HTMLSpanElement>(null);

  const checkTruncation = React.useCallback(() => {
    if (textRef.current) {
      // line-clamp 적용 시 scrollHeight와 clientHeight 비교
      const el = textRef.current;
      // 1px 여유를 두어 부동소수점 오차 방지
      setIsTruncated(el.scrollHeight > el.clientHeight + 1);
    }
  }, []);

  React.useEffect(() => {
    // 레이아웃 완료 후 체크 (requestAnimationFrame 2번 호출로 paint 이후 체크)
    let rafId: number;
    const checkAfterLayout = () => {
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(() => {
          checkTruncation();
        });
      });
    };

    checkAfterLayout();
    window.addEventListener('resize', checkTruncation);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', checkTruncation);
    };
  }, [checkTruncation, text]);

  const textElement = (
    <span ref={textRef} className={className}>
      {text}
    </span>
  );

  if (isTruncated) {
    return <Tooltip content={text}>{textElement}</Tooltip>;
  }

  return textElement;
};
