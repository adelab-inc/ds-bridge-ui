import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Tab, type TabItem } from '../components/Tab';

const meta: Meta<typeof Tab> = {
  title: 'UI/Tab',
  component: Tab,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    mode: {
      control: 'select',
      options: ['base', 'compact'],
      description: '간격 모드',
    },
    gap: {
      control: 'text',
      description: '탭 리스트와 패널 사이 간격 (Tailwind 클래스)',
    },
    disabled: {
      control: 'boolean',
      description: '전체 비활성화',
    },
    // 컨트롤 패널에서 숨김
    items: { table: { disable: true } },
    value: { table: { disable: true } },
    onChange: { table: { disable: true } },
    widthMode: { table: { disable: true } },
    isDisabled: { table: { disable: true } },
    className: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof Tab>;

const defaultItems: TabItem[] = [
  { value: 'home', label: '홈', content: <div className="p-4 bg-bg-secondary rounded-lg"><p className="text-text-primary">홈 탭의 컨텐츠입니다.</p></div> },
  { value: 'products', label: '상품', content: <div className="p-4 bg-bg-secondary rounded-lg"><p className="text-text-primary">상품 탭의 컨텐츠입니다.</p></div> },
  { value: 'orders', label: '주문내역', content: <div className="p-4 bg-bg-secondary rounded-lg"><p className="text-text-primary">주문내역 탭의 컨텐츠입니다.</p></div> },
  { value: 'settings', label: '설정', content: <div className="p-4 bg-bg-secondary rounded-lg"><p className="text-text-primary">설정 탭의 컨텐츠입니다.</p></div> },
];

// 다양한 길이의 라벨로 content 모드 테스트
const variableLengthItems: TabItem[] = [
  { value: 'short', label: '짧음', content: <p className="text-text-primary text-sm">짧은 탭의 컨텐츠</p> },
  { value: 'long', label: '기이이인컨텐츠', content: <p className="text-text-primary text-sm">긴 컨텐츠 탭의 내용입니다.</p> },
  { value: 'medium', label: '중간길이', content: <p className="text-text-primary text-sm">중간 길이 탭의 컨텐츠</p> },
];

const manyItems: TabItem[] = [
  { value: 'home', label: '홈', content: <p className="text-text-primary">홈 컨텐츠</p> },
  { value: 'products', label: '상품관리', content: <p className="text-text-primary">상품관리 컨텐츠</p> },
  { value: 'orders', label: '주문내역', content: <p className="text-text-primary">주문내역 컨텐츠</p> },
  { value: 'customers', label: '고객관리', content: <p className="text-text-primary">고객관리 컨텐츠</p> },
  { value: 'analytics', label: '통계분석', content: <p className="text-text-primary">통계분석 컨텐츠</p> },
  { value: 'settings', label: '설정', content: <p className="text-text-primary">설정 컨텐츠</p> },
  { value: 'help', label: '도움말', content: <p className="text-text-primary">도움말 컨텐츠</p> },
];

const itemsWithDisabled: TabItem[] = [
  { value: 'active', label: '활성 탭', content: <p className="text-text-primary">활성 탭의 컨텐츠</p> },
  { value: 'disabled', label: '비활성 탭', disabled: true, content: <p className="text-text-primary">비활성 탭의 컨텐츠</p> },
  { value: 'pending', label: '대기중', content: <p className="text-text-primary">대기중 탭의 컨텐츠</p> },
];

// 기본 스토리
export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState('home');
    return (
      <Tab
        {...args}
        items={defaultItems}
        value={value}
        onChange={setValue}
      />
    );
  },
  args: {
    widthMode: 'content',
  },
};

// 너비 모드 비교
export const WidthModes: Story = {
  render: () => {
    const [contentValue, setContentValue] = useState('short');
    const [equalValue, setEqualValue] = useState('short');
    return (
      <div className="flex flex-col gap-8 w-[600px]">
        <div>
          <p className="text-sm text-text-tertiary mb-2">Content (컨텐츠에 맞춤, 권장)</p>
          <Tab items={variableLengthItems} value={contentValue} onChange={setContentValue} widthMode="content" />
        </div>
        <div>
          <p className="text-sm text-text-tertiary mb-2">Equal (균등 분배)</p>
          <Tab items={variableLengthItems} value={equalValue} onChange={setEqualValue} widthMode="equal" />
        </div>
      </div>
    );
  },
};

// 스크롤 화살표 (많은 아이템)
export const WithScrollArrows: Story = {
  render: () => {
    const [value, setValue] = useState('home');
    return (
      <div className="w-[500px]">
        <p className="text-sm text-text-tertiary mb-2">가용폭을 넘기면 좌우 화살표 표시</p>
        <Tab items={manyItems} value={value} onChange={setValue} />
      </div>
    );
  },
};

// 비활성화 상태
export const Disabled: Story = {
  render: () => {
    const [value, setValue] = useState('home');
    return (
      <div className="flex flex-col gap-8">
        <div>
          <p className="text-sm text-text-tertiary mb-2">전체 비활성화</p>
          <Tab items={defaultItems} value={value} onChange={setValue} disabled />
        </div>
        <div>
          <p className="text-sm text-text-tertiary mb-2">개별 아이템 비활성화</p>
          <Tab items={itemsWithDisabled} value="active" onChange={setValue} />
        </div>
      </div>
    );
  },
};

// 탭-패널 간격 (gap prop)
export const WithGap: Story = {
  render: () => {
    const [value1, setValue1] = useState('home');
    const [value2, setValue2] = useState('home');
    const [value3, setValue3] = useState('home');
    return (
      <div className="flex flex-col gap-8 w-[600px]">
        <div>
          <p className="text-sm text-text-tertiary mb-2">gap 없음 (기본)</p>
          <Tab items={defaultItems} value={value1} onChange={setValue1} />
        </div>
        <div>
          <p className="text-sm text-text-tertiary mb-2">gap-4 (16px)</p>
          <Tab items={defaultItems} value={value2} onChange={setValue2} gap="gap-4" />
        </div>
        <div>
          <p className="text-sm text-text-tertiary mb-2">gap-6 (24px)</p>
          <Tab items={defaultItems} value={value3} onChange={setValue3} gap="gap-6" />
        </div>
      </div>
    );
  },
};

