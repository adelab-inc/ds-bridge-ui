'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Link02Icon,
  Upload01Icon,
  MoreVerticalIcon,
  ArrowRight01Icon,
  Add01Icon,
  FolderLibraryIcon,
  Delete02Icon,
} from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { HeaderLogo } from '@/components/layout/header-logo';
import { ClientOnly } from '@/components/ui/client-only';
import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
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
import { useRoomsList } from '@/hooks/firebase/useRoomsList';
import { useCreateRoom } from '@/hooks/api/useCreateRoom';
import { useDeleteRoom } from '@/hooks/api/useDeleteRoom';
import { useAuthStore } from '@/stores/useAuthStore';

/**
 * SSR fallback skeleton for header controls
 * Base UI 컴포넌트가 클라이언트에서 마운트되기 전에 표시
 */
function HeaderControlsSkeleton() {
  return (
    <>
      {/* Input placeholder */}
      <div className="flex max-w-xl flex-1 items-center gap-2">
        <div className="border-input bg-background h-9 w-full rounded-md border" />
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
  const [url, setUrl] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { rooms, isLoading: isRoomsLoading } = useRoomsList();
  const createRoomMutation = useCreateRoom();
  const deleteRoomMutation = useDeleteRoom();
  const authUser = useAuthStore((s) => s.user);

  const currentRoomId = searchParams.get('crid');

  const [deleteDialog, setDeleteDialog] = React.useState<{
    open: boolean;
    roomId: string | null;
  }>({ open: false, roomId: null });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && onURLSubmit) {
      onURLSubmit(url.trim());
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onJSONUpload) {
      onJSONUpload(file);
    }
    // Reset input
    e.target.value = '';
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCreateRoom = () => {
    createRoomMutation.mutate(
      {
        storybook_url: 'https://storybook.example.com',
        user_id: authUser?.uid || 'anonymous',
      },
      {
        onSuccess: (newRoom) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set('crid', newRoom.id);
          router.push(`?${params.toString()}`);
        },
      }
    );
  };

  const handleDeleteRoom = async () => {
    const roomIdToDelete = deleteDialog.roomId;
    if (!roomIdToDelete) return;
    try {
      await deleteRoomMutation.mutateAsync(roomIdToDelete);
      setDeleteDialog({ open: false, roomId: null });
      if (roomIdToDelete === currentRoomId) {
        // 현재 룸이 삭제되면 새 룸 생성
        const newRoom = await createRoomMutation.mutateAsync({
          storybook_url: 'https://storybook.example.com',
          user_id: authUser?.uid || 'anonymous',
        });
        const params = new URLSearchParams(searchParams.toString());
        params.set('crid', newRoom.id);
        router.push(`?${params.toString()}`);
      }
    } catch (error) {
      console.error('Failed to delete room:', error);
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
          {/* URL Input Form */}
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

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            {/* Upload JSON Button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleUploadClick}
                  disabled={isLoading}
                >
                  <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} />
                  <span className="sr-only">JSON 업로드</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>ds.json 파일 업로드</p>
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
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>프로젝트 목록</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {isRoomsLoading ? (
                  <div className="text-muted-foreground px-2 py-3 text-center text-sm">
                    불러오는 중...
                  </div>
                ) : rooms.length === 0 ? (
                  <div className="text-muted-foreground px-2 py-3 text-center text-sm">
                    프로젝트가 없습니다
                  </div>
                ) : (
                  rooms.map((room) => (
                    <DropdownMenuItem
                      key={room.id}
                      onClick={() => handleSelectRoom(room.id)}
                      className={cn(
                        'flex items-center gap-2',
                        room.id === currentRoomId && 'bg-accent'
                      )}
                    >
                      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                        <span className="truncate text-sm font-medium">
                          {(() => {
                            try {
                              return room.storybook_url
                                ? new URL(room.storybook_url).hostname
                                : '새 프로젝트';
                            } catch {
                              return room.storybook_url || '새 프로젝트';
                            }
                          })()}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {formatDate(room.created_at)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteDialog({ open: true, roomId: room.id });
                        }}
                        className="text-muted-foreground hover:text-destructive shrink-0 rounded-full p-0.5 transition-colors"
                        aria-label="프로젝트 삭제"
                      >
                        <HugeiconsIcon
                          icon={Delete02Icon}
                          className="size-3.5"
                          strokeWidth={2}
                        />
                      </button>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* New Project Button with Confirm Dialog */}
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="default"
                    size="sm"
                    disabled={createRoomMutation.isPending}
                    className="gap-1.5"
                  />
                }
              >
                <HugeiconsIcon
                  icon={Add01Icon}
                  strokeWidth={2}
                  className="size-4"
                />
                <span className="hidden sm:inline">새 프로젝트 생성</span>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>새 프로젝트 생성</AlertDialogTitle>
                  <AlertDialogDescription>
                    새로운 프로젝트를 생성하시겠습니까? 현재 작업 중인
                    프로젝트는 목록에서 다시 열 수 있습니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCreateRoom}>
                    생성
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Room Delete Confirm Dialog */}
            <AlertDialog
              open={deleteDialog.open}
              onOpenChange={(open) => {
                if (!open) setDeleteDialog({ open: false, roomId: null });
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>프로젝트 삭제</AlertDialogTitle>
                  <AlertDialogDescription>
                    이 프로젝트와 모든 대화 기록이 삭제됩니다. 삭제 후 새로운
                    프로젝트가 자동으로 생성됩니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteRoom}
                    disabled={deleteRoomMutation.isPending}
                  >
                    삭제
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
