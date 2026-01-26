# PRD: Image-to-Code (Frontend)

> UI 디자인 이미지와 프롬프트를 입력받아 React TypeScript 코드를 생성하는 기능

## 1. 개요

### 1.1 기능 설명
UI 디자인 이미지와 프롬프트를 입력받아 React TypeScript 코드를 생성하는 기능

### 1.2 지원 모드
| 모드 | 설명 | 특징 |
|------|------|------|
| **1-Step (Direct)** | 이미지 + 프롬프트 → 바로 코드 생성 | 빠른 응답 |
| **2-Step (Analyze)** | 이미지 분석 → 결과 확인 → 코드 생성 | 정교한 제어 |

---

## 2. 워크플로우

### 2.1 전체 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  1. 사용자: 이미지 선택 + 프롬프트 입력 + 모드 선택              │
│                          ↓                                       │
│  2. ChatInput: 이미지 → base64 변환                             │
│                          ↓                                       │
│  3. useVisionChat: POST /api/chat/vision 호출                   │
│                          ↓                                       │
│  4. API Route: AI Server로 프록시                               │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (FastAPI)                            │
├─────────────────────────────────────────────────────────────────┤
│  5. /chat/vision: 이미지 + 프롬프트 수신                        │
│                          ↓                                       │
│  6. AI Provider: Claude/GPT Vision API 호출                     │
│                          ↓                                       │
│  7. StreamingParser: 응답 파싱 (chat/code/analysis 이벤트)      │
│                          ↓                                       │
│  8. SSE 스트리밍 응답                                           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
├─────────────────────────────────────────────────────────────────┤
│  9. useVisionChat: SSE 이벤트 처리                              │
│      - chat → 텍스트 누적 표시                                  │
│      - code → 코드 저장 + 프리뷰                                │
│      - analysis → 분석 결과 표시 (2-Step)                       │
│      - done → 완료 처리                                         │
│                          ↓                                       │
│  10. PreviewSection: 생성된 코드 렌더링                         │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 1-Step 모드 시퀀스

```
User          ChatInput       useVisionChat     API Route      AI Server
 │                │                │                │              │
 │─이미지+텍스트─▶│                │                │              │
 │                │─base64 변환──▶│                │              │
 │                │                │─POST /vision──▶│              │
 │                │                │                │─프록시──────▶│
 │                │                │                │              │─Vision API
 │                │                │                │◀──SSE stream─│
 │                │                │◀──SSE 이벤트──│              │
 │                │◀─상태 업데이트─│                │              │
 │◀─UI 업데이트──│                │                │              │
```

### 2.3 2-Step 모드 시퀀스

```
User          ChatInput       useVisionChat      AnalysisPreview
 │                │                │                    │
 │─이미지+텍스트─▶│                │                    │
 │  (mode=analyze)│                │                    │
 │                │────────────────▶│                    │
 │                │                │──POST /vision────▶ │
 │                │                │◀─analysis 이벤트──│
 │                │                │                    │
 │◀───────────────│◀─분석 결과────│────────────────────▶│
 │                │                │                    │─분석 결과 표시
 │─"생성해줘"────▶│                │                    │
 │                │────────────────▶│                    │
 │                │                │──POST /vision────▶ │
 │                │                │  (with analysis)   │
 │                │                │◀─code 이벤트─────│
 │◀─코드 표시────│◀───────────────│                    │
```

---

## 3. API 스펙

### 3.1 요청

**Endpoint**: `POST /api/chat/vision`

```typescript
interface VisionChatRequest {
  message: string;              // 사용자 프롬프트
  room_id: string;              // 채팅방 ID
  images: ImageContent[];       // 이미지 배열 (최대 5개)
  mode: 'direct' | 'analyze';   // 생성 모드
  stream?: boolean;             // 스트리밍 여부 (기본 true)
}

interface ImageContent {
  type: 'image';
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string;  // base64 인코딩 데이터 (data:... prefix 제외)
}
```

### 3.2 응답 (SSE 스트리밍)

```typescript
// 텍스트 청크
{ type: 'chat', text: '모던한 로그인 페이지입니다.' }

// 코드 파일
{ type: 'code', path: 'src/pages/Login.tsx', content: '...' }

// 분석 결과 (2-Step 모드)
{
  type: 'analysis',
  data: {
    layout: { type: 'flex', direction: 'column', gap: '16px' },
    components: [
      { type: 'Button', props: { variant: 'primary' }, position: {...} }
    ],
    colors: { primary: '#3B82F6', background: '#FFFFFF' },
    typography: { heading: { size: '24px', weight: 700 } }
  }
}

// 완료
{ type: 'done' }

// 오류
{ type: 'error', error: '이미지 처리 실패' }
```

