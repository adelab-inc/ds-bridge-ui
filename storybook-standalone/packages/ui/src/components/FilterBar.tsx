import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { Button } from './Button';
import { SpacingModeProvider, type SpacingMode } from './SpacingModeProvider';
import { cn } from './utils';

/** 12컬럼 그리드 span variants (actionSpan용) */
const spanVariants = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  10: 'col-span-10',
  11: 'col-span-11',
  12: 'col-span-12',
} as const;

const filterBarVariants = cva('grid grid-cols-12 items-end bg-bg-subtle rounded-xl w-full', ({
    variants: {
      "mode": {
        "base": "",
        "compact": "",
      },
    },
    defaultVariants: {
      "mode": "base",
    },
    compoundVariants: [
      {
        "class": "px-component-inset-filterbar-x py-component-inset-filterbar-y gap-component-gap-filterbar-items",
        "mode": "base",
      },
      {
        "class": "px-component-inset-filterbar-x-compact py-component-inset-filterbar-y-compact gap-component-gap-filterbar-items-compact",
        "mode": "compact",
      },
    ],
  }));

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof filterBarVariants> {
  children: React.ReactNode;
  /** @default 'base' */
  mode?: SpacingMode;
  /** 초기화 버튼 클릭 콜백 */
  onReset?: () => void;
  /** 조회하기 버튼 클릭 콜백 */
  onSearch?: () => void;
  /** @default false */
  isLoading?: boolean;
  /** 액션 버튼 영역의 col-span @default 2 */
  actionSpan?: keyof typeof spanVariants;
  /** @default true */
  showReset?: boolean;
  /** @default true */
  showSearch?: boolean;
  /** @default '초기화' */
  resetLabel?: string;
  /** @default '조회하기' */
  searchLabel?: string;
}
export const FilterBar = React.forwardRef<HTMLDivElement, FilterBarProps>(
  (
    {
      className,
      children,
      mode = 'base',
      onReset,
      onSearch,
      isLoading = false,
      actionSpan = 2,
      showReset = true,
      showSearch = true,
      resetLabel = '초기화',
      searchLabel = '조회하기',
      ...props
    },
    ref
  ) => {
    const hasActions = onReset || onSearch;

    return (
      <SpacingModeProvider mode={mode}>
        <div ref={ref} className={cn(filterBarVariants({ mode }), className)} {...props}>
          {children}
          {hasActions && (
            <div
              className={cn(
                'min-w-0 flex gap-component-gap-control-group items-end justify-end',
                spanVariants[actionSpan]
              )}
            >
              <div className="flex gap-component-gap-control-group w-full">
                {showReset && (
                  <Button
                    className="shrink-0"
                    size="sm"
                    buttonType="outline"
                    onClick={onReset}
                    label={resetLabel}
                    showStartIcon={false}
                    showEndIcon={false}
                  />
                )}
                {showSearch && (
                  <Button
                    className="flex-1"
                    size="sm"
                    buttonType="primary"
                    onClick={onSearch}
                    interaction={isLoading ? 'loading' : 'default'}
                    label={searchLabel}
                    showStartIcon={false}
                    showEndIcon={false}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </SpacingModeProvider>
    );
  }
);
FilterBar.displayName = 'FilterBar';

export { filterBarVariants };
