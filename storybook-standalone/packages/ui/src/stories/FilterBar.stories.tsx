import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { FilterBar, type FilterBarProps } from '../components/FilterBar';
import { Checkbox } from '../components/Checkbox';
import { Field } from '../components/Field';
import { FieldGroup } from '../components/FieldGroup';
import { Option } from '../components/Option';
import { OptionGroup } from '../components/OptionGroup';
import { Radio } from '../components/Radio';
import { Select, type SelectOption } from '../components/Select';
import { Mode } from '../types';

/**
 * Field/Select는 discriminated union(showLabel·showHelptext·showStartIcon 등)을 사용하므로
 * 스토리에서 실제 사용 props만 허용하는 타입으로 캐스팅하여 간결하게 사용
 */
const LabeledField = Field as unknown as React.ComponentType<{
  label: string;
  showLabel: boolean;
  placeholder?: string;
  className?: string;
  size?: 'md' | 'sm';
}>;
const LabeledSelect = Select as unknown as React.ComponentType<{
  label: string;
  showLabel: boolean;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  size?: 'md' | 'sm';
  value?: string;
}>;
const SimpleField = Field as unknown as React.ComponentType<{
  placeholder?: string;
  className?: string;
  size?: 'md' | 'sm';
}>;
const SimpleSelect = Select as unknown as React.ComponentType<{
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  size?: 'md' | 'sm';
  value?: string;
}>;

// ── 공통 옵션 ──
const opt = (...labels: string[]): SelectOption[] =>
  labels.map((l) => ({ value: l, label: l }));

const insurerOptions = opt('미선택', '삼성생명', '한화생명', '교보생명', 'DB손해보험');
const allOptions = opt('전체');
const unselectedOptions = opt('미선택');
const contractNoTypeOptions = opt('계약번호', '증권번호', '청약번호');
const contractStatusOptions = opt('미선택', '유지', '만기', '해지', '실효');
const monthOptions = opt('당월', '전월', '전전월', '3개월', '6개월');
const contractTypeOptions = opt('전체', '신계약', '갱신');
const agreementOptions = opt('전체', '동의', '미동의');
const orgOptions = opt('소속코드/소속명');
const relationOptions = opt('계약자', '피보험자', '수익자');
const corporateOptions = opt('전체', '법인', '일반');
const productTypeOptions = opt('미선택', '생명보험', '손해보험', '제3보험');
const productCategoryOptions = opt('미선택', '종신', '정기', 'CI', '건강');
const familyOptions = opt('전체', '본인', '가족');
const submitOptions = opt('제출', '미제출');
const yesNoAllOptions = opt('전체', '확인', '미확인');
const surrenderOptions = opt('제출', '미제출');

/**
 * 신계약 리스트 필터바 — 3행 12컬럼 실전 레이아웃
 * Figma Frame: 3254:320797
 */
