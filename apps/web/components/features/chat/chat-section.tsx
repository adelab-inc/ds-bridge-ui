'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { ChatMessageList } from './chat-message-list';
import { ChatInput } from './chat-input';
import { ChatHeader } from './chat-header';
import { useSelectedMessage } from './hooks/use-selected-message';
import { useChatStreamLifecycle } from './hooks/use-chat-stream-lifecycle';
import { useMessageDelete } from './hooks/use-message-delete';
import { useMessageBookmarks } from './hooks/use-message-bookmarks';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useGetPaginatedMessages } from '@/hooks/supabase/useGetPaginatedMessages';
import { useGetMessageCount } from '@/hooks/supabase/useGetMessageCount';
import { useGetMessageById } from '@/hooks/supabase/useGetMessageById';
import { useDescriptionStore } from '@/stores/useDescriptionStore';
import { useStreamingStore } from '@/stores/useStreamingStore';
import type { CodeEvent } from '@/types/chat';
import type { ChatMessage } from '@packages/shared-types/typescript/database/types';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { DescriptionTab } from '@/components/features/description/description-tab';
import { DescriptionActionBar } from '@/components/features/description/description-action-bar';
import { BookmarkLabelDialog } from './dialogs/bookmark-label-dialog';
import { DeleteMessageDialog } from './dialogs/delete-message-dialog';
import { FigmaRateLimitDialog } from './dialogs/figma-rate-limit-dialog';
import { UnsavedEditDialog } from './dialogs/unsaved-edit-dialog';

interface ChatSectionProps extends React.ComponentProps<'section'> {
  roomId: string;
  schemaKey?: string;
  /** AI가 코드를 생성했을 때 호출되는 콜백 (roomId로 룸 귀속 표시) */
  onCodeGenerated?: (code: CodeEvent, roomId: string) => void;
  /** 스트리밍이 시작될 때 호출되는 콜백 (roomId로 룸 귀속 표시) */
  onStreamStart?: (roomId: string) => void;
  /** 스트리밍이 종료될 때 호출되는 콜백 (done/error) */
  onStreamEnd?: () => void;
}

