'use client';

import * as React from 'react';
import type { AttachedImage } from '@/types/chat';
import { cn } from '@/lib/utils';

interface ImagePreviewProps {
  images: AttachedImage[];
  onRemove: (id: string) => void;
}

function ImagePreview({ images, onRemove }: ImagePreviewProps) {
  if (images.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1">
      {images.map((image) => (
        <div key={image.id} className="relative shrink-0">
          <div
            className={cn(
              'relative size-16 overflow-hidden rounded-lg border',
              image.status === 'error' && 'border-destructive'
            )}
          >
            <img
              src={image.previewUrl}
              alt="첨부 이미지"
              className="size-full object-cover"
            />
            {/* 업로드 진행 중 오버레이 */}
            {(image.status === 'pending' || image.status === 'uploading') && (
              <div className="bg-background/60 absolute inset-0 flex items-center justify-center">
                <div className="text-muted-foreground text-xs font-medium">
                  {image.progress}%
                </div>
              </div>
            )}
            {/* 에러 오버레이 */}
            {image.status === 'error' && (
              <div className="bg-destructive/20 absolute inset-0 flex items-center justify-center">
                <span className="text-destructive text-xs font-medium">
                  실패
                </span>
              </div>
            )}
          </div>
          {/* 삭제 버튼 */}
          <button
            type="button"
            onClick={() => onRemove(image.id)}
            className="bg-background border-border text-muted-foreground hover:text-foreground absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border shadow-sm transition-colors"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M2 2l6 6M8 2l-6 6" />
            </svg>
            <span className="sr-only">이미지 삭제</span>
          </button>
        </div>
      ))}
    </div>
  );
}

export { ImagePreview };