function ContractFilterBarContent() {
  const [wmChecked, setWmChecked] = React.useState<'unchecked' | 'checked'>('unchecked');
  const [eSign, setESign] = React.useState<'N' | 'Y'>('N');

  return (
    <>
      {/* ── Row 1: span-2 위주 + span-1 마무리 ── */}
      <div className="col-span-2">
        <LabeledSelect label="보험사" options={insurerOptions} showLabel size="sm" />
      </div>
      <div className="col-span-2">
        <LabeledField label="상품명" showLabel placeholder="상품코드/보험사" size="sm" />
      </div>
      <div className="col-span-2">
        <FieldGroup label="계약번호 구분" size="sm">
          <SimpleSelect options={contractNoTypeOptions} size="sm" />
          <SimpleField placeholder="전체" size="sm" />
        </FieldGroup>
      </div>
      <div className="col-span-2">
        <LabeledSelect label="계약상태" options={contractStatusOptions} showLabel size="sm" />
      </div>
      <div className="col-span-2">
        <FieldGroup label="계약일자" size="sm">
          <SimpleSelect options={monthOptions} size="sm" />
          <SimpleField placeholder="2025.09.24 ~ ..." size="sm" />
        </FieldGroup>
      </div>
      <div className="col-span-1">
        <LabeledSelect label="계약구분" options={contractTypeOptions} showLabel size="sm" />
      </div>
      <div className="col-span-1">
        <LabeledSelect label="계약체결동의" options={agreementOptions} showLabel size="sm" />
      </div>

      {/* ── Row 2: 모두 span-1 (12개) ── */}
      <div className="col-span-1">
        <LabeledSelect label="소속" options={orgOptions} showLabel size="sm" />
      </div>
      <div className="col-span-1">
        <LabeledField label="TFA명" showLabel placeholder="TFA코드/TFA명" size="sm" />
      </div>
      <div className="col-span-1">
        <LabeledSelect label="관계자" options={relationOptions} showLabel size="sm" />
      </div>
      <div className="col-span-1">
        <LabeledField label="고객명" showLabel placeholder="고객명" size="sm" />
      </div>
      <div className="col-span-1">
        <LabeledField label="주민/법인일자리" showLabel placeholder="번호" size="sm" />
      </div>
      <div className="col-span-1">
        <LabeledSelect label="법인/일반" options={corporateOptions} showLabel size="sm" />
      </div>
      <div className="col-span-1">
        <OptionGroup label="WM상담" showLabel orientation="horizontal" size="sm">
          <Option label="체결" size="sm">
            <Checkbox size="18" value={wmChecked} onChange={() => setWmChecked(prev => prev === 'checked' ? 'unchecked' : 'checked')} />
          </Option>
        </OptionGroup>
      </div>
      <div className="col-span-1">
        <LabeledSelect label="WM파트너스" options={unselectedOptions} showLabel size="sm" />
      </div>
      <div className="col-span-1">
        <LabeledSelect label="상품종류" options={productTypeOptions} showLabel size="sm" />
      </div>
      <div className="col-span-1">
        <LabeledSelect label="상품구분" options={productCategoryOptions} showLabel size="sm" />
      </div>
      <div className="col-span-1">
        <LabeledSelect label="본인가족유지" options={familyOptions} showLabel size="sm" />
      </div>
      <div className="col-span-1">
        <LabeledSelect label="비교설명확인" options={submitOptions} showLabel size="sm" />
      </div>

      {/* ── Row 3: span-1 × 10 + Actions span-2 (자동 렌더링) ── */}
      <div className="col-span-1">
        <LabeledSelect label="고지의무확인" options={allOptions} showLabel size="sm" />
      </div>
      <div className="col-span-1">
        <LabeledSelect label="공유계약추정" options={allOptions} showLabel size="sm" />
      </div>
      <div className="col-span-1">
        <LabeledSelect label="계약자확인" options={yesNoAllOptions} showLabel size="sm" />
      </div>
      <div className="col-span-1">
        <LabeledSelect label="승환계약" options={surrenderOptions} showLabel size="sm" />
      </div>
      <div className="col-span-1">
        <LabeledSelect label="보험사성적" options={allOptions} showLabel size="sm" />
      </div>
      <div className="col-span-1">
        <LabeledSelect label="청약서" options={allOptions} showLabel size="sm" />
      </div>
      <div className="col-span-1">
        <OptionGroup label="전자서명(A+에이전)" showLabel orientation="horizontal" size="sm">
          <Option label="N" size="sm">
            <Radio size="18" value={eSign === 'N' ? 'checked' : 'unchecked'} onChange={() => setESign('N')} />
          </Option>
          <Option label="Y" size="sm">
            <Radio size="18" value={eSign === 'Y' ? 'checked' : 'unchecked'} onChange={() => setESign('Y')} />
          </Option>
        </OptionGroup>
      </div>
      <div className="col-span-1">
        <LabeledSelect label="전자청약(보험사)" options={allOptions} showLabel size="sm" />
      </div>
      <div className="col-span-1">
        <LabeledSelect label="보완이력" options={allOptions} showLabel size="sm" />
      </div>
      <div className="col-span-1">
        <LabeledSelect label="상담이력" options={allOptions} showLabel size="sm" />
      </div>
      {/* Actions (span-2)는 FilterBar의 onReset/onSearch props로 자동 렌더링 */}
    </>
  );
}

