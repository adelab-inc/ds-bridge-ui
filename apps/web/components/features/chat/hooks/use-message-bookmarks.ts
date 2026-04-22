'use client';

import * as React from 'react';

import { useBookmarks } from '@/hooks/useBookmarks';
import type { ChatMessage } from '@packages/shared-types/typescript/database/types';
import type { CodeEvent } from '@/types/chat';

interface UseMessageBookmarksArgs {
  roomId: string;
  dbMessages: ChatMessage[];
  streamingMessage: ChatMessage | null;
  updateSelectedMessageId: (messageId: string | null) => void;
  onCodeGenerated?: (code: CodeEvent) => void;
}

/**
 * 메시지 북마크 기능을 캡슐화하는 훅.
 *
 * - useBookmarks 래핑 + `bookmarkedMessageIds` Set 계산
 * - 북마크 추가 다이얼로그 state (open + message + label) 관리
 * - 북마크 아이콘 클릭 토글(미등록 → 다이얼로그, 등록됨 → 제거)
 * - 드롭다운 북마크 클릭 시 해당 메시지로 이동
 */
export function useMessageBookmarks({
  roomId,
  dbMessages,
  streamingMessage,
  updateSelectedMessageId,
  onCodeGenerated,
}: UseMessageBookmarksArgs) {
  const { bookmarks, addBookmark, removeBookmark, isBookmarked } =
    useBookmarks(roomId);

  const bookmarkedMessageIds = React.useMemo(
    () => new Set(bookmarks.map((b) => b.messageId)),
    [bookmarks]
  );

  const [bookmarkDialog, setBookmarkDialog] = React.useState<{
    open: boolean;
    message: ChatMessage | null;
  }>({ open: false, message: null });
  const [bookmarkLabel, setBookmarkLabel] = React.useState('');

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

  return {
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
  };
}