---

## 4. 타입 정의

### 4.1 수정 파일: `types/chat.ts`

```typescript
// ===== 신규 추가 =====

export interface ImageContent {
  type: 'image';
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string;
}

export interface VisionChatRequest {
  message: string;
  room_id: string;
  images: ImageContent[];
  mode: 'direct' | 'analyze';
  stream?: boolean;
}

export interface ImageAnalysis {
  layout: {
    type: 'flex' | 'grid' | 'stack';
    direction?: 'row' | 'column';
    gap?: string;
    alignment?: string;
  };
  components: Array<{
    type: string;
    props: Record<string, unknown>;
    children?: string;
    position: { x: number; y: number; width: number; height: number };
  }>;
  colors: Record<string, string>;
  typography: Record<string, { size: string; weight: number }>;
}

export interface AnalysisEvent {
  type: 'analysis';
  data: ImageAnalysis;
}

// SSE 이벤트 타입 확장
export type VisionSSEEvent = ChatEvent | CodeEvent | AnalysisEvent | DoneEvent | ErrorEvent;
```

---

## 5. 구현 상세

### 5.1 API Route

**파일**: `app/api/chat/vision/route.ts` (신규)

```typescript
import { NextRequest } from 'next/server';

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://localhost:8000';
const AI_SERVER_API_KEY = process.env.AI_SERVER_API_KEY || '';

export async function POST(request: NextRequest) {
  const body = await request.json();

  const response = await fetch(`${AI_SERVER_URL}/chat/vision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': AI_SERVER_API_KEY,
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!response.ok) {
    return new Response(JSON.stringify({ error: 'AI Server error' }), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // SSE 프록시
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

### 5.2 Hook

**파일**: `hooks/useVisionChat.ts` (신규)

```typescript
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ImageContent, ImageAnalysis, VisionSSEEvent, CodeEvent } from '@/types/chat';

interface UseVisionChatOptions {
  onChat?: (text: string) => void;
  onCode?: (code: CodeEvent) => void;
  onAnalysis?: (analysis: ImageAnalysis) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

export function useVisionChat(options: UseVisionChatOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accumulatedText, setAccumulatedText] = useState('');
  const [generatedFiles, setGeneratedFiles] = useState<CodeEvent[]>([]);
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);

  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; });

  const sendVisionMessage = useCallback(
    async (params: {
      message: string;
      roomId: string;
      images: ImageContent[];
      mode: 'direct' | 'analyze';
    }) => {
      setIsLoading(true);
      setError(null);
      setAccumulatedText('');
      setGeneratedFiles([]);
      setAnalysis(null);

      try {
        const response = await fetch('/api/chat/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: params.message,
            room_id: params.roomId,
            images: params.images,
            mode: params.mode,
            stream: true,
          }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const event: VisionSSEEvent = JSON.parse(line.slice(6));

            switch (event.type) {
              case 'chat':
                setAccumulatedText(prev => prev + event.text);
                optionsRef.current.onChat?.(event.text);
                break;
              case 'code':
                setGeneratedFiles(prev => [...prev, event]);
                optionsRef.current.onCode?.(event);
                break;
              case 'analysis':
                setAnalysis(event.data);
                optionsRef.current.onAnalysis?.(event.data);
                break;
              case 'done':
                optionsRef.current.onDone?.();
                break;
              case 'error':
                setError(event.error);
                optionsRef.current.onError?.(event.error);
                break;
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        optionsRef.current.onError?.(msg);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setAccumulatedText('');
    setGeneratedFiles([]);
    setAnalysis(null);
    setError(null);
  }, []);

  return {
    sendVisionMessage,
    isLoading,
    error,
    accumulatedText,
    generatedFiles,
    analysis,
    reset,
  };
}
```

### 5.3 UI 컴포넌트

#### ImageUploadButton

**파일**: `components/features/chat/ImageUploadButton.tsx` (신규)

```typescript
'use client';

import { useRef } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageUploadButtonProps {
  onSelect: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  currentCount?: number;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE_MB = 5;

export function ImageUploadButton({
  onSelect,
  disabled = false,
  maxFiles = 5,
  currentCount = 0,
}: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files
      .filter(f => ACCEPTED_TYPES.includes(f.type))
      .filter(f => f.size <= MAX_SIZE_MB * 1024 * 1024)
      .slice(0, maxFiles - currentCount);

    if (validFiles.length > 0) {
      onSelect(validFiles);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        onChange={handleChange}
        className="hidden"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || currentCount >= maxFiles}
        title={`이미지 추가 (${currentCount}/${maxFiles})`}
      >
        <ImagePlus className="h-5 w-5" />
      </Button>
    </>
  );
}
```

#### ImagePreviewList

**파일**: `components/features/chat/ImagePreviewList.tsx` (신규)

```typescript
'use client';

import { X } from 'lucide-react';

interface ImagePreview {
  id: string;
  dataUrl: string;
  name: string;
}

interface ImagePreviewListProps {
  images: ImagePreview[];
  onRemove: (id: string) => void;
}

export function ImagePreviewList({ images, onRemove }: ImagePreviewListProps) {
  if (images.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 p-2">
      {images.map(img => (
        <div key={img.id} className="relative group">
          <img
            src={img.dataUrl}
            alt={img.name}
            className="h-16 w-16 rounded-lg object-cover border border-border"
          />
          <button
            type="button"
            onClick={() => onRemove(img.id)}
            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground
                       rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
```

#### ModeToggle

**파일**: `components/features/chat/ModeToggle.tsx` (신규)

```typescript
'use client';

import { Sparkles, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModeToggleProps {
  mode: 'direct' | 'analyze';
  onChange: (mode: 'direct' | 'analyze') => void;
  disabled?: boolean;
}

export function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant={mode === 'direct' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onChange('direct')}
        disabled={disabled}
      >
        <Sparkles className="h-4 w-4 mr-1" />
        1-Step (빠름)
      </Button>
      <Button
        type="button"
        variant={mode === 'analyze' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onChange('analyze')}
        disabled={disabled}
      >
        <Layers className="h-4 w-4 mr-1" />
        2-Step (정교)
      </Button>
    </div>
  );
}
```

#### 이미지 유틸리티

**파일**: `lib/image-utils.ts` (신규)

```typescript
import type { ImageContent } from '@/types/chat';

export interface ImagePreviewData {
  id: string;
  file: File;
  dataUrl: string;
  mediaType: ImageContent['media_type'];
}

export async function fileToImagePreview(file: File): Promise<ImagePreviewData> {
  const dataUrl = await readFileAsDataUrl(file);
  return {
    id: crypto.randomUUID(),
    file,
    dataUrl,
    mediaType: file.type as ImageContent['media_type'],
  };
}

export function imagePreviewToContent(preview: ImagePreviewData): ImageContent {
  // data:image/png;base64,xxxx → xxxx
  const base64 = preview.dataUrl.split(',')[1];
  return {
    type: 'image',
    media_type: preview.mediaType,
    data: base64,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

---

## 6. 구현 순서

| Phase | 작업 | 파일 | 우선순위 |
|-------|------|------|----------|
| 1 | 타입 정의 | `types/chat.ts` | HIGH |
| 2 | 이미지 유틸리티 | `lib/image-utils.ts` | HIGH |
| 3 | API Route | `app/api/chat/vision/route.ts` | HIGH |
| 4 | useVisionChat Hook | `hooks/useVisionChat.ts` | HIGH |
| 5 | ImageUploadButton | `components/features/chat/ImageUploadButton.tsx` | HIGH |
| 6 | ImagePreviewList | `components/features/chat/ImagePreviewList.tsx` | HIGH |
| 7 | ModeToggle | `components/features/chat/ModeToggle.tsx` | MEDIUM |
| 8 | ChatInput 통합 | `components/features/chat/ChatInput.tsx` 수정 | HIGH |
| 9 | AnalysisPreview (2-Step) | `components/features/chat/AnalysisPreview.tsx` | MEDIUM |

---

## 7. 검증 방법

```bash
# 1. 개발 서버 실행
pnpm dev

# 2. 브라우저에서 테스트
# - 이미지 업로드 버튼 클릭
# - 이미지 미리보기 확인
# - 프롬프트 입력 후 전송
# - SSE 스트리밍 응답 확인
# - 생성된 코드 프리뷰 확인
```

---

## 8. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 대용량 이미지 업로드 | UX 저하, 타임아웃 | 클라이언트 압축 (5MB 제한), 진행 표시 |
| SSE 연결 끊김 | 응답 손실 | 재연결 로직, 부분 상태 저장 |
| base64 페이로드 증가 | 네트워크 부하 | Firebase Storage URL 참조 방식 고려 |
| 모드 혼란 | UX 저하 | 명확한 툴팁, 기본값 1-Step |
