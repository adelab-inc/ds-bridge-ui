'use client';

import * as React from 'react';

import { useDeleteMessage } from '@/hooks/api/useDeleteMessage';
import type { ChatMessage } from '@packages/shared-types/typescript/database/types';
import type { CodeEvent } from '@/types/chat';

interface UseMessageDeleteArgs {
  roomId: string;
  selectedMessageId: string | null;
  displayMessages: ChatMessage[];
  updateSelectedMessageId: (messageId: string | null) => void;
  refetchMessages: () => unknown;
  onCodeGenerated?: (code: CodeEvent) => void;
}

/**
 * 메시지 삭제 플로우를 캡슐화하는 훅.
 *
 * - 삭제 확인 다이얼로그 state (open + message) 관리
 * - mutation 성공 시 refetch 호출
 * - 삭제된 메시지가 현재 선택된 메시지였다면 content 있는 최신 메시지를 자동 선택,
 *   없으면 `selectedMessageId`를 null로 초기화
 */
export function useMessageDelete({
  roomId,
  selectedMessageId,
  displayMessages,
  updateSelectedMessageId,
  refetchMessages,
  onCodeGenerated,
}: UseMessageDeleteArgs) {
  const deleteMessageMutation = useDeleteMessage();

  const [deleteMessageDialog, setDeleteMessageDialog] = React.useState<{
    open: boolean;
    message: ChatMessage | null;
  }>({ open: false, message: null });

  const handleDeleteIconClick = React.useCallback((message: ChatMessage) => {
    setDeleteMessageDialog({ open: true, message });
  }, []);

  const handleDeleteMessageConfirm = React.useCallback(() => {
    if (!deleteMessageDialog.message) return;
    const messageToDelete = deleteMessageDialog.message;
    deleteMessageMutation.mutate(
      { roomId, messageId: messageToDelete.id },
      {
        onSuccess: () => {
          setDeleteMessageDialog({ open: false, message: null });
          refetchMessages();
          if (selectedMessageId === messageToDelete.id) {
            const remaining = displayMessages.filter(
              (msg) => msg.id !== messageToDelete.id
            );
            const lastWithContent = [...remaining]
              .reverse()
              .find((msg) => msg.content && msg.content.trim());
            if (lastWithContent) {
              updateSelectedMessageId(lastWithContent.id);
              onCodeGenerated?.({
                type: 'code',
                content: lastWithContent.content,
                path: lastWithContent.path,
              });
            } else {
              updateSelectedMessageId(null);
            }
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
    displayMessages,
    onCodeGenerated,
    refetchMessages,
  ]);

  return {
    deleteMessageDialog,
    setDeleteMessageDialog,
    deleteMessageMutation,
    handleDeleteIconClick,
    handleDeleteMessageConfirm,
  };
}
