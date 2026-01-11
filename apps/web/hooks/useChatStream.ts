import { useCallback, useState } from 'react';
import { ChatStreamRequest, SSEEvent, CodeEvent } from '@/types/chat';

interface UseChatStreamOptions {
  onText?: (text: string) => void;
  onCode?: (code: CodeEvent) => void;
  onError?: (error: string) => void;
  onDone?: () => void;
}

export function useChatStream(options: UseChatStreamOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accumulatedText, setAccumulatedText] = useState('');
  const [generatedFiles, setGeneratedFiles] = useState<CodeEvent[]>([]);

  const sendMessage = useCallback(
    async (request: ChatStreamRequest) => {
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

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');

          // 마지막 줄은 불완전할 수 있으므로 버퍼에 유지
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event: SSEEvent = JSON.parse(line.slice(6));

                switch (event.type) {
                  case 'text':
                    setAccumulatedText((prev) => prev + event.text);
                    options.onText?.(event.text);
                    break;

                  case 'code':
                    setGeneratedFiles((prev) => [...prev, event]);
                    options.onCode?.(event);
                    break;

                  case 'done':
                    options.onDone?.();
                    break;

                  case 'error':
                    setError(event.error);
                    options.onError?.(event.error);
                    break;
                }
              } catch (parseError) {
                console.error('Failed to parse SSE event:', parseError);
              }
            }
          }
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        options.onError?.(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

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
