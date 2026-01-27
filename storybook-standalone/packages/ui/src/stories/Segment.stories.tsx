import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Segment, type SegmentItem } from '../components/Segment';

const meta: Meta<typeof Segment> = {
  title: 'UI/Segment',
  component: Segment,
  parameters: {
    layout: 'centered',
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
      description: '아이템 크기',
    },
    widthMode: {
      control: 'select',
      options: ['equal', 'content'],
      description: '아이템 너비 모드',
    },
    mode: {
      control: 'select',
      options: ['base', 'compact'],
      description: '간격 모드',
    },
    disabled: {
      control: 'boolean',
      description: '전체 비활성화',
    },
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

// 기본 스토리
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
  },
};

// 사이즈 변형
export const Sizes: Story = {
  render: () => {
    const [value, setValue] = useState('day');
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-text-tertiary mb-2">Small</p>
          <Segment items={defaultItems} value={value} onChange={setValue} size="sm" />
        </div>
        <div>
          <p className="text-sm text-text-tertiary mb-2">Medium (기본)</p>
          <Segment items={defaultItems} value={value} onChange={setValue} size="md" />
        </div>
        <div>
          <p className="text-sm text-text-tertiary mb-2">Large</p>
          <Segment items={defaultItems} value={value} onChange={setValue} size="lg" />
        </div>
      </div>
    );
  },
};

// 너비 모드
export const WidthModes: Story = {
  render: () => {
    const [value, setValue] = useState('day');
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-text-tertiary mb-2">Equal (균등 분배)</p>
          <Segment items={defaultItems} value={value} onChange={setValue} widthMode="equal" />
        </div>
        <div>
          <p className="text-sm text-text-tertiary mb-2">Content (컨텐츠에 맞춤)</p>
          <Segment items={defaultItems} value={value} onChange={setValue} widthMode="content" />
        </div>
      </div>
    );
  },
};

// 비활성화 상태
export const Disabled: Story = {
  render: () => {
    const [value, setValue] = useState('day');
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-text-tertiary mb-2">전체 비활성화</p>
          <Segment items={defaultItems} value={value} onChange={setValue} disabled />
        </div>
        <div>
          <p className="text-sm text-text-tertiary mb-2">개별 아이템 비활성화</p>
          <Segment items={itemsWithDisabled} value="active" onChange={setValue} />
        </div>
      </div>
    );
  },
};
