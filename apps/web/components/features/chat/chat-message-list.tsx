'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './chat-message';
import { ChatMessage as ChatMessageType } from '@/hooks/firebase/messageUtils';

interface ChatMessageListProps extends React.ComponentProps<'div'> {
  messages?: ChatMessageType[];
  /** 현재 선택된 메시지 ID */
  selectedMessageId?: string;
  /** 북마크된 메시지 ID 목록 */
  bookmarkedMessageIds?: Set<string>;
  /** 메시지 클릭 핸들러 (content가 있는 메시지만 호출됨) */
  onMessageClick?: (message: ChatMessageType) => void;
  /** 북마크 아이콘 클릭 핸들러 */
  onBookmarkClick?: (message: ChatMessageType) => void;
}

function ChatMessageList({
  messages = [],
  selectedMessageId,
  bookmarkedMessageIds,
  onMessageClick,
  onBookmarkClick,
  className,
  ...props
}: ChatMessageListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div
        data-slot="chat-message-list"
        className={cn(
          'text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-sm',
          className
        )}
        {...props}
      >
        <p>아직 메시지가 없습니다</p>
        <p className="text-xs">Storybook URL을 입력하고 채팅을 시작해보세요</p>
      </div>
    );
  }

  return (
    <ScrollArea
      ref={scrollRef}
      data-slot="chat-message-list"
      className={cn('flex-1 px-1', className)}
      {...props}
    >
      {messages.map((message) => {
        const hasContent = !!(message.content && message.content.trim());
        return (
          <div key={message.id} className="flex flex-col gap-2">
            <ChatMessage
              text={message.question}
              timestamp={message.question_created_at}
              className="justify-end"
            />
            <ChatMessage
              text={message.text}
              timestamp={message.answer_created_at}
              isGenerating={message.status === 'GENERATING'}
              content={message.content}
              hasContent={hasContent}
              isSelected={selectedMessageId === message.id}
              isBookmarked={bookmarkedMessageIds?.has(message.id)}
              onClick={hasContent ? () => onMessageClick?.(message) : undefined}
              onBookmarkClick={
                hasContent ? () => onBookmarkClick?.(message) : undefined
              }
            />
          </div>
        );
      })}
    </ScrollArea>
  );
}

export { ChatMessageList };
export type { ChatMessageListProps };
