import { HugeiconsIcon } from '@hugeicons/react';
import {
  CodeIcon,
  ArrowDown01Icon,
  Copy01Icon,
  Tick01Icon,
} from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Markdown } from '@/components/ui/markdown';
import { useState } from 'react';

function ChatMessage({
  text,
  timestamp,
  isGenerating,
  hasContent,
  content,
  isSelected,
  onClick,
  className,
}: {
  text: string;
  timestamp: number;
  isGenerating?: boolean;
  /** content(코드)가 있는지 여부 */
  hasContent?: boolean;
  /** 코드 내용 */
  content?: string;
  /** 현재 선택된 메시지인지 여부 */
  isSelected?: boolean;
  /** 클릭 핸들러 (content가 있는 메시지만 클릭 가능) */
  onClick?: () => void;
  className?: string;
}) {
  const [isCodeOpen, setIsCodeOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
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
          isSelected && 'border border-amber-200'
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
          {hasContent && !content && (
            <span className="flex items-center gap-0.5 text-xs text-primary opacity-80">
              <HugeiconsIcon
                icon={CodeIcon}
                className="size-3"
                strokeWidth={2}
              />
              코드
            </span>
          )}
        </div>
        {hasContent && content && (
          <Collapsible open={isCodeOpen} onOpenChange={setIsCodeOpen}>
            <CollapsibleTrigger
              className="mt-1 flex items-center gap-0.5 text-xs text-primary opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              <HugeiconsIcon
                icon={CodeIcon}
                className="size-3"
                strokeWidth={2}
              />
              코드
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                className={cn(
                  'size-3 transition-transform duration-200',
                  isCodeOpen && 'rotate-180'
                )}
                strokeWidth={2}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy();
                  }}
                  className="absolute right-2 top-2 z-10 rounded-md bg-muted/80 p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="코드 복사"
                >
                  <HugeiconsIcon
                    icon={isCopied ? Tick01Icon : Copy01Icon}
                    className="size-4"
                    strokeWidth={2}
                  />
                </button>
                <div className="max-h-[50dvh] overflow-auto">
                  <Markdown>{`\`\`\`tsx\n${content}\n\`\`\``}</Markdown>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

export { ChatMessage };