function ChatSection({
  roomId,
  onCodeGenerated,
  onStreamStart,
  onStreamEnd,
  className,
  ...props
}: ChatSectionProps) {
  const {
    data,
    isPending: isMessagesPending,
    refetch: refetchMessages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useGetPaginatedMessages({
    roomId,
    pageSize: 20,
    infiniteQueryOptions: {
      enabled: !!roomId,
    },
  });

  // 총 메시지 수 (목록 상단 "표시 / 전체" 카운터용)
  const { data: totalCount, refetch: refetchCount } =
    useGetMessageCount(roomId);

  // 스트리밍 완료는 byRoom invalidate가 아니라 refetch 호출이므로 카운터도 함께 갱신
  const refetchMessagesAndCount = React.useCallback(
    () => Promise.all([refetchMessages(), refetchCount()]),
    [refetchMessages, refetchCount]
  );

  const { selectedMessageId, updateSelectedMessageId } = useSelectedMessage();

  // 디스크립션 탭 상태
  const activeTab = useDescriptionStore((s) => s.activeTab);
  const setActiveTab = useDescriptionStore((s) => s.setActiveTab);
  const descriptionUiState = useDescriptionStore((s) => s.uiState);

  // 편집 중 탭 전환 시 미저장 확인용
  const [pendingTab, setPendingTab] = React.useState<string | null>(null);

  const handleTabChange = React.useCallback(
    (value: string | number | null) => {
      const tab = value as 'design' | 'description';
      // 편집 중에 디자인 탭으로 전환 시 확인 다이얼로그
      if (descriptionUiState === 'editing' && tab === 'design') {
        setPendingTab(tab);
        return;
      }
      setActiveTab(tab);
    },
    [descriptionUiState, setActiveTab]
  );

  const {
    images,
    addImages,
    removeImage,
    clearImages,
    isUploading,
    uploadedUrls,
  } = useImageUpload(roomId);

  const rawDelayState = useStreamingStore((s) => s.delayState);

  const {
    handleSend,
    isLoading,
    streamingMessage,
    sendError,
    figmaRateLimitOpen,
    setFigmaRateLimitOpen,
  } = useChatStreamLifecycle({
    roomId,
    uploadedUrls,
    clearImages,
    selectedMessageId,
    refetchMessages: refetchMessagesAndCount,
    updateSelectedMessageId,
    onStreamStart,
    onStreamEnd,
    onCodeGenerated,
  });

  // streamingMessage(훅에서 이미 현재 룸으로 스코핑됨)가 있을 때만
  // delayState를 적용 — 다른 룸의 지연 상태가 새지 않도록 게이트.
  const streamingDelayState = streamingMessage ? rawDelayState : 'normal';

  // 메시지 클릭 시 해당 메시지의 content를 미리보기에 표시
  const handleMessageClick = React.useCallback(
    (message: ChatMessage) => {
      if (message.content && message.content.trim()) {
        updateSelectedMessageId(message.id);
        onCodeGenerated?.(
          {
            type: 'code',
            content: message.content,
            path: message.path,
            code_hash: message.code_hash,
          },
          roomId
        );
      }
    },
    [updateSelectedMessageId, onCodeGenerated, roomId]
  );

  // DB 메시지 목록
  // pages는 신→구 페이지 순서(각 페이지 내부는 시간 오름차순)이므로,
  // 표시용으로 페이지 순서를 뒤집어 오래된 페이지가 위로 오게 한다.
  // (단일 페이지에서는 결과가 동일 — 다중 페이지에서만 정렬이 교정됨)
  // refetch는 로드된 페이지를 순서대로 다시 당기며 각 페이지의 새 nextCursor를 쓰므로
  // 스트리밍 후 새 메시지가 page0/page1 경계를 밀어도 seam이 어긋나지 않는다.
  const dbMessages = React.useMemo(() => {
    if (!data) return [];
    return [...data.pages].reverse().flatMap((page) => page.messages);
  }, [data]);

  // 표시할 메시지 목록 (DB 메시지 + 스트리밍 메시지, 중복 방지)
  const displayMessages = React.useMemo(() => {
    if (!streamingMessage) return dbMessages;
    // DB에 이미 같은 ID가 있으면 streamingMessage가 우선 (refetch 직후 중복 방지)
    const filtered = dbMessages.filter((msg) => msg.id !== streamingMessage.id);
    return [...filtered, streamingMessage];
  }, [dbMessages, streamingMessage]);

  // 딥링크 `?mid=`가 로드된 페이지에 없으면(첫 페이지 밖의 오래된 메시지) 단건 조회.
  // 로드된 페이지에 있거나 mid가 없으면 비활성 — 렌더 중 파생값이라 setState 불필요.
  // displayMessages 기준: 스트리밍 직후 선택된 새 메시지가 refetch 전까지 dbMessages에
  // 없는 잠깐 동안 불필요한 단건 조회가 나가지 않게 한다.
  const deepLinkId =
    !isMessagesPending &&
    dbMessages.length > 0 &&
    selectedMessageId &&
    !displayMessages.some((msg) => msg.id === selectedMessageId)
      ? selectedMessageId
      : null;
  const deepLinkQuery = useGetMessageById({ roomId, messageId: deepLinkId });

  // DB 메시지 로드 시 초기 메시지 선택 처리 (마운트당 1회)
  const initialSelectionRef = React.useRef(false);
  React.useEffect(() => {
    if (initialSelectionRef.current) return;
    if (isMessagesPending || !dbMessages.length || isLoading) return;

    const select = (msg: ChatMessage, updateUrl: boolean) => {
      if (updateUrl) updateSelectedMessageId(msg.id);
      onCodeGenerated?.(
        {
          type: 'code',
          content: msg.content,
          path: msg.path,
          code_hash: msg.code_hash,
        },
        roomId
      );
      initialSelectionRef.current = true;
    };

    // URL에 mid가 이미 있으면 해당 메시지를 찾아서 프리뷰 표시 (URL 유지)
    if (selectedMessageId) {
      const loaded = dbMessages.find((msg) => msg.id === selectedMessageId);
      if (loaded) {
        if (loaded.content?.trim()) {
          select(loaded, false);
          return;
        }
        // 로드됐지만 코드가 없는 메시지 → 아래 fallback
      } else {
        // 첫 페이지 밖의 오래된 메시지일 수 있음 → 단건 조회 결과를 기다린다.
        // 조회 중에 fallback으로 넘어가면 최신 메시지로 URL이 덮어써지고 프리뷰가 깜빡이므로 금지.
        if (deepLinkQuery.isPending) return;
        const fetched = deepLinkQuery.data; // null=없음(삭제/다른 룸)
        if (fetched?.content?.trim()) {
          select(fetched, false);
          return;
        }
        // 조회 실패(네트워크 등)는 "없음"과 다르다 — URL의 mid를 지우지 않고 최신 메시지를
        // 프리뷰로만 띄운다. 새로고침하면 딥링크가 그대로 복구된다.
        if (deepLinkQuery.isError) {
          const latest = [...dbMessages]
            .reverse()
            .find((msg) => msg.content && msg.content.trim());
          if (latest) select(latest, false);
          return;
        }
        // 없거나 코드 없음 → 아래 fallback (URL의 mid를 최신 메시지로 교체)
      }
    }

    // mid가 없거나 유효하지 않으면 최신 content 있는 메시지 자동 선택 후 URL 업데이트
    const latestWithContent = [...dbMessages]
      .reverse()
      .find((msg) => msg.content && msg.content.trim());

    if (latestWithContent) {
      select(latestWithContent, true);
    }
  }, [
    dbMessages,
    isMessagesPending,
    isLoading,
    selectedMessageId,
    deepLinkQuery.isPending,
    deepLinkQuery.isError,
    deepLinkQuery.data,
    onCodeGenerated,
    updateSelectedMessageId,
    roomId,
  ]);

  const {
    deleteMessageDialog,
    setDeleteMessageDialog,
    deleteMessageMutation,
    handleDeleteIconClick,
    handleDeleteMessageConfirm,
  } = useMessageDelete({
    roomId,
    selectedMessageId,
    displayMessages,
    updateSelectedMessageId,
    refetchMessages,
    onCodeGenerated,
  });

  const {
    bookmarks,
    bookmarkedMessageIds,
    removeBookmark,
    bookmarkDialog,
    setBookmarkDialog,
    bookmarkLabel,
    setBookmarkLabel,
    handleBookmarkIconClick,
    handleBookmarkSubmit,
    handleBookmarkClick,
  } = useMessageBookmarks({
    roomId,
    dbMessages,
    streamingMessage,
    updateSelectedMessageId,
    onCodeGenerated,
  });

  return (
    <>
      <section
        data-slot="chat-section"
        className={cn(
          'bg-card border-border relative flex-1 flex flex-col overflow-hidden rounded-lg border',
          className
        )}
        {...props}
      >
        {/* Tabs 래퍼: 헤더 + 콘텐츠 영역 모두 감싸기 */}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <ChatHeader
            error={sendError}
            bookmarks={bookmarks}
            selectedMessageId={selectedMessageId}
            onBookmarkSelect={handleBookmarkClick}
            onBookmarkDelete={removeBookmark}
          />

          <TabsContent
            value="design"
            keepMounted
            className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            {/* Messages */}
            <ChatMessageList
              messages={displayMessages}
              hasMore={hasNextPage}
              isLoadingMore={isFetchingNextPage}
              onLoadMore={fetchNextPage}
              totalCount={totalCount}
              selectedMessageId={selectedMessageId ?? undefined}
              bookmarkedMessageIds={bookmarkedMessageIds}
              streamingMessageId={streamingMessage?.id}
              streamingDelayState={streamingDelayState}
              onMessageClick={handleMessageClick}
              onBookmarkClick={handleBookmarkIconClick}
              onDeleteClick={handleDeleteIconClick}
              className="min-h-0 flex-1"
            />

            {/* 디스크립션 액션바 */}
            <DescriptionActionBar
              roomId={roomId}
              hasMessages={displayMessages.length > 0}
            />

            {/* Input */}
            <ChatInput
              onSend={handleSend}
              disabled={isLoading}
              images={images}
              onAddImages={addImages}
              onRemoveImage={removeImage}
              isUploading={isUploading}
            />
          </TabsContent>

          <TabsContent
            value="description"
            keepMounted
            className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <DescriptionTab roomId={roomId} />
          </TabsContent>
        </Tabs>
      </section>

      <BookmarkLabelDialog
        open={bookmarkDialog.open}
        label={bookmarkLabel}
        onLabelChange={setBookmarkLabel}
        onOpenChange={(open) => {
          if (!open) {
            setBookmarkDialog({ open: false, message: null });
            setBookmarkLabel('');
          }
        }}
        onSubmit={handleBookmarkSubmit}
      />

      <DeleteMessageDialog
        open={deleteMessageDialog.open}
        isPending={deleteMessageMutation.isPending}
        errorMessage={
          deleteMessageMutation.isError
            ? deleteMessageMutation.error.message
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) setDeleteMessageDialog({ open: false, message: null });
        }}
        onConfirm={handleDeleteMessageConfirm}
      />

      <FigmaRateLimitDialog
        open={figmaRateLimitOpen}
        onOpenChange={setFigmaRateLimitOpen}
      />

      <UnsavedEditDialog
        open={pendingTab !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTab(null);
        }}
        onDiscard={() => {
          useDescriptionStore.getState().cancelEdit();
          if (pendingTab) {
            setActiveTab(pendingTab as 'design' | 'description');
          }
          setPendingTab(null);
        }}
      />
    </>
  );
}

export { ChatSection };
export type { ChatSectionProps };
