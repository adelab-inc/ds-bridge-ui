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
import { useDescriptionStore } from '@/stores/useDescriptionStore';
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
  /** AI가 코드를 생성했을 때 호출되는 콜백 */
  onCodeGenerated?: (code: CodeEvent) => void;
  /** 스트리밍이 시작될 때 호출되는 콜백 */
  onStreamStart?: () => void;
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
  const { data, refetch: refetchMessages } = useGetPaginatedMessages({
    roomId,
    pageSize: 20,
    infiniteQueryOptions: {
      enabled: !!roomId,
    },
  });

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
    refetchMessages,
    updateSelectedMessageId,
    onStreamStart,
    onStreamEnd,
    onCodeGenerated,
  });

  // 메시지 클릭 시 해당 메시지의 content를 미리보기에 표시
  const handleMessageClick = React.useCallback(
    (message: ChatMessage) => {
      if (message.content && message.content.trim()) {
        updateSelectedMessageId(message.id);
        onCodeGenerated?.({
          type: 'code',
          content: message.content,
          path: message.path,
        });
      }
    },
    [updateSelectedMessageId, onCodeGenerated]
  );

  // DB 메시지 목록
  const dbMessages = React.useMemo(() => {
    if (!data) return [];
    return data.pages.flat();
  }, [data]);

  // 표시할 메시지 목록 (DB 메시지 + 스트리밍 메시지, 중복 방지)
  const displayMessages = React.useMemo(() => {
    if (!streamingMessage) return dbMessages;
    // DB에 이미 같은 ID가 있으면 streamingMessage가 우선 (refetch 직후 중복 방지)
    const filtered = dbMessages.filter((msg) => msg.id !== streamingMessage.id);
    return [...filtered, streamingMessage];
  }, [dbMessages, streamingMessage]);

  // DB 메시지 로드 시 초기 메시지 선택 처리
  const initialSelectionRef = React.useRef(false);
  React.useEffect(() => {
    if (initialSelectionRef.current) return;
    if (!dbMessages.length || isLoading) return;

    // URL에 mid가 이미 있으면 해당 메시지를 찾아서 프리뷰 표시
    if (selectedMessageId) {
      const targetMessage = dbMessages.find(
        (msg) => msg.id === selectedMessageId
      );
      if (targetMessage?.content?.trim()) {
        onCodeGenerated?.({
          type: 'code',
          content: targetMessage.content,
          path: targetMessage.path,
        });
        initialSelectionRef.current = true;
        return;
      }
    }

    // mid가 없으면 최신 content 있는 메시지 자동 선택 후 URL 업데이트
    const latestWithContent = [...dbMessages]
      .reverse()
      .find((msg) => msg.content && msg.content.trim());

    if (latestWithContent) {
      updateSelectedMessageId(latestWithContent.id);
      onCodeGenerated?.({
        type: 'code',
        content: latestWithContent.content,
        path: latestWithContent.path,
      });
      initialSelectionRef.current = true;
    }
  }, [
    dbMessages,
    isLoading,
    selectedMessageId,
    onCodeGenerated,
    updateSelectedMessageId,
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
              selectedMessageId={selectedMessageId ?? undefined}
              bookmarkedMessageIds={bookmarkedMessageIds}
              onMessageClick={handleMessageClick}
              onBookmarkClick={handleBookmarkIconClick}
              onDeleteClick={handleDeleteIconClick}
              className="min-h-0 flex-1 overflow-y-auto"
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
