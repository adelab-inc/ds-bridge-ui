import { useCallback, useState, useRef, useEffect } from 'react';
import { ChatStreamRequest, SSEEvent, CodeEvent } from '@/types/chat';

interface UseChatStreamOptions {
  onStart?: (messageId: string) => void;
  onChat?: (text: string) => void;
  onCode?: (code: CodeEvent) => void;
  onError?: (error: string) => void;
  onDone?: (messageId: string) => void;
}

export function useChatStream(options: UseChatStreamOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accumulatedText, setAccumulatedText] = useState('');
  const [generatedFiles, setGeneratedFiles] = useState<CodeEvent[]>([]);

  // 클로저 문제 해결: 항상 최신 콜백을 참조하도록 ref 사용
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const sendMessage = useCallback(async (request: ChatStreamRequest) => {
    setIsLoading(true);
    setError(null);
    setAccumulatedText('');
    setGeneratedFiles([]);

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let buffer = '';

      const processLine = (line: string) => {
        if (line.startsWith('data: ')) {
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));

            switch (event.type) {
              case 'start':
                optionsRef.current.onStart?.(event.message_id);
                break;

              case 'chat':
                setAccumulatedText((prev) => prev + event.text);
                optionsRef.current.onChat?.(event.text);
                break;

              case 'code':
                setGeneratedFiles((prev) => [...prev, event]);
                optionsRef.current.onCode?.(event);
                break;

              case 'done':
                optionsRef.current.onDone?.(event.message_id);
                break;

              case 'error':
                setError(event.error);
                optionsRef.current.onError?.(event.error);
                break;
            }
          } catch (parseError) {
            console.error('Failed to parse SSE event:', parseError);
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // 스트림 종료 시 남은 버퍼 처리
          if (buffer.trim()) {
            processLine(buffer);
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');

        // 마지막 줄은 불완전할 수 있으므로 버퍼에 유지
        buffer = lines.pop() || '';

        for (const line of lines) {
          processLine(line);
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      optionsRef.current.onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setAccumulatedText('');
    setGeneratedFiles([]);
    setError(null);
  }, []);

  return {
    sendMessage,
    isLoading,
    error,
    accumulatedText,
    generatedFiles,
    reset,
  };
}
