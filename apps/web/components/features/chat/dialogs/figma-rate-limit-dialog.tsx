'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FigmaRateLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FigmaRateLimitDialog({
  open,
  onOpenChange,
}: FigmaRateLimitDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Figma 이용 한도 초과</AlertDialogTitle>
          <AlertDialogDescription>
            피그마 이용 횟수를 모두 소진했습니다. 런타임허브 담당자에게 문의
            부탁드립니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>
            확인
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { FigmaRateLimitDialog };
export type { FigmaRateLimitDialogProps };
