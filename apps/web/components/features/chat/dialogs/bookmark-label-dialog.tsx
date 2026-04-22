'use client';

import * as React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

interface BookmarkLabelDialogProps {
  open: boolean;
  label: string;
  onLabelChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}

function BookmarkLabelDialog({
  open,
  label,
  onLabelChange,
  onOpenChange,
  onSubmit,
}: BookmarkLabelDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>북마크 추가</AlertDialogTitle>
          <AlertDialogDescription>
            북마크 이름을 입력하세요
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="북마크 이름"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
          }}
          autoFocus
        />
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction onClick={onSubmit} disabled={!label.trim()}>
            추가
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { BookmarkLabelDialog };
export type { BookmarkLabelDialogProps };
