import React from 'react';

import { cn } from '../components/utils';
import { COL_SPAN_CLASS, GRID_TYPE_DEFINITIONS } from './constants';
import { SectionColumnProvider } from './SectionColumnProvider';
import type { GridLayoutProps } from './types';

export function GridLayout({ type = 'A', children, className, gap }: GridLayoutProps) {
  const definition = GRID_TYPE_DEFINITIONS[type];
  const childArray = React.Children.toArray(children);

  return (
    <div className={cn('grid grid-cols-12 max-w-[1872px] mx-auto px-6', gap ?? 'gap-layout-inline-xl2', className)}>
      {definition.columns.map((colSize, index) => (
        <SectionColumnProvider key={index} columnSize={colSize} gridType={type} sectionIndex={index}>
          <div className={COL_SPAN_CLASS[colSize]}>{childArray[index]}</div>
        </SectionColumnProvider>
      ))}
    </div>
  );
}
