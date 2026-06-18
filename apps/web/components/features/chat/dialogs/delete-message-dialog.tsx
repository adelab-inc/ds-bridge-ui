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

interface DeleteMessageDialogProps {
  open: boolean;
  isPending: boolean;
  /** 삭제 실패 시 사용자용 에러 메시지 (예: 403 본인 메시지 아님) */
  errorMessage?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

function DeleteMessageDialog({
  open,
  isPending,
  errorMessage,
  onOpenChange,
  onConfirm,
}: DeleteMessageDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>메시지 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            이 메시지를 삭제하시겠습니까? 삭제된 메시지는 복구할 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {errorMessage && (
          <p className="text-destructive text-sm" role="alert">
            {errorMessage}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { DeleteMessageDialog };
export type { DeleteMessageDialogProps };
