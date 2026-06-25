'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon, Tick01Icon } from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUsers } from '@/hooks/api/useUsers';
import { useCopyRoom } from '@/hooks/api/useCopyRoom';
import { useMoveRoom } from '@/hooks/api/useMoveRoom';
import type { OrgUser, TransferAction } from '@/types/rooms';
import type { ChatRoom } from '@packages/shared-types/typescript/database/types';

interface TransferRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: ChatRoom | null;
  action: TransferAction;
  /** move 성공 시 호출 — 현재 보던 방을 이관한 경우 네비게이션 처리용 */
  onMoved?: (movedRoomId: string) => void;
}

/** OrgUser 표시 이름 (name 우선, 없으면 email) */
function userLabel(u: OrgUser): string {
  return u.name?.trim() || u.email;
}

/** 검색 매칭 (이름/이메일, 대소문자 무시) */
function matchesQuery(u: OrgUser, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    (u.name?.toLowerCase().includes(needle) ?? false) ||
    u.email.toLowerCase().includes(needle)
  );
}

function MemberAvatar({ user }: { user: OrgUser }) {
  const initial = userLabel(user).charAt(0).toUpperCase();
  return (
    <span
      aria-hidden
      className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cover bg-center text-xs font-medium"
      style={
        user.avatar_url
          ? { backgroundImage: `url(${user.avatar_url})` }
          : undefined
      }
    >
      {!user.avatar_url && initial}
    </span>
  );
}

/**
 * 방을 다른 사용자에게 복제(copy)/이관(move)하는 다이얼로그.
 *
 * - 멤버 검색·선택: useUsers()로 목록 로드 후 클라이언트에서 이름/이메일 검색.
 *   (Base UI Combobox를 AlertDialog 안에 넣을 때 생기는 portal/focus 충돌을
 *    피하려고 검색 Input + 스크롤 리스트로 직접 구현)
 * - action='move'는 "내 목록에서 사라집니다" 경고를 강조한다.
 * - 성공/실패 피드백은 다이얼로그 내부 상태로 표현(앱에 토스트 인프라 없음).
 */
export function TransferRoomDialog({
  open,
  onOpenChange,
  room,
  action,
  onMoved,
}: TransferRoomDialogProps) {
  // 다이얼로그가 열릴 때만 멤버 목록을 조회 (매 페이지 로드마다 GET /users 방지)
  const { data: users, isLoading, error: usersError } = useUsers(open);
  const copyMutation = useCopyRoom();
  const moveMutation = useMoveRoom();

  const [search, setSearch] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const mutation = action === 'copy' ? copyMutation : moveMutation;
  const actionLabel = action === 'copy' ? '복제' : '이관';

  // 다이얼로그가 닫히면 상태 초기화
  React.useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedId(null);
      setDone(false);
      copyMutation.reset();
      moveMutation.reset();
    }
    // mutation 객체는 매 렌더 새로 생성되므로 의존성에서 제외 (open 전환 시에만 실행)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = React.useMemo(
    () => (users ?? []).filter((u) => matchesQuery(u, search)),
    [users, search]
  );

  const handleSubmit = async () => {
    if (!room || !selectedId) return;
    try {
      if (action === 'copy') {
        await copyMutation.mutateAsync({
          roomId: room.id,
          targetUserId: selectedId,
        });
      } else {
        await moveMutation.mutateAsync({
          roomId: room.id,
          targetUserId: selectedId,
        });
        onMoved?.(room.id);
      }
      setDone(true);
    } catch {
      // 에러 메시지는 mutation.error로 노출
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {done ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{actionLabel} 완료</AlertDialogTitle>
              <AlertDialogDescription>
                선택한 사용자에게 방을 {actionLabel}했습니다.
                {action === 'copy'
                  ? ' 대상 사용자가 새로고침하면 목록에 표시됩니다.'
                  : ' 이 방은 내 목록에서 사라집니다.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button onClick={() => onOpenChange(false)}>닫기</Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                다른 사용자에게 {actionLabel}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {action === 'copy'
                  ? '선택한 사용자에게 이 방을 복제합니다. 원본은 그대로 유지됩니다.'
                  : '선택한 사용자에게 이 방의 소유권을 이관합니다. 이관 후 이 방은 내 목록에서 사라지며 접근할 수 없습니다.'}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {/* 멤버 검색 */}
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                strokeWidth={2}
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름 또는 이메일 검색"
                className="pl-8"
                autoFocus
              />
            </div>

            {/* 멤버 목록 */}
            <div className="max-h-56 overflow-y-auto rounded-md border">
              {isLoading ? (
                <div className="text-muted-foreground px-3 py-6 text-center text-sm">
                  멤버를 불러오는 중...
                </div>
              ) : usersError ? (
                <div className="text-destructive px-3 py-6 text-center text-sm">
                  멤버 목록을 불러오지 못했습니다.
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-muted-foreground px-3 py-6 text-center text-sm">
                  {search.trim()
                    ? '검색 결과가 없습니다'
                    : '선택할 수 있는 멤버가 없습니다'}
                </div>
              ) : (
                <ul className="p-1">
                  {filtered.map((u) => {
                    const selected = u.id === selectedId;
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(u.id)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                            selected ? 'bg-accent' : 'hover:bg-accent/50'
                          )}
                        >
                          <MemberAvatar user={u} />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium">
                              {userLabel(u)}
                            </span>
                            {u.name?.trim() && (
                              <span className="text-muted-foreground truncate text-xs">
                                {u.email}
                              </span>
                            )}
                          </span>
                          {selected && (
                            <HugeiconsIcon
                              icon={Tick01Icon}
                              strokeWidth={2.5}
                              className="text-primary size-4 shrink-0"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {action === 'move' && (
              <p className="text-destructive text-xs">
                ⚠️ 이관 후에는 이 방에 다시 접근할 수 없습니다.
              </p>
            )}

            {mutation.isError && (
              <p className="text-destructive text-sm">
                {mutation.error?.message}
              </p>
            )}

            <AlertDialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                취소
              </Button>
              <Button
                variant={action === 'move' ? 'destructive' : 'default'}
                onClick={handleSubmit}
                disabled={!selectedId || mutation.isPending}
              >
                {mutation.isPending ? `${actionLabel} 중...` : actionLabel}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
