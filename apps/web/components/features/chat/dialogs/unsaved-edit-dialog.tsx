'use client';

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

interface UnsavedEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
}

function UnsavedEditDialog({
  open,
  onOpenChange,
  onDiscard,
}: UnsavedEditDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>편집 중인 내용이 있습니다</AlertDialogTitle>
          <AlertDialogDescription>
            저장하지 않은 편집 내용이 있습니다. 탭을 전환하면 변경 사항이
            사라집니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>편집 계속</AlertDialogCancel>
          <AlertDialogAction onClick={onDiscard}>
            변경 사항 버리기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { UnsavedEditDialog };
export type { UnsavedEditDialogProps };