const meta: Meta<FilterBarProps> = {
  title: 'UI/FilterBar',
  component: FilterBar,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          'FilterBar는 12컬럼 CSS Grid 시스템을 사용하는 필터 바 컴포넌트입니다.',
          'Figma Frame: `3254:320797`',
          '',
          '### FilterBar',
          '',
          '| Figma Property | Code Prop | 타입 | 기본값 | 비고 |',
          '|---|---|---|---|---|',
          '| Mode | `mode` | `"base" \\| "compact"` | `"base"` | padding/gap 및 내부 Field/Select spacing 제어 |',
          '| — | `children` | `ReactNode` | (필수) | 필터 요소들을 `<div className="col-span-N">` 으로 감싸서 배치 |',
          '| — | `onReset` | `() => void` | — | 초기화 버튼 클릭 |',
          '| — | `onSearch` | `() => void` | — | 조회하기 버튼 클릭 |',
          '| — | `isLoading` | `boolean` | `false` | 조회 중 로딩 상태 |',
          '| — | `actionSpan` | `1~12` | `2` | 액션 버튼 영역 컬럼 수 |',
          '| — | `showReset` | `boolean` | `true` | 초기화 버튼 표시 |',
          '| — | `showSearch` | `boolean` | `true` | 조회하기 버튼 표시 |',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    mode: {
      control: { type: 'select' },
      options: Object.values(Mode),
      description: 'FilterBar spacing 모드. `SpacingModeProvider`를 통해 내부 Field/Select spacing 제어',
    },
    children: { table: { disable: true } },
    onReset: { table: { disable: true } },
    onSearch: { table: { disable: true } },
    isLoading: { table: { disable: true } },
    actionSpan: { table: { disable: true } },
    showReset: { table: { disable: true } },
    showSearch: { table: { disable: true } },
    resetLabel: { table: { disable: true } },
    searchLabel: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<FilterBarProps>;

export const ActionRightAligned: Story = {
  name: '액션 버튼 우측 정렬',
  args: {
    mode: Mode.COMPACT,
  },
  render: (args) => (
    <div className="max-w-[1920px] flex flex-col gap-6">
      {/* 12컬럼 가이드 */}
      <div className="grid grid-cols-12 gap-3">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="h-6 rounded bg-blue-100 flex items-center justify-center text-blue-600 text-[11px] font-mono"
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* 케이스 1: 필터 2개(col-span-2 × 2 = 4컬럼) + 액션 2컬럼 → 6컬럼 비어도 우측 정렬 */}
      <div>
        <p className="text-[12px] text-text-secondary mb-1">필터 2개 (4컬럼) + actionSpan=2 → 액션이 우측 끝에 정렬</p>
        <FilterBar mode={args.mode} onReset={() => {}} onSearch={() => {}} actionSpan={2}>
          <div className="col-span-2">
            <LabeledSelect label="보험사" options={opt('전체', '삼성생명')} showLabel size="sm" />
          </div>
          <div className="col-span-2">
            <LabeledField label="상품명" showLabel placeholder="검색어" size="sm" />
          </div>
        </FilterBar>
      </div>

      {/* 케이스 2: 필터 1개(col-span-2 = 2컬럼) + 액션 2컬럼 → 8컬럼 비어도 우측 정렬 */}
      <div>
        <p className="text-[12px] text-text-secondary mb-1">필터 1개 (2컬럼) + actionSpan=2 → 액션이 우측 끝에 정렬</p>
        <FilterBar mode={args.mode} onReset={() => {}} onSearch={() => {}} actionSpan={2}>
          <div className="col-span-2">
            <LabeledField label="키워드" showLabel placeholder="검색어 입력" size="sm" />
          </div>
        </FilterBar>
      </div>

      {/* 케이스 3: 필터 없이 액션만 → 전체 우측 정렬 */}
      <div>
        <p className="text-[12px] text-text-secondary mb-1">필터 없음 + actionSpan=2 → 액션만 우측 끝에 정렬</p>
        <FilterBar mode={args.mode} onReset={() => {}} onSearch={() => {}} actionSpan={2}>
          <></>
        </FilterBar>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: [
          '**액션 버튼 우측 정렬**',
          '',
          '자식 필터가 12컬럼을 채우지 않아도, 액션 버튼(초기화 + 조회하기)은 항상 그리드 우측 끝에 고정됩니다.',
          '`col-start` CSS Grid 속성을 통해 `actionSpan` 값에 따라 자동 계산됩니다.',
          '',
          '| 시나리오 | 필터 컬럼 | 빈 컬럼 | 액션 위치 |',
          '|---|---|---|---|',
          '| 필터 2개 (4컬럼) | 4 | 6 | 11~12 (우측 끝) |',
          '| 필터 1개 (2컬럼) | 2 | 8 | 11~12 (우측 끝) |',
          '| 필터 없음 | 0 | 10 | 11~12 (우측 끝) |',
        ].join('\n'),
      },
    },
  },
};

export const Default: Story = {
  name: '12컬럼 그리드 시스템',
  args: {
    mode: Mode.COMPACT,
  },
  render: (args) => (
    <div className="max-w-[1920px]">
      {/* 12컬럼 가이드 표시 */}
      <div className="grid grid-cols-12 gap-3 mb-2">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="h-6 rounded bg-blue-100 flex items-center justify-center text-blue-600 text-[11px] font-mono"
          >
            {i + 1}
          </div>
        ))}
      </div>
      <FilterBar mode={args.mode} onReset={() => {}} onSearch={() => {}}>
        <ContractFilterBarContent />
      </FilterBar>
      {/* 범례 */}
      <div className="mt-4 flex gap-6 text-[12px] text-text-tertiary">
        <span>■ 1컬럼 = 전체 너비의 1/12</span>
        <span>■ col-span-1: 단일 필터</span>
        <span>■ col-span-2: 복합 필터 또는 넓은 필터</span>
        <span>■ 우측 최하단 2컬럼 = 버튼 위치 (자동)</span>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: [
          '**12 컬럼(마진 16, 거터 12) 그리드 시스템**',
          '',
          '1컬럼 내지는 2컬럼으로 필터의 너비를 설정합니다. 우측 최하단 2컬럼은 버튼(초기화 + 조회하기)이 자동으로 렌더링됩니다.',
          '',
          '| 요소 | className | 비고 |',
          '|---|---|---|',
          '| 단일 Select/Field | `col-span-1` | 1컬럼 너비 |',
          '| 복합 필터 (FieldGroup) | `col-span-2` | 2컬럼 너비, 내부 Select+Field |',
          '| 넓은 필터 (보험사, 상품명 등) | `col-span-2` | 2컬럼 너비 |',
          '| Actions (자동) | `actionSpan={2}` (기본값) | 초기화 + 조회하기 버튼 |',
          '',
          '12컬럼 합계를 초과하면 CSS Grid auto-flow에 의해 자동 줄바꿈됩니다.',
        ].join('\n'),
      },
    },
  },
};
