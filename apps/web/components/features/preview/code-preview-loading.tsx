'use client';

import * as React from 'react';
import Lottie from 'lottie-react';
import { HugeiconsIcon } from '@hugeicons/react';
import { SparklesIcon } from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import spinnerAnimation from '@/assets/lottie/spinner.json';

interface CodePreviewLoadingProps extends React.ComponentProps<'div'> {
  /** 로딩 메시지 */
  message?: string;
  /** 서브 메시지 */
  subMessage?: string;
}

/**
 * AI 코드 생성 중 로딩 인디케이터
 * Lottie 애니메이션 기반의 모던한 로딩 UI
 */
function CodePreviewLoading({
  message = 'AI가 코드를 생성하고 있습니다',
  subMessage = '잠시만 기다려주세요...',
  className,
  ...props
}: CodePreviewLoadingProps) {
  return (
    <div
      data-slot="code-preview-loading"
      className={cn(
        'flex h-full flex-1 flex-col items-center justify-center gap-6 bg-gradient-to-b from-muted/50 to-background p-8',
        className
      )}
      {...props}
    >
      {/* Lottie 애니메이션 */}
      <div className="relative">
        <Lottie
          animationData={spinnerAnimation}
          loop
          autoplay
          style={{ width: 80, height: 80 }}
        />
        {/* Sparkle 아이콘 오버레이 */}
        <div className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-primary/10">
          <HugeiconsIcon
            icon={SparklesIcon}
            className="size-3.5 text-primary"
            strokeWidth={2}
          />
        </div>
      </div>

      {/* 로딩 텍스트 */}
      <div className="space-y-1 text-center">
        <p className="font-medium text-foreground">{message}</p>
        <p className="text-sm text-muted-foreground">{subMessage}</p>
      </div>

      {/* 진행 표시 dots */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="size-2 animate-pulse rounded-full bg-primary/60"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export { CodePreviewLoading };
export type { CodePreviewLoadingProps };
