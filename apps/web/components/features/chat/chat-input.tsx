'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { SentIcon } from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import type { AttachedImage } from '@/types/chat';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import { ImagePreview } from '@/components/features/chat/image-preview';

interface ChatInputProps extends React.ComponentProps<'div'> {
  placeholder?: string;
  onSend?: (message: string) => void;
  disabled?: boolean;
  images?: AttachedImage[];
  onAddImages?: (files: File[]) => void;
  onRemoveImage?: (id: string) => void;
  isUploading?: boolean;
}

function ChatInput({
  placeholder = '메시지를 입력하세요...',
  onSend,
  disabled = false,
  images = [],
  onAddImages,
  onRemoveImage,
  isUploading = false,
  className,
  ...props
}: ChatInputProps) {
  const [value, setValue] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const hasContent = value.trim() || images.length > 0;
  const canSend = hasContent && !disabled && !isUploading;

  const handleSubmit = () => {
    if (canSend && onSend) {
      onSend(value.trim());
      setValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items || !onAddImages) return;

    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      onAddImages(imageFiles);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onAddImages) {
      onAddImages(Array.from(files));
    }
    // 같은 파일 재선택 허용
    e.target.value = '';
  };

  return (
    <div
      data-slot="chat-input"
      className={cn('border-border border-t', className)}
      {...props}
    >
      {/* 이미지 미리보기 */}
      {onRemoveImage && (
        <ImagePreview images={images} onRemove={onRemoveImage} />
      )}
      <div className="p-4 pt-2">
        <InputGroup className="h-auto">
          {/* 이미지 첨부 버튼 */}
          {onAddImages && (
            <InputGroupAddon align="inline-start">
              <InputGroupButton
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                aria-label="이미지 첨부"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="12" height="12" rx="2" />
                  <circle cx="5.5" cy="5.5" r="1" />
                  <path d="M14 10.5l-3.5-3.5L4 14" />
                </svg>
              </InputGroupButton>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </InputGroupAddon>
          )}
          <InputGroupTextarea
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={disabled}
            rows={1}
            className="min-h-[2.5rem] max-h-32"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleSubmit}
              disabled={!canSend}
            >
              <HugeiconsIcon icon={SentIcon} strokeWidth={2} />
              <span className="sr-only">전송</span>
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p className="text-muted-foreground mt-1.5 text-xs">
          Enter로 전송, Shift+Enter로 줄바꿈
          {onAddImages && ' · Ctrl+V로 이미지 붙여넣기'}
        </p>
      </div>
    </div>
  );
}

export { ChatInput };
export type { ChatInputProps };
