'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Message01Icon,
  Bookmark02Icon,
  Delete02Icon,
  Tick01Icon,
} from '@hugeicons/core-free-icons';
import { useSearchParams } from 'next/navigation';

import { cn } from '@/lib/utils';
import { ChatMessageList } from './chat-message-list';
import { ChatInput } from './chat-input';
import { useChatStream } from '@/hooks/useChatStream';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useRoomChannel } from '@/hooks/supabase/useRoomChannel';
import { useGetPaginatedMessages } from '@/hooks/supabase/useGetPaginatedMessages';
import { useStreamingStore } from '@/stores/useStreamingStore';
import type { CodeEvent } from '@/types/chat';
import type { ChatMessage } from '@packages/shared-types/typescript/database/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

/** 스트리밍 타임아웃 (120초) */
const STREAM_TIMEOUT_MS = 120_000;

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

  const searchParams = useSearchParams();

  // 스트리밍 중인 단일 메시지 (Zustand 외부 스토어로 관리)
  // → React 배칭/동시성 렌더링에 의한 state 유실 방지
  const streamingMessage = useStreamingStore((s) => s.message);
  const setStreamingMessage = useStreamingStore((s) => s.setMessage);
  const updateStreamingMessage = useStreamingStore((s) => s.updateMessage);

  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Broadcast 콜백에서 사용할 ref (state updater 밖에서 side effect 실행용)
  const pendingQuestionRef = React.useRef<string>('');
  const activeMessageIdRef = React.useRef<string | null>(null);

  // URL의 mid 쿼리 파라미터에서 선택된 메시지 ID 읽기
  const selectedMessageId = searchParams.get('mid');

  // URL의 mid 파라미터 업데이트
  const updateSelectedMessageId = React.useCallback(
    (messageId: string | null) => {
      const url = new URL(window.location.href);
      if (messageId) {
        url.searchParams.set('mid', messageId);
      } else {
        url.searchParams.delete('mid');
      }
      window.history.replaceState(
        window.history.state,
        '',
        url.pathname + url.search
      );
    },
    []
  );

  const {
    images,
    addImages,
    removeImage,
    clearImages,
    isUploading,
    uploadedUrls,
  } = useImageUpload(roomId);

  const { sendMessage, isLoading: isSending, error } = useChatStream();

  // 타임아웃 클리어 헬퍼
  const clearStreamTimeout = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // 스트리밍 종료 헬퍼 (done/error 공통)
  const finishStreaming = React.useCallback(() => {
    clearStreamTimeout();
    onStreamEnd?.();
  }, [clearStreamTimeout, onStreamEnd]);

  // === Broadcast 채널 구독 ===
  useRoomChannel({
    roomId,
    enabled: !!roomId,
    callbacks: {
      onStart: (payload) => {
        activeMessageIdRef.current = payload.message_id;
        updateStreamingMessage((prev) => {
          if (prev) {
            return { ...prev, id: payload.message_id };
          }
          // handleSend의 state가 아직 반영되지 않은 경우 ref에서 질문 복원
          return {
            id: payload.message_id,
            question: pendingQuestionRef.current,
            text: '',
            content: '',
            path: '',
            room_id: roomId,
            question_created_at: Date.now(),
            answer_created_at: 0,
            status: 'GENERATING' as const,
          };
        });
      },
      onChunk: (payload) => {
        // state updater는 순수 함수로 유지 (side effect 금지)
        updateStreamingMessage((prev) => {
          if (!prev) {
            console.warn('[ChatSection] onChunk: prev is NULL, dropping chunk');
            return prev;
          }

          if (payload.type === 'chat' && payload.text) {
            return { ...prev, text: prev.text + payload.text };
          }

          if (payload.type === 'code') {
            return {
              ...prev,
              content: payload.content ?? prev.content,
              path: payload.path ?? prev.path,
            };
          }

          console.warn('[ChatSection] onChunk: unknown type', payload);
          return prev;
        });

        // side effect는 state updater 바깥에서 실행
        if (payload.type === 'code' && payload.content) {
          const msgId = activeMessageIdRef.current;
          if (msgId) updateSelectedMessageId(msgId);
          onCodeGenerated?.({
            type: 'code',
            content: payload.content,
            path: payload.path ?? '',
          });
        }
      },
      onDone: () => {
        activeMessageIdRef.current = null;

        // 타임아웃 즉시 클리어 (ref 직접 접근)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        onStreamEnd?.();

        // 스트리밍 메시지를 DONE 상태로 전환 (refetch 전까지 화면 유지)
        updateStreamingMessage((prev) =>
          prev
            ? {
                ...prev,
                status: 'DONE' as const,
                answer_created_at: Date.now(),
              }
            : null
        );

        // DB refetch 후 streamingMessage 제거 (DB 메시지로 교체)
        refetchMessages()
          .then(() => setStreamingMessage(null))
          .catch(() => setStreamingMessage(null));
      },
      onError: (payload) => {
        activeMessageIdRef.current = null;
        const now = Date.now();
        updateStreamingMessage((prev) =>
          prev
            ? {
                ...prev,
                text: `Error: ${payload.error}`,
                status: 'ERROR' as const,
                answer_created_at: now,
              }
            : prev
        );
        finishStreaming();
      },
    },
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

  const handleSend = async (message: string) => {
    const tempId = crypto.randomUUID();

    // 업로드 완료된 이미지 URL 캡처
    const imageUrls = uploadedUrls.length > 0 ? [...uploadedUrls] : undefined;

    // Optimistic UI: streamingMessage 즉시 생성
    const newMessage: ChatMessage = {
      id: tempId,
      question: imageUrls
        ? `[이미지 ${imageUrls.length}개] ${message}`
        : message,
      text: '',
      content: '',
      path: '',
      room_id: roomId,
      question_created_at: Date.now(),
      answer_created_at: 0,
      status: 'GENERATING',
    };

    pendingQuestionRef.current = newMessage.question;
    activeMessageIdRef.current = tempId;

    // Zustand store에 직접 설정 (React 배칭 영향 없음)
    setStreamingMessage(newMessage);

    // 이미지 초기화 (전송 후)
    clearImages();

    // 부모 컴포넌트에 스트리밍 시작 알림 (Zustand store 업데이트)
    onStreamStart?.();

    // 타임아웃 설정 (120초)
    clearStreamTimeout();
    timeoutRef.current = setTimeout(() => {
      activeMessageIdRef.current = null;
      const now = Date.now();
      updateStreamingMessage((prev) =>
        prev
          ? {
              ...prev,
              text: prev.text || 'Error: 응답 타임아웃 (120초)',
              status: 'ERROR' as const,
              answer_created_at: now,
            }
          : prev
      );
      onStreamEnd?.();
    }, STREAM_TIMEOUT_MS);

    // AI에게 메시지 전송
    const messageId = await sendMessage({
      message,
      room_id: roomId,
      stream: true,
      from_message_id: selectedMessageId ?? undefined,
      image_urls: imageUrls,
    });

    // POST 실패 시 에러 처리
    if (!messageId) {
      activeMessageIdRef.current = null;
      const now = Date.now();
      updateStreamingMessage((prev) =>
        prev
          ? {
              ...prev,
              text: 'Error: 메시지 전송 실패',
              status: 'ERROR' as const,
              answer_created_at: now,
            }
          : prev
      );
      clearStreamTimeout();
      onStreamEnd?.();
    }
  };

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

  // isLoading: POST 중이거나 스트리밍 중일 때
  const isLoading = isSending || !!streamingMessage;

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

  // 타임아웃 cleanup
  React.useEffect(() => {
    return () => clearStreamTimeout();
  }, [clearStreamTimeout]);

  // ===== 북마크 기능 =====
  const { bookmarks, addBookmark, removeBookmark, isBookmarked } =
    useBookmarks(roomId);

  // 북마크된 메시지 ID Set (ChatMessageList에 전달)
  const bookmarkedMessageIds = React.useMemo(
    () => new Set(bookmarks.map((b) => b.messageId)),
    [bookmarks]
  );

  // 북마크 추가 다이얼로그 상태
  const [bookmarkDialog, setBookmarkDialog] = React.useState<{
    open: boolean;
    message: ChatMessage | null;
  }>({ open: false, message: null });
  const [bookmarkLabel, setBookmarkLabel] = React.useState('');

  // 북마크 아이콘 클릭: 미등록 → 다이얼로그 열기, 등록됨 → 삭제
  const handleBookmarkIconClick = React.useCallback(
    (message: ChatMessage) => {
      if (isBookmarked(message.id)) {
        const bm = bookmarks.find((b) => b.messageId === message.id);
        if (bm) removeBookmark(bm.id);
      } else {
        setBookmarkLabel(
          message.question.replace(/^\[이미지 \d+개\] /, '').slice(0, 50)
        );
        setBookmarkDialog({ open: true, message });
      }
    },
    [isBookmarked, bookmarks, removeBookmark]
  );

  // 북마크 저장
  const handleBookmarkSubmit = React.useCallback(() => {
    if (!bookmarkDialog.message || !bookmarkLabel.trim()) return;
    addBookmark({
      messageId: bookmarkDialog.message.id,
      roomId,
      label: bookmarkLabel.trim(),
      question: bookmarkDialog.message.question,
    });
    setBookmarkDialog({ open: false, message: null });
    setBookmarkLabel('');
  }, [bookmarkDialog.message, bookmarkLabel, addBookmark, roomId]);

  // 북마크 클릭 → 해당 메시지로 이동
  const handleBookmarkClick = React.useCallback(
    (messageId: string) => {
      const allMessages = [
        ...dbMessages,
        ...(streamingMessage ? [streamingMessage] : []),
      ];
      const target = allMessages.find((msg) => msg.id === messageId);
      if (target?.content?.trim()) {
        updateSelectedMessageId(messageId);
        onCodeGenerated?.({
          type: 'code',
          content: target.content,
          path: target.path,
        });
      }
    },
    [dbMessages, streamingMessage, updateSelectedMessageId, onCodeGenerated]
  );

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
        {/* Header */}
        <div className="border-border flex items-center gap-2 border-b px-4 py-3">
          <HugeiconsIcon
            icon={Message01Icon}
            className="text-muted-foreground size-4"
            strokeWidth={2}
          />
          <h2 className="text-sm font-medium">AI Navigator</h2>
          {error && <span className="text-destructive text-xs">{error}</span>}

          {/* 북마크 플로팅 버튼 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto rounded-full"
                aria-label="북마크 목록"
              >
                <HugeiconsIcon
                  icon={Bookmark02Icon}
                  className="size-4"
                  strokeWidth={2}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="bottom"
              align="end"
              sideOffset={4}
              className="w-64"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel>북마크</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {bookmarks.length === 0 ? (
                <p className="text-muted-foreground px-2 py-3 text-center text-xs">
                  북마크가 없습니다
                </p>
              ) : (
                bookmarks.map((bm) => (
                  <DropdownMenuItem
                    key={bm.id}
                    className="flex items-center justify-between gap-2"
                    onClick={() => handleBookmarkClick(bm.messageId)}
                  >
                    {selectedMessageId === bm.messageId && (
                      <HugeiconsIcon
                        icon={Tick01Icon}
                        className="text-primary size-3.5 shrink-0"
                        strokeWidth={2}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{bm.label}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {new Date(bm.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive shrink-0 p-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBookmark(bm.id);
                      }}
                      aria-label="북마크 삭제"
                    >
                      <HugeiconsIcon
                        icon={Delete02Icon}
                        className="size-3.5"
                        strokeWidth={2}
                      />
                    </button>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Messages */}
        <ChatMessageList
          messages={displayMessages}
          selectedMessageId={selectedMessageId ?? undefined}
          bookmarkedMessageIds={bookmarkedMessageIds}
          onMessageClick={handleMessageClick}
          onBookmarkClick={handleBookmarkIconClick}
          className="min-h-0 flex-1 overflow-y-auto"
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
      </section>

      {/* 북마크 이름 입력 다이얼로그 */}
      <AlertDialog
        open={bookmarkDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setBookmarkDialog({ open: false, message: null });
            setBookmarkLabel('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>북마크 추가</AlertDialogTitle>
            <AlertDialogDescription>
              북마크 이름을 입력하세요
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={bookmarkLabel}
            onChange={(e) => setBookmarkLabel(e.target.value)}
            placeholder="북마크 이름"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleBookmarkSubmit();
              }
            }}
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBookmarkSubmit}
              disabled={!bookmarkLabel.trim()}
            >
              추가
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export { ChatSection };
export type { ChatSectionProps };
