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
import type { CodeEvent } from '@/types/chat';
import { useGetPaginatedFbMessages } from '@/hooks/firebase/useGetPaginatedFbMessages';
import { useDeleteMessage } from '@/hooks/api/useDeleteMessage';
import type { ChatMessage } from '@/hooks/firebase/messageUtils';
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
  const { data } = useGetPaginatedFbMessages({
    roomId,
    pageSize: 10,
    infiniteQueryOptions: {
      enabled: !!roomId,
    },
  });

  const searchParams = useSearchParams();
  const deleteMessageMutation = useDeleteMessage();

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [deleteMessageDialog, setDeleteMessageDialog] = React.useState<{
    open: boolean;
    message: ChatMessage | null;
  }>({ open: false, message: null });
  const currentMessageIdRef = React.useRef<string | null>(null);

  // URL의 mid 쿼리 파라미터에서 선택된 메시지 ID 읽기
  const selectedMessageId = searchParams.get('mid');

  // URL의 mid 파라미터 업데이트
  // window.history.replaceState 사용 — router.replace와 달리
  // 서버측 RSC fetch를 트리거하지 않아 Production CDN 지연/간섭 방지
  // Next.js가 replaceState를 패치하여 useSearchParams() 동기화 유지
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

  const { sendMessage, isLoading, error } = useChatStream({
    onStart: (messageId) => {
      // 서버에서 실제 message_id를 받으면 임시 ID를 교체
      const tempId = currentMessageIdRef.current;
      if (tempId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? { ...msg, id: messageId } : msg
          )
        );
        currentMessageIdRef.current = messageId;
      }
    },
    onChat: (text) => {
      // 스트리밍 중 현재 메시지의 text 업데이트
      if (currentMessageIdRef.current) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentMessageIdRef.current
              ? { ...msg, text: msg.text + text, status: 'GENERATING' }
              : msg
          )
        );
      }
    },
    onCode: (code: CodeEvent) => {
      // 코드 생성 시 현재 메시지의 content, path 업데이트
      if (currentMessageIdRef.current) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentMessageIdRef.current
              ? { ...msg, content: code.content, path: code.path }
              : msg
          )
        );
        // 현재 스트리밍 중인 메시지를 선택 상태로 설정
        updateSelectedMessageId(currentMessageIdRef.current);
      }
      // 부모 컴포넌트에 코드 생성 알림
      onCodeGenerated?.(code);
    },
    onDone: (messageId) => {
      // 스트리밍 완료 시 status를 DONE으로 변경
      const finalId = messageId || currentMessageIdRef.current;
      if (finalId) {
        const now = Date.now();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === finalId
              ? {
                  ...msg,
                  status: 'DONE' as const,
                  answer_created_at: now,
                }
              : msg
          )
        );
        currentMessageIdRef.current = null;
      }
      // 부모 컴포넌트에 스트리밍 종료 알림
      onStreamEnd?.();
    },
    onError: (errorMsg) => {
      const messageId = currentMessageIdRef.current;
      // 에러 발생 시 status를 ERROR로 변경
      if (messageId) {
        const now = Date.now();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  text: `Error: ${errorMsg}`,
                  status: 'ERROR' as const,
                  answer_created_at: now,
                }
              : msg
          )
        );
        currentMessageIdRef.current = null;
      }
      // 부모 컴포넌트에 스트리밍 종료 알림
      onStreamEnd?.();
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
    const messageId = crypto.randomUUID();

    // 업로드 완료된 이미지 URL 캡처
    const imageUrls = uploadedUrls.length > 0 ? [...uploadedUrls] : undefined;

    // 새 메시지 생성 (질문과 빈 답변)
    const newMessage: ChatMessage = {
      id: messageId,
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

    setMessages((prev) => [...prev, newMessage]);
    currentMessageIdRef.current = messageId;

    // 이미지 초기화 (전송 후)
    clearImages();

    // 부모 컴포넌트에 스트리밍 시작 알림
    onStreamStart?.();

    // AI에게 메시지 전송 (선택된 메시지가 있으면 해당 코드 기준으로 수정, 이미지 URL 포함)
    await sendMessage({
      message,
      room_id: roomId,
      stream: true,
      from_message_id: selectedMessageId ?? undefined,
      image_urls: imageUrls,
    });
  };

  // Firebase 메시지 목록
  const firebaseMessages = React.useMemo(() => {
    if (!data) return [];
    return data.pages.flat();
  }, [data]);

  // 표시할 메시지 목록 (Firebase 메시지 + 로컬 메시지)
  const displayMessages = React.useMemo(() => {
    return [...firebaseMessages, ...messages];
  }, [firebaseMessages, messages]);

  // Firebase 메시지 로드 시 초기 메시지 선택 처리
  const initialSelectionRef = React.useRef(false);
  React.useEffect(() => {
    if (initialSelectionRef.current) return;
    if (!firebaseMessages.length || isLoading) return;

    // URL에 mid가 이미 있으면 해당 메시지를 찾아서 프리뷰 표시
    if (selectedMessageId) {
      const targetMessage = firebaseMessages.find(
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
    const latestWithContent = [...firebaseMessages]
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
    firebaseMessages,
    isLoading,
    selectedMessageId,
    onCodeGenerated,
    updateSelectedMessageId,
  ]);

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

  // 메시지 삭제 아이콘 클릭
  const handleDeleteIconClick = React.useCallback((message: ChatMessage) => {
    setDeleteMessageDialog({ open: true, message });
  }, []);

  // 메시지 삭제 확인
  const handleDeleteMessageConfirm = React.useCallback(() => {
    if (!deleteMessageDialog.message) return;
    const messageToDelete = deleteMessageDialog.message;
    deleteMessageMutation.mutate(
      { roomId, messageId: messageToDelete.id },
      {
        onSuccess: () => {
          setDeleteMessageDialog({ open: false, message: null });
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== messageToDelete.id)
          );
          if (selectedMessageId === messageToDelete.id) {
            updateSelectedMessageId(null);
          }
        },
      }
    );
  }, [
    deleteMessageDialog.message,
    deleteMessageMutation,
    roomId,
    selectedMessageId,
    updateSelectedMessageId,
  ]);

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
      const allMessages = [...firebaseMessages, ...messages];
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
    [firebaseMessages, messages, updateSelectedMessageId, onCodeGenerated]
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
          onDeleteClick={handleDeleteIconClick}
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

      {/* 메시지 삭제 확인 다이얼로그 */}
      <AlertDialog
        open={deleteMessageDialog.open}
        onOpenChange={(open) => {
          if (!open) setDeleteMessageDialog({ open: false, message: null });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>메시지 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 메시지를 삭제하시겠습니까? 삭제된 메시지는 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMessageConfirm}
              disabled={deleteMessageMutation.isPending}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export { ChatSection };
export type { ChatSectionProps };
