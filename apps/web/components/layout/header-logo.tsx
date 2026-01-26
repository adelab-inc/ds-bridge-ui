/**
 * HeaderLogo (Server Component)
 *
 * 정적 로고 마크업을 Server에서 렌더링
 * Client Component인 Header의 children으로 전달됨
 */
function HeaderLogo() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg font-bold">
        DS
      </div>
      <span className="text-foreground hidden font-semibold sm:inline-block">
        Runtime Hub
      </span>
    </div>
  );
}

export { HeaderLogo };
