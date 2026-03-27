import React from 'react';

import { cn } from '../components/utils';
import type { RowPatternProps, RowSlotProps, SlotId } from './types';

/**
 * 슬롯 쌍 간격 (가이드 Section 2.1 기반)
 * 가이드에 명시된 조합만 정의
 */
// 기본 슬롯 간격 (가이드에 명시되지 않은 조합에 적용)
const DEFAULT_SLOT_SPACING = 'mt-layout-stack-lg'; // 20px

function getSlotSpacing(prev: SlotId, current: SlotId): string {
  // ② 테이블 구조 간격 (가이드 Section 2.1)
  if (prev === 'filter' && current === 'grid') return 'mt-layout-stack-lg'; // 20px
  if (prev === 'filter' && current === 'summary') return 'mt-layout-stack-md'; // 12px
  if (prev === 'summary' && current === 'actions') return 'mt-layout-stack-md'; // 12px
  if (prev === 'actions' && current === 'grid') return 'mt-layout-stack-md'; // 12px
  // ③ 탭 구조 간격 (가이드 Section 2.1)
  // 탭-그리드 유형: 탭 ↔ 필터바 = 20px
  if (prev === 'tab' && current === 'filter') return 'mt-layout-stack-lg'; // 20px
  // 참고: 가이드 "탭↔타이틀(24px)", "타이틀↔폼(12px)"은 탭 내부 콘텐츠 간격이므로
  // SlotId 간 간격이 아닌 탭 콘텐츠 내부에서 별도 적용해야 함
  // 미명시 조합: 기본 간격 적용
  return DEFAULT_SLOT_SPACING;
}

export function RowPattern({ pattern, children, className }: RowPatternProps) {
  const slotIds: SlotId[] = [];
  React.Children.forEach(children, child => {
    if (React.isValidElement<RowSlotProps>(child) && child.props.slot) {
      slotIds.push(child.props.slot);
    }
  });

  let slotIndex = 0;
  const enhancedChildren = React.Children.map(children, child => {
    if (!React.isValidElement<RowSlotProps>(child) || !child.props.slot) {
      return child;
    }

    const currentSlotId = child.props.slot;
    const prevSlotId = slotIndex > 0 ? slotIds[slotIndex - 1] : null;
    slotIndex++;

    if (!prevSlotId) return child;

    const spacingClass = getSlotSpacing(prevSlotId, currentSlotId);
    return React.cloneElement(child, {
      className: cn(spacingClass, child.props.className),
    });
  });

  return (
    <div className={cn('flex flex-col w-full', className)} data-row-pattern={pattern ?? undefined}>
      {enhancedChildren}
    </div>
  );
}

export function RowSlot({ slot, children, className }: RowSlotProps) {
  return (
    <div className={className} data-row-slot={slot}>
      {children}
    </div>
  );
}
