'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Message01Icon } from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { ChatMessageList } from './chat-message-list';
import { ChatInput } from './chat-input';
import { useChatStream } from '@/hooks/useChatStream';
import type { CodeEvent } from '@/types/chat';
import { useGetPaginatedFbMessages } from '@/hooks/firebase/useGetPaginatedFbMessages';
import type { ChatMessage } from '@/hooks/firebase/messageUtils';

interface ChatSectionProps extends React.ComponentProps<'section'> {
  roomId: string;
  schemaKey?: string;
}

function ChatSection({
  roomId,
  schemaKey,
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

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const currentMessageIdRef = React.useRef<string | null>(null);

  const { sendMessage, isLoading, error, accumulatedText, generatedFiles } =
    useChatStream({
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
        }
      },
      onDone: () => {
        // 스트리밍 완료 시 status를 DONE으로 변경
        if (currentMessageIdRef.current) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === currentMessageIdRef.current
                ? {
                    ...msg,
                    status: 'DONE' as const,
                    answer_created_at: Date.now(),
                  }
                : msg
            )
          );
          currentMessageIdRef.current = null;
        }
      },
      onError: (errorMsg) => {
        console.error('Chat stream error:', errorMsg);
        // 에러 발생 시 status를 ERROR로 변경
        if (currentMessageIdRef.current) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === currentMessageIdRef.current
                ? {
                    ...msg,
                    text: `Error: ${errorMsg}`,
                    status: 'ERROR' as const,
                    answer_created_at: Date.now(),
                  }
                : msg
            )
          );
          currentMessageIdRef.current = null;
        }
      },
    });

  const handleSend = async (message: string) => {
    const messageId = Date.now().toString();

    // 새 메시지 생성 (질문과 빈 답변)
    const newMessage: ChatMessage = {
      id: messageId,
      question: message,
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

    // AI에게 메시지 전송
    await sendMessage({
      message,
      room_id: roomId,
      stream: true,
      schema_key: schemaKey,
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

  return (
    <section
      data-slot="chat-section"
      className={cn(
        'bg-card border-border flex flex-col overflow-hidden rounded-lg border',
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
        {error && (
          <span className="text-destructive ml-auto text-xs">{error}</span>
        )}
      </div>

      {/* Messages */}
      <ChatMessageList
        messages={displayMessages}
        className="min-h-50 max-h-100 flex-1 overflow-y-auto"
      />

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </section>
  );
}

export { ChatSection };
export type { ChatSectionProps };
