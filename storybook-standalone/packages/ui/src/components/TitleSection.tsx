import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Icon } from './Icon';
import { cn } from './utils';

const titleSectionVariants = cva('flex items-end justify-between h-[32px]', ({
    variants: {
      "mode": {
        "base": "",
        "compact": "",
      },
    },
    defaultVariants: {
      "mode": "base",
    },
  }));

/**
 * showMenu 계층 제약: showMenu4는 showMenu3=true일 때만, showMenu3은 showMenu2=true일 때만 허용
 *
 * 유효한 조합:
 * - showMenu2=false → showMenu3, showMenu4 사용 불가
 * - showMenu2=true, showMenu3=false → showMenu4 사용 불가
 * - showMenu2=true, showMenu3=true → showMenu4 선택 가능
 */
type MenuVisibility =
  | { showMenu2?: false; showMenu3?: false; showMenu4?: false }
  | { showMenu2?: true; showMenu3?: false; showMenu4?: false }
  | { showMenu2?: true; showMenu3?: true; showMenu4?: boolean };

export type TitleSectionProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof titleSectionVariants> &
  MenuVisibility & {
    /** Figma: Title — 페이지 제목 (h1) = breadcrumb 마지막 항목 (항상 Menu1) */
    title: string;
    /** Figma: Menu2 — Title 바로 위 상위 경로 */
    menu2?: string;
    /** Figma: Menu3 — Menu2 위 상위 경로 */
    menu3?: string;
    /** Figma: Menu4 — Menu3 위 최상위 경로 */
    menu4?: string;
    /** Figma: Show Breadcrumb — Breadcrumb 섹션 표시 여부 @default true */
    showBreadcrumb?: boolean;
    /** Figma: favorite — 즐겨찾기 별 아이콘 표시 상태 */
    favorite?: boolean;
    /** 즐겨찾기 토글 콜백 */
    onFavoriteChange?: (favorite: boolean) => void;
    /** 우측 Actions 영역 */
    children?: React.ReactNode;
  };

const TitleSection = React.forwardRef<HTMLDivElement, TitleSectionProps>(
  (
    {
      className,
      title,
      menu2,
      menu3,
      menu4,
      showBreadcrumb = true,
      showMenu2 = true,
      showMenu3 = true,
      showMenu4 = false,
      favorite,
      onFavoriteChange,
      children,
      mode,
      ...props
    },
    ref,
  ) => {
    // breadcrumb 순서: 높은 번호(상위) → 낮은 번호 → Title(현재 페이지)
    // 3슬롯: Menu3 > Menu2 > Title
    // 4슬롯: Menu4 > Menu3 > Menu2 > Title
    const crumbs: string[] = [];
    if (showMenu4 && menu4) crumbs.push(menu4);
    if (showMenu3 && menu3) crumbs.push(menu3);
    if (showMenu2 && menu2) crumbs.push(menu2);
    crumbs.push(title); // Title은 항상 마지막 (= Menu1, 현재 페이지)

    const hasBreadcrumb = showBreadcrumb && crumbs.length > 1;

    return (
      <div
        ref={ref}
        className={cn(titleSectionVariants({ mode, className }))}
        {...props}
      >
        {/* 좌측: 제목 + favorite + Breadcrumb */}
        <div className="flex gap-layout-inline-lg items-end">
          {/* 제목 + favorite */}
          <div className="flex gap-component-gap-icon-label-xs items-center">
            <h1 className="text-heading-lg-bold text-text-primary">{title}</h1>
            {favorite !== undefined && (
              <button
                type="button"
                onClick={() => onFavoriteChange?.(!favorite)}
                aria-label={favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                className="flex items-center justify-center border-none bg-transparent cursor-pointer p-0 hover:opacity-70 transition-opacity"
              >
                <span className={favorite ? 'text-[#EAB308]' : ''}>
                  <Icon name={favorite ? 'star-fill' : 'star-line'} size={24} />
                </span>
              </button>
            )}
          </div>

          {/* Breadcrumb */}
          {hasBreadcrumb && (
            <div className="flex gap-component-gap-breadcrumb items-center">
              {crumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  <p
                    className={`text-caption-sm-medium ${
                      index === crumbs.length - 1 ? 'text-text-primary' : 'text-text-secondary'
                    }`}
                  >
                    {crumb}
                  </p>
                  {index < crumbs.length - 1 && <Icon name="chevron-right" size={20} className="text-icon-decorative-tertiary" />}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* 우측: Actions (children) */}
        {children && (
          <div className="flex gap-component-gap-control-group items-center">
            {children}
          </div>
        )}
      </div>
    );
  },
);
TitleSection.displayName = 'TitleSection';

export { TitleSection, titleSectionVariants };
