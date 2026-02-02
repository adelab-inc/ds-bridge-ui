import { HugeiconsIcon } from '@hugeicons/react';
import { CodeIcon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

function ChatMessage({
  text,
  timestamp,
  isGenerating,
  hasContent,
  isSelected,
  onClick,
  className,
}: {
  text: string;
  timestamp: number;
  isGenerating?: boolean;
  /** content(코드)가 있는지 여부 */
  hasContent?: boolean;
  /** 현재 선택된 메시지인지 여부 */
  isSelected?: boolean;
  /** 클릭 핸들러 (content가 있는 메시지만 클릭 가능) */
  onClick?: () => void;
  className?: string;
}) {
  // 텍스트가 없고 생성 중이 아니면 렌더링하지 않음
  if (!text && !isGenerating) {
    return null;
  }

  const isClickable = hasContent && onClick;

  return (
    <div
      data-slot="chat-message"
      className={cn('flex w-full', className)}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm transition-colors',
          isClickable && 'cursor-pointer hover:bg-muted/50',
          isSelected && 'ring-2 ring-primary ring-offset-1'
        )}
      >
        <p className="whitespace-pre-wrap">{text}</p>
        <div className="mt-1 flex items-center gap-2">
          {timestamp > 0 && (
            <time className={cn('block text-xs opacity-60')}>
              {new Date(timestamp).toLocaleString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          )}
          {hasContent && (
            <span className="flex items-center gap-0.5 text-xs text-primary opacity-80">
              <HugeiconsIcon icon={CodeIcon} className="size-3" strokeWidth={2} />
              코드
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export { ChatMessage };
