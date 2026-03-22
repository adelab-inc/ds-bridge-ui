import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Segment, type SegmentItem } from '../components/Segment';

const meta: Meta<typeof Segment> = {
  title: 'UI/Segment',
  component: Segment,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          '### SegmentGroup',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `Size` | `size` | 동일. sm/md/lg |',
          '| `WidthMode` | `widthMode` | 동일. equal/content. Figma에서 Size와 조합 variant로 표현 |',
          '| `show3-5Option` | — | Figma 디자인 도구 제약. 코드는 `items` 배열로 동적 처리 |',
          '| — | `items` | 코드 전용. 동적 항목 배열 (2~5개 권장) |',
          '| — | `value` | 코드 전용. 선택값 제어 |',
          '| — | `onChange` | 코드 전용. 선택 변경 콜백 |',
          '| — | `disabled` | 코드 전용. 전체 비활성 (접근성 필수, Figma에 없음) |',
          '| — | `gap` | 코드 전용. 탭리스트-패널(content) 간격 |',
          '| — | `mode` | 코드 전용. SpacingModeProvider 연동 (base/compact) |',
          '',
          '### SegmentItem',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `Active` (off/on) | (내부) | `value` 매칭으로 자동 결정. 소비자가 직접 제어하지 않음 |',
          '| `Size` | (상위 전달) | SegmentGroup에서 전달 |',
          '| `text` | `label` | 이름만 다름. `label`이 UI 컴포넌트에서 더 표준적 |',
          '| `showIcon` | `showIcon` | V2 신규. Figma 대응 |',
          '| `icon20` | `icon` | V2 신규. ReactNode 타입 |',
          '| — | `value` | 코드 전용. 고유 식별자 |',
          '| — | `content` | 코드 전용. 패널 콘텐츠 |',
          '| — | `disabled` | 코드 전용. 개별 항목 비활성 (Figma에 없음) |',
          '',
          '### V1 → V2 주요 변경',
          '',
          '| 변경 항목 | V1 | V2 |',
          '|---|---|---|',
          '| **CVA: isSelected** | `isSelected` | `active` (Figma `Active` 대응) |',
          '| **CVA: isDisabled** | `isDisabled` | `disabled` (V2 컨벤션 통일) |',
          '| **아이콘 지원** | 없음 | `showIcon` + `icon` (Figma 대응) |',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[404px]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Figma: `Size`. 아이템 크기',
    },
    widthMode: {
      control: 'select',
      options: ['equal', 'content'],
      description: 'Figma: `WidthMode`. equal(균등 분배), content(컨텐츠에 맞춤)',
    },
    mode: {
      control: 'select',
      options: ['base', 'compact'],
      description: '간격 모드 (SpacingModeProvider)',
    },
    gap: { table: { disable: true } },
    disabled: { table: { disable: true } },
    // 컨트롤 패널에서 숨김
    items: { table: { disable: true } },
    value: { table: { disable: true } },
    onChange: { table: { disable: true } },
    className: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof Segment>;

const defaultItems: SegmentItem[] = [
  { value: 'day', label: '일별', content: <div className="p-4 bg-bg-secondary rounded-lg"><p className="text-text-primary">일별 데이터를 표시합니다.</p></div> },
  { value: 'week', label: '주별', content: <div className="p-4 bg-bg-secondary rounded-lg"><p className="text-text-primary">주별 데이터를 표시합니다.</p></div> },
  { value: 'month', label: '월별', content: <div className="p-4 bg-bg-secondary rounded-lg"><p className="text-text-primary">월별 데이터를 표시합니다.</p></div> },
];

const itemsWithDisabled: SegmentItem[] = [
  { value: 'active', label: '활성', content: <p className="text-text-primary">활성 컨텐츠</p> },
  { value: 'disabled', label: '비활성', disabled: true, content: <p className="text-text-primary">비활성 컨텐츠</p> },
  { value: 'pending', label: '대기중', content: <p className="text-text-primary">대기중 컨텐츠</p> },
];

const itemsWithIcons: SegmentItem[] = [
  { value: 'list', label: '목록', showIcon: true, icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4h14v2H3V4zm0 5h14v2H3V9zm0 5h14v2H3v-2z"/></svg> },
  { value: 'grid', label: '그리드', showIcon: true, icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6z"/></svg> },
  { value: 'chart', label: '차트', showIcon: true, icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 17V7h4v10H3zm5 0V3h4v14H8zm5 0v-7h4v7h-4z"/></svg> },
];

// 기본 스토리 — control 패널로 size, widthMode, mode, gap, disabled 모두 제어
export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState('day');
    return (
      <Segment
        {...args}
        items={defaultItems}
        value={value}
        onChange={setValue}
      />
    );
  },
  args: {
    size: 'md',
    widthMode: 'equal',
    mode: 'base',
  },
};

// 아이콘 포함 (V2 신규)
export const WithIcons: Story = {
  render: (args) => {
    const [value, setValue] = useState('list');
    return (
      <Segment
        {...args}
        items={itemsWithIcons}
        value={value}
        onChange={setValue}
      />
    );
  },
  args: {
    size: 'md',
    widthMode: 'equal',
    mode: 'base',
  },
};

// 개별 아이템 비활성화 (items 배열에서 disabled: true 지정)
export const ItemDisabled: Story = {
  render: (args) => {
    const [value, setValue] = useState('active');
    return (
      <Segment
        {...args}
        items={itemsWithDisabled}
        value={value}
        onChange={setValue}
      />
    );
  },
  args: {
    size: 'md',
    widthMode: 'equal',
    mode: 'base',
  },
  argTypes: {
    disabled: { table: { disable: true } },
    gap: { table: { disable: true } },
  },
};
