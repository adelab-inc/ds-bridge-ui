'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  // Link02Icon,
  MoreVerticalIcon,
  // ArrowRight01Icon,
  Add01Icon,
  FolderLibraryIcon,
  Copy01Icon,
  Tick01Icon,
  PencilEdit02Icon,
} from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { HeaderLogo } from '@/components/layout/header-logo';
import { ClientOnly } from '@/components/ui/client-only';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// import {
//   InputGroup,
//   InputGroupAddon,
//   InputGroupButton,
//   InputGroupInput,
//   InputGroupText,
// } from '@/components/ui/input-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { UserMenu } from '@/components/features/auth/user-menu';
import { useRoomsList } from '@/hooks/supabase/useRoomsList';
import { useCreateRoom } from '@/hooks/api/useCreateRoom';
import {
  useDeleteRooms,
  type DeleteRoomsResult,
} from '@/hooks/api/useDeleteRooms';
import { useUpdateRoom } from '@/hooks/api/useUpdateRoom';
import { useAuthStore } from '@/stores/useAuthStore';
import type { ChatRoom } from '@packages/shared-types/typescript/database/types';

/**
 * SSR fallback skeleton for header controls
 * Base UI 컴포넌트가 클라이언트에서 마운트되기 전에 표시
 */
function HeaderControlsSkeleton() {
  return (
    <>
      {/* Project name placeholder */}
      <div className="flex min-w-0 flex-1 items-center">
        <div className="bg-muted h-5 w-32 rounded" />
      </div>
      {/* Button placeholders */}
      <div className="flex shrink-0 items-center gap-1">
        <div className="bg-muted size-9 rounded-md" />
        <div className="bg-muted size-9 rounded-md" />
      </div>
    </>
  );
}

interface HeaderProps extends React.ComponentProps<'header'> {
  onURLSubmit?: (url: string) => void;
  onJSONUpload?: (file: File) => void;
  isLoading?: boolean;
}

