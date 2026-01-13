import { cn } from '@/lib/utils';

function ChatMessage({
  text,
  timestamp,
  isGenerating,
  className,
}: {
  text: string;
  timestamp: number;
  isGenerating?: boolean;
  className?: string;
}) {
  // 텍스트가 없고 생성 중이 아니면 렌더링하지 않음
  if (!text && !isGenerating) {
    return null;
  }

  return (
    <div data-slot="chat-message" className={cn('flex w-full', className)}>
      <div className={cn('max-w-[85%] rounded-lg px-3 py-2 text-sm')}>
        <p className="whitespace-pre-wrap">{text}</p>
        {timestamp > 0 && (
          <time className={cn('mt-1 block text-xs opacity-60')}>
            {new Date(timestamp).toLocaleString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        )}
      </div>
    </div>
  );
}

export { ChatMessage };
