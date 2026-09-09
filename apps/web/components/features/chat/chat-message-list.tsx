'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChatMessage } from './chat-message';
import { useChatScroll } from './hooks/use-chat-scroll';
import type { ChatMessage as ChatMessageType } from '@packages/shared-types/typescript/database/types';
import type { StreamingDelayState } from '@/stores/useStreamingStore';

interface ChatMessageListProps extends React.ComponentProps<'div'> {
  messages?: ChatMessageType[];
  /** 더 오래된 메시지 페이지가 남아 있는지 (무한 스크롤) */
  hasMore?: boolean;
  /** 이전 페이지 로드가 진행 중인지 */
  isLoadingMore?: boolean;
  /** 최상단 도달 시 더 오래된 메시지를 불러오는 콜백 */
  onLoadMore?: () => void;
  /** 룸 총 메시지 수 — 더 불러올 메시지가 있을 때 "표시 / 전체" 카운터로 노출 */
  totalCount?: number;
  /** 현재 선택된 메시지 ID */
  selectedMessageId?: string;
  /** 북마크된 메시지 ID 목록 */
  bookmarkedMessageIds?: Set<string>;
  /** 현재 스트리밍 중인 메시지 ID — 지연 배너 표시 대상 식별 */
  streamingMessageId?: string;
  /** 스트리밍 메시지의 지연 상태 */
  streamingDelayState?: StreamingDelayState;
  /** 메시지 클릭 핸들러 (content가 있는 메시지만 호출됨) */
  onMessageClick?: (message: ChatMessageType) => void;
  /** 북마크 아이콘 클릭 핸들러 */
  onBookmarkClick?: (message: ChatMessageType) => void;
  /** 삭제 아이콘 클릭 핸들러 */
  onDeleteClick?: (message: ChatMessageType) => void;
}

function ChatMessageList({
  messages = [],
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  totalCount,
  selectedMessageId,
  bookmarkedMessageIds,
  streamingMessageId,
  streamingDelayState,
  onMessageClick,
  onBookmarkClick,
  onDeleteClick,
  className,
  ...props
}: ChatMessageListProps) {
  // 하단 자동 추적 + 상단 무한 스크롤 + 스크롤 위치 보존을 한 곳에서 관리
  const { viewportRef, topSentinelRef, bottomRef, loadMore } = useChatScroll({
    messages,
    hasMore,
    isLoadingMore,
    onLoadMore: onLoadMore ?? (() => {}),
  });

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
      data-slot="chat-message-list"
      viewportRef={viewportRef}
      // 브라우저 기본 scroll anchoring을 끈다 — 이전 페이지 prepend 시 useChatScroll이
      // scrollTop을 직접 보정하므로, 둘 다 적용되면 보정이 두 번 들어가 하단으로 튄다.
      viewportClassName="[overflow-anchor:none]"
      className={cn('flex-1 px-1', className)}
      {...props}
    >
      {/* 최상단 sentinel: 보이면 더 오래된 메시지 로드 트리거 */}
      <div ref={topSentinelRef} aria-hidden />
      {/* 더 불러올 메시지가 있을 때만: 수동 "더 보기" 버튼(옵저버 미발동 대비) + 표시/전체 카운터.
          전부 로드되면 숨김 — 스트리밍 낙관 메시지로 표시 수가 전체 수를 잠시 넘어도 노출되지 않는다.
          min-h로 버튼 ↔ 로딩 문구 전환 시 높이를 고정해 anchoring 보정값이 흔들리지 않게 한다. */}
      {(hasMore || isLoadingMore) && (
        <div
          data-slot="chat-load-more"
          className="text-muted-foreground flex min-h-8 items-center justify-center gap-2 py-1 text-xs"
        >
          {isLoadingMore ? (
            <span>이전 메시지 불러오는 중…</span>
          ) : (
            <Button type="button" variant="ghost" size="xs" onClick={loadMore}>
              이전 메시지 더 보기
            </Button>
          )}
          {typeof totalCount === 'number' && (
            <span
              title={`총 ${Math.max(totalCount, messages.length)}건 중 ${Math.min(messages.length, totalCount)}건 표시`}
            >
              {Math.min(messages.length, totalCount)} /{' '}
              {Math.max(totalCount, messages.length)}
            </span>
          )}
        </div>
      )}
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
              delayState={
                streamingMessageId && message.id === streamingMessageId
                  ? streamingDelayState
                  : undefined
              }
              onClick={hasContent ? () => onMessageClick?.(message) : undefined}
              onBookmarkClick={
                hasContent ? () => onBookmarkClick?.(message) : undefined
              }
              onDeleteClick={() => onDeleteClick?.(message)}
            />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </ScrollArea>
  );
}

export { ChatMessageList };
export type { ChatMessageListProps };