function Header({
  className,
  onURLSubmit,
  onJSONUpload,
  isLoading = false,
  ...props
}: HeaderProps) {
  // const [url, setUrl] = React.useState('');
  const [urlCopied, setUrlCopied] = React.useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { rooms, isLoading: isRoomsLoading } = useRoomsList();
  const createRoomMutation = useCreateRoom();
  const deleteRoomsMutation = useDeleteRooms();
  const updateRoomMutation = useUpdateRoom();
  const authUser = useAuthStore((s) => s.user);

  const currentRoomId = searchParams.get('crid');
  const currentRoom = rooms.find((r) => r.id === currentRoomId);

  const [createDialog, setCreateDialog] = React.useState(false);
  const [createProjectName, setCreateProjectName] = React.useState('');
  // 멀티선택 삭제 모드 상태
  const [deleteMode, setDeleteMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set()
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [deleteResult, setDeleteResult] =
    React.useState<DeleteRoomsResult | null>(null);
  const selectedRooms = rooms.filter((r) => selectedIds.has(r.id));
  const [editDialog, setEditDialog] = React.useState<{
    open: boolean;
    roomId: string | null;
    storybookUrl: string;
  }>({ open: false, roomId: null, storybookUrl: '' });

  // const handleSubmit = (e: React.FormEvent) => {
  //   e.preventDefault();
  //   if (url.trim() && onURLSubmit) {
  //     onURLSubmit(url.trim());
  //   }
  // };

  const handleCopyUrl = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  }, []);

  const handleCreateRoom = async () => {
    try {
      const newRoom = await createRoomMutation.mutateAsync({
        storybook_url: createProjectName.trim() || '새 프로젝트',
        user_id: authUser?.uid || 'anonymous',
      });
      setCreateDialog(false);
      setCreateProjectName('');
      const params = new URLSearchParams(searchParams.toString());
      params.delete('mid');
      params.set('crid', newRoom.id);
      router.push(`?${params.toString()}`);
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  /** 프로젝트 표시 이름 (storybook_url의 hostname, 실패 시 원본/기본값) */
  const getRoomName = React.useCallback((room: ChatRoom) => {
    if (!room.storybook_url) return '새 프로젝트';
    try {
      return new URL(room.storybook_url).hostname;
    } catch {
      return room.storybook_url;
    }
  }, []);

  const toggleDeleteMode = () => {
    setDeleteMode((prev) => {
      const next = !prev;
      if (!next) setSelectedIds(new Set());
      return next;
    });
  };

  const exitDeleteMode = () => {
    setDeleteMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (roomId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  /** 삭제 성공분 기준으로 네비게이션을 1회만 계산 */
  const navigateAfterDelete = async (succeeded: Set<string>) => {
    const remainingRooms = rooms.filter((r) => !succeeded.has(r.id));
    const currentDeleted = currentRoomId ? succeeded.has(currentRoomId) : false;

    if (remainingRooms.length === 0) {
      // 남은 프로젝트 없음 → 새로 생성 후 이동
      const newRoom = await createRoomMutation.mutateAsync({
        storybook_url: '',
        user_id: authUser?.uid || 'anonymous',
      });
      const params = new URLSearchParams(searchParams.toString());
      params.delete('mid');
      params.set('crid', newRoom.id);
      router.push(`?${params.toString()}`);
    } else if (currentDeleted) {
      // 현재 보던 프로젝트가 삭제됨 → 남은 것 중 최신으로 이동
      const latestRoom = remainingRooms[0];
      const params = new URLSearchParams(searchParams.toString());
      params.delete('mid');
      params.set('crid', latestRoom.id);
      router.push(`?${params.toString()}`);
    }
    // 그 외(현재 프로젝트 유지) → 네비게이션 없음
  };

  const handleConfirmDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    try {
      const result = await deleteRoomsMutation.mutateAsync(ids);
      setDeleteResult(result);

      const succeeded = new Set(result.succeededIds);
      if (succeeded.size > 0) {
        await navigateAfterDelete(succeeded);
      }

      if (result.failed.length === 0) {
        // 전부 성공 → 모달 닫고 선택 모드 종료
        setConfirmDeleteOpen(false);
        setDeleteResult(null);
        exitDeleteMode();
      } else {
        // 부분 실패 → 실패 항목만 선택 유지하여 재시도 가능
        setSelectedIds(new Set(result.failed.map((f) => f.id)));
      }
    } catch (error) {
      console.error('Failed to delete rooms:', error);
    }
  };

  const handleRetry = () => {
    setDeleteResult(null);
    handleConfirmDelete();
  };

  const handleCloseResult = () => {
    setConfirmDeleteOpen(false);
    setDeleteResult(null);
  };

  const handleEditRoom = async () => {
    if (!editDialog.roomId || !editDialog.storybookUrl.trim()) return;
    try {
      await updateRoomMutation.mutateAsync({
        roomId: editDialog.roomId,
        storybook_url: editDialog.storybookUrl.trim(),
      });
      setEditDialog({ open: false, roomId: null, storybookUrl: '' });
    } catch (error) {
      console.error('Failed to update room:', error);
    }
  };

  const handleSelectRoom = (roomId: string) => {
    if (roomId === currentRoomId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('crid', roomId);
    router.push(`?${params.toString()}`);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <header
      data-slot="header"
      className={cn(
        'bg-background/95 supports-[backdrop-filter]:bg-background/60 border-border sticky top-0 z-50 flex h-14 w-full items-center gap-3 border-b px-4 backdrop-blur md:px-6',
        className
      )}
      {...props}
    >
      {/* Logo - SSR에서 렌더링 유지 */}
      <HeaderLogo />

      {/* Base UI 사용 영역 - ClientOnly로 래핑하여 hydration 이슈 방지 */}
      <ClientOnly fallback={<HeaderControlsSkeleton />}>
        <TooltipProvider>
          {/* 프로젝트 이름 */}
          <div className="border-border mx-1 h-5 w-px shrink-0 bg-current opacity-20" />
          <div className="flex min-w-0 flex-1 items-center">
            <span className="text-foreground truncate text-sm font-semibold">
              {(() => {
                if (!currentRoom?.storybook_url) return '새 프로젝트';
                try {
                  return new URL(currentRoom.storybook_url).hostname;
                } catch {
                  return currentRoom.storybook_url;
                }
              })()}
            </span>
          </div>

          {/* URL Input Form - 추후 작업 예정
          <form
            onSubmit={handleSubmit}
            className="flex flex-1 items-center gap-2"
          >
            <InputGroup className="max-w-xl flex-1">
              <InputGroupAddon align="inline-start">
                <InputGroupText>
                  <HugeiconsIcon icon={Link02Icon} strokeWidth={2} />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                type="url"
                placeholder="Storybook URL 입력..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="submit"
                  variant="ghost"
                  size="xs"
                  disabled={!url.trim() || isLoading}
                >
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                  <span className="sr-only">URL 로드</span>
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
          */}

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            {/* URL 복사 버튼 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleCopyUrl}>
                  <HugeiconsIcon
                    icon={urlCopied ? Tick01Icon : Copy01Icon}
                    strokeWidth={2}
                  />
                  <span className="sr-only">URL 복사</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{urlCopied ? '복사됨!' : 'URL 복사'}</p>
              </TooltipContent>
            </Tooltip>

            {/* Room List Dropdown */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <HugeiconsIcon icon={FolderLibraryIcon} strokeWidth={2} />
                      <span className="sr-only">프로젝트 목록</span>
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>프로젝트 목록</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="end"
                className="w-72 flex flex-col overflow-hidden p-0"
              >
                {/* (A) 고정 헤더 */}
                <div className="shrink-0 flex h-10 items-center justify-between gap-2 border-b px-2">
                  {deleteMode ? (
                    <>
                      <span className="text-sm font-medium">
                        {selectedIds.size}개 선택
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={exitDeleteMode}
                        >
                          취소
                        </Button>
                        <Button
                          size="xs"
                          variant="destructive"
                          disabled={
                            selectedIds.size === 0 ||
                            deleteRoomsMutation.isPending
                          }
                          onClick={() => setConfirmDeleteOpen(true)}
                        >
                          삭제 ({selectedIds.size})
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground text-xs font-medium">
                        프로젝트 목록
                      </span>
                      {rooms.length > 0 && (
                        <button
                          type="button"
                          onClick={toggleDeleteMode}
                          className="text-muted-foreground hover:text-foreground rounded px-1.5 py-0.5 text-xs font-medium transition-colors cursor-pointer"
                        >
                          선택 삭제
                        </button>
                      )}
                    </>
                  )}
                </div>
                {/* (B) 스크롤 영역 — 목록만 스크롤 */}
                <div className="flex-1 min-h-0 overflow-y-auto p-1">
                  {isRoomsLoading ? (
                    <div className="text-muted-foreground px-2 py-3 text-center text-sm">
                      불러오는 중...
                    </div>
                  ) : rooms.length === 0 ? (
                    <div className="text-muted-foreground px-2 py-3 text-center text-sm">
                      프로젝트가 없습니다
                    </div>
                  ) : (
                    rooms.map((room) => {
                      const selected = selectedIds.has(room.id);
                      return (
                        <DropdownMenuItem
                          key={room.id}
                          closeOnClick={!deleteMode}
                          onClick={() => {
                            if (deleteMode) {
                              toggleSelect(room.id);
                            } else {
                              handleSelectRoom(room.id);
                            }
                          }}
                          className={cn(
                            'flex items-center gap-2',
                            !deleteMode &&
                              room.id === currentRoomId &&
                              'bg-accent',
                            deleteMode && selected && 'bg-accent/60'
                          )}
                        >
                          {deleteMode && (
                            <span
                              aria-hidden
                              className={cn(
                                'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                                selected
                                  ? 'bg-primary border-primary text-primary-foreground'
                                  : 'border-input'
                              )}
                            >
                              {selected && (
                                <HugeiconsIcon
                                  icon={Tick01Icon}
                                  className="size-3"
                                  strokeWidth={2.5}
                                />
                              )}
                            </span>
                          )}
                          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                            <span className="truncate text-sm font-medium">
                              {getRoomName(room)}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {formatDate(room.created_at)}
                            </span>
                          </div>
                          {!deleteMode && (
                            <div className="flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditDialog({
                                    open: true,
                                    roomId: room.id,
                                    storybookUrl: room.storybook_url || '',
                                  });
                                }}
                                className="text-muted-foreground hover:text-foreground shrink-0 rounded-full p-0.5 transition-colors cursor-pointer"
                                aria-label="프로젝트 수정"
                              >
                                <HugeiconsIcon
                                  icon={PencilEdit02Icon}
                                  className="size-3.5"
                                  strokeWidth={2}
                                />
                              </button>
                            </div>
                          )}
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* New Project Button */}
            <Button
              variant="default"
              size="sm"
              disabled={createRoomMutation.isPending}
              className="gap-1.5"
              onClick={() => setCreateDialog(true)}
            >
              <HugeiconsIcon
                icon={Add01Icon}
                strokeWidth={2}
                className="size-4"
              />
              <span className="hidden sm:inline">새 프로젝트 생성</span>
            </Button>

            {/* New Project Confirm Dialog */}
            <AlertDialog
              open={createDialog}
              onOpenChange={(open) => {
                setCreateDialog(open);
                if (!open) setCreateProjectName('');
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>새 프로젝트 생성</AlertDialogTitle>
                  <AlertDialogDescription>
                    프로젝트를 구분할 수 있는 이름을 입력해 주세요.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={createProjectName}
                  onChange={(e) => setCreateProjectName(e.target.value)}
                  placeholder="새 프로젝트"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateRoom();
                    }
                  }}
                  autoFocus
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCreateRoom}
                    disabled={createRoomMutation.isPending}
                  >
                    생성
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Room Bulk Delete Confirm Dialog (확인 → 진행 → 결과) */}
            <AlertDialog
              open={confirmDeleteOpen}
              onOpenChange={(open) => {
                if (!open && !deleteRoomsMutation.isPending) {
                  setConfirmDeleteOpen(false);
                  setDeleteResult(null);
                }
              }}
            >
              <AlertDialogContent>
                {deleteRoomsMutation.isPending ? (
                  // 진행 상태
                  <AlertDialogHeader>
                    <AlertDialogTitle>삭제 중...</AlertDialogTitle>
                    <AlertDialogDescription>
                      선택한 프로젝트를 삭제하고 있습니다. 잠시만 기다려 주세요.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                ) : deleteResult ? (
                  // 결과 상태 (부분 실패 시 노출)
                  <>
                    <AlertDialogHeader>
                      <AlertDialogTitle>삭제 결과</AlertDialogTitle>
                      <AlertDialogDescription>
                        {deleteResult.succeededIds.length}개 삭제 완료
                        {deleteResult.failed.length > 0 &&
                          `, ${deleteResult.failed.length}개 실패`}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    {deleteResult.failed.length > 0 && (
                      <div className="max-h-40 overflow-y-auto rounded-md border p-2 text-sm">
                        <p className="text-destructive mb-1 font-medium">
                          실패한 프로젝트
                        </p>
                        <ul className="text-muted-foreground space-y-0.5">
                          {deleteResult.failed.map((f) => {
                            const room = rooms.find((r) => r.id === f.id);
                            return (
                              <li key={f.id}>
                                <span className="block truncate">
                                  {room ? getRoomName(room) : f.id}
                                </span>
                                <span className="text-destructive/80 block truncate text-xs">
                                  {f.error}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    <AlertDialogFooter>
                      <Button variant="outline" onClick={handleCloseResult}>
                        닫기
                      </Button>
                      {deleteResult.failed.length > 0 && (
                        <Button variant="destructive" onClick={handleRetry}>
                          실패 항목 재시도
                        </Button>
                      )}
                    </AlertDialogFooter>
                  </>
                ) : (
                  // 확인 상태
                  <>
                    <AlertDialogHeader>
                      <AlertDialogTitle>프로젝트 삭제</AlertDialogTitle>
                      <AlertDialogDescription>
                        다음 {selectedRooms.length}개 프로젝트와 모든 대화
                        기록이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="max-h-40 overflow-y-auto rounded-md border p-2">
                      <ul className="space-y-0.5 text-sm">
                        {selectedRooms.map((room) => (
                          <li key={room.id} className="truncate">
                            {getRoomName(room)}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <AlertDialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setConfirmDeleteOpen(false)}
                      >
                        취소
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleConfirmDelete}
                        disabled={selectedRooms.length === 0}
                      >
                        삭제
                      </Button>
                    </AlertDialogFooter>
                  </>
                )}
              </AlertDialogContent>
            </AlertDialog>

            {/* Room Edit Dialog */}
            <AlertDialog
              open={editDialog.open}
              onOpenChange={(open) => {
                if (!open)
                  setEditDialog({
                    open: false,
                    roomId: null,
                    storybookUrl: '',
                  });
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>프로젝트 이름 수정</AlertDialogTitle>
                  <AlertDialogDescription>
                    프로젝트를 구분할 수 있는 이름을 입력해 주세요.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={editDialog.storybookUrl}
                  onChange={(e) =>
                    setEditDialog((prev) => ({
                      ...prev,
                      storybookUrl: e.target.value,
                    }))
                  }
                  placeholder="https://storybook.example.com"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleEditRoom();
                    }
                  }}
                  autoFocus
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleEditRoom}
                    disabled={
                      updateRoomMutation.isPending ||
                      !editDialog.storybookUrl.trim()
                    }
                  >
                    저장
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* User Menu */}
            <UserMenu />

            {/* More Options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
                  <span className="sr-only">더보기</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>설정</DropdownMenuItem>
                <DropdownMenuItem>도움말</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>GitHub</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TooltipProvider>
      </ClientOnly>
    </header>
  );
}

export { Header };
export type { HeaderProps };
