import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import * as React from 'react';

import { DOTS, usePagination } from '../../hooks/usePagination';
import { IconButton } from '../IconButton';
import { cn } from '../utils';
import { Ellipsis } from './Ellipsis';
import { NumberButton } from './NumberButton';
import { Icon } from '../Icon';

const paginationVariants = cva('flex items-center justify-center gap-layout-stack-xs', {
  variants: {
    disabled: {
      true: 'cursor-not-allowed opacity-50',
      false: '',
    },
  },
  defaultVariants: {
    disabled: false,
  },
});

export interface PaginationProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof paginationVariants> {
  onPageChange: (page: number) => void;
  totalCount: number;
  siblingCount?: number;
  currentPage: number;
  pageSize: number;
  variant?: 'standard' | 'simple';
  totalPages?: number;
}

const Pagination = React.forwardRef<HTMLDivElement, PaginationProps>(
  (
    {
      className,
      disabled,
      onPageChange,
      totalCount,
      siblingCount = 1,
      currentPage,
      pageSize,
      variant = 'standard',
      totalPages,
      ...props
    },
    ref,
  ) => {
    const paginationRange = usePagination({
      currentPage,
      totalCount,
      siblingCount,
      pageSize,
    });

    const totalPageCount = Math.ceil(totalCount / pageSize);

    const onNext = () => {
      if (variant === 'simple') {
        if (totalPages && currentPage < totalPages) {
          onPageChange(currentPage + 1);
        }
      } else if (currentPage < totalPageCount) {
        onPageChange(currentPage + 1);
      }
    };

    const onPrevious = () => {
      if (currentPage > 1) {
        onPageChange(currentPage - 1);
      }
    };

    const onFirst = () => {
      onPageChange(1);
    };

    const onLast = () => {
      onPageChange(totalPageCount);
    };

    if (variant === 'simple') {
      return (
        <div
          className={cn(paginationVariants({ disabled, className }))}
          ref={ref}
          {...props}
        >
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onPrevious}
            disabled={!!(currentPage === 1 || disabled)}
            aria-label="Previous Page"
            icon={<Icon name="chevron-left" className="w-[11px] h-[11px]" />}
          />
          <div className="flex px-[6px] justify-center items-center self-stretch rounded-md text-button-sm-medium text-text-tertiary">
            {currentPage} / {totalPages}
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onNext}
            disabled={!!(currentPage === totalPages || disabled)}
            aria-label="Next Page"
            icon={<Icon name="chevron-right" className="w-[11px] h-[11px]" />}
          />
        </div>
      );
    }

    return (
      <div
        className={cn(paginationVariants({ disabled, className }))}
        ref={ref}
        {...props}
      >
        <IconButton
          variant="ghost"
          size="sm"
          onClick={onFirst}
          disabled={!!(currentPage === 1 || disabled)}
          aria-label="First Page"
          icon={<Icon name="chevron-left-double" className="w-[11px] h-[11px]" />}
        />
        <IconButton
          variant="ghost"
          size="sm"
          onClick={onPrevious}
          disabled={!!(currentPage === 1 || disabled)}
          aria-label="Previous Page"
          icon={<Icon name="chevron-left" className="w-[11px] h-[11px]" />}
        />
        <div className="inline-flex h-[32px] items-start gap-layout-stack-xs flex-shrink-0 rounded-md bg-bg-surface">
          {paginationRange?.map((pageNumber, index) => {
            if (pageNumber === DOTS) {
              return <Ellipsis key={`dots-${index}`} />;
            }

            return (
              <NumberButton
                key={pageNumber}
                variant={pageNumber === currentPage ? 'active' : 'default'}
                onClick={() => onPageChange(pageNumber as number)}
                disabled={!!disabled}
              >
                {pageNumber}
              </NumberButton>
            );
          })}
        </div>
        <IconButton
          variant="ghost"
          size="sm"
          onClick={onNext}
          disabled={!!(currentPage === totalPageCount || disabled)}
          aria-label="Next Page"
          icon={<Icon name="chevron-right" className="w-[11px] h-[11px]" />}
        />
        <IconButton
          variant="ghost"
          size="sm"
          onClick={onLast}
          disabled={!!(currentPage === totalPageCount || disabled)}
          aria-label="Last Page"
          icon={<Icon name="chevron-right-double" className="w-[11px] h-[11px]" />}
        />
      </div>
    );
  },
);
Pagination.displayName = 'Pagination';

export { Pagination };