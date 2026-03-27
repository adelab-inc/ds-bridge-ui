import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { useSpacingMode } from '../components/SpacingModeProvider';
import { cn } from '../components/utils';

// ─── FormGrid ─────────────────────────────────────
const formGridVariants = cva('grid w-full items-start', {
  variants: {
    columns: {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4',
    },
    mode: {
      base: 'gap-x-component-gap-field-group-x gap-y-component-gap-field-group-y',
      compact: 'gap-x-component-gap-field-group-x-compact gap-y-component-gap-field-group-y-compact',
    },
  },
  defaultVariants: {
    columns: 2,
  },
});

const titleGapVariants = {
  base: 'gap-layout-stack-md',
  compact: 'gap-layout-stack-md-compact',
} as const;

export interface FormGridProps
  extends React.HTMLAttributes<HTMLDivElement>,
    Omit<VariantProps<typeof formGridVariants>, 'mode'> {
  columns?: 1 | 2 | 3 | 4;
  title?: string;
  children: React.ReactNode;
}

const FormGrid = React.forwardRef<HTMLDivElement, FormGridProps>(
  ({ className, columns, title, children, ...props }, ref) => {
    const mode = useSpacingMode();

    if (title) {
      return (
        <div ref={ref} className={cn('flex flex-col', titleGapVariants[mode])} {...props}>
          <h3 className="text-heading-md-semibold text-text-primary">{title}</h3>
          <div className={cn(formGridVariants({ columns, mode }), className)}>
            {children}
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(formGridVariants({ columns, mode }), className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
FormGrid.displayName = 'FormGrid';

// ─── FormGridCell ─────────────────────────────────
const colSpanVariants = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
} as const;

const alignVariants = {
  start: 'self-start',
  center: 'self-center',
  end: 'self-end',
} as const;

export interface FormGridCellProps
  extends React.HTMLAttributes<HTMLDivElement> {
  colSpan?: 1 | 2 | 3 | 4;
  /** 셀의 수직 정렬 (기본: FormGrid의 items-start 상속) */
  align?: 'start' | 'center' | 'end';
  children: React.ReactNode;
}

const FormGridCell = React.forwardRef<HTMLDivElement, FormGridCellProps>(
  ({ className, colSpan = 1, align, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('min-w-0', colSpanVariants[colSpan], align && alignVariants[align], className)}
      {...props}
    >
      {children}
    </div>
  )
);
FormGridCell.displayName = 'FormGridCell';

export { FormGrid, formGridVariants, FormGridCell, colSpanVariants };
