import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Tab, type TabItem } from '../components/Tab';
import { Mode } from '../types';

const meta: Meta<typeof Tab> = {
  title: 'UI/Tab',
  component: Tab,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          '### tablist (그룹)',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `width mode` | `widthMode` | 동일. content(컨텐츠 맞춤), equal(균등 분배) |',
          '| `overflow` | (자동 감지) | Figma는 boolean 토글, 코드는 ResizeObserver로 자동 감지 |',
          '| `show3~13Option` | — | Figma 디자인 도구 제약. 코드는 `items` 배열로 동적 처리 |',
          '| — | `items` | 코드 전용. 동적 항목 배열 |',
          '| — | `value` | 코드 전용. 선택값 제어 |',
          '| — | `onChange` | 코드 전용. 선택 변경 콜백 |',
          '| — | `disabled` | 코드 전용. 전체 비활성 (접근성 필수) |',
          '| — | `gap` | 코드 전용. 탭리스트-패널(content) 간격 |',
          '| — | `mode` | 코드 전용. SpacingModeProvider 연동 (base/compact) |',
          '',
          '### tab (개별 항목)',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `Active` (True/False) | (내부) | `value` 매칭으로 자동 결정. 소비자가 직접 제어하지 않음 |',
          '| `text` | `label` | 이름만 다름. `label`이 UI 컴포넌트에서 더 표준적 |',
          '| `showIcon` | `showIcon` | V2 신규. Figma 대응 |',
          '| `icon-blank-20` | `icon` | V2 신규. ReactNode 타입 |',
          '| — | `value` | 코드 전용. 고유 식별자 |',
          '| — | `content` | 코드 전용. 패널 콘텐츠 |',
          '| — | `disabled` | 코드 전용. 개별 항목 비활성 |',
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
  argTypes: {
    mode: {
      control: { type: 'select' },
      options: Object.values(Mode),
      description: 'Figma에 없는 코드 전용 속성. `SpacingModeProvider`로 일괄 제어 가능, 개별 prop으로 오버라이드 가능',
    },
    widthMode: {
      control: 'select',
      options: ['content', 'equal'],
      description: 'Figma: `width mode`. content(컨텐츠 맞춤), equal(균등 분배)',
    },
    // 컨트롤 패널에서 숨김
    disabled: { table: { disable: true } },
    items: { table: { disable: true } },
    value: { table: { disable: true } },
    onChange: { table: { disable: true } },
    className: { table: { disable: true } },
    gap: { table: { disable: true } },
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

// 아이콘 포함 아이템 (V2 신규)
const iconItems: TabItem[] = [
  { value: 'home', label: '홈', showIcon: true, icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>, content: <p className="text-text-primary">홈 컨텐츠</p> },
  { value: 'settings', label: '설정', showIcon: true, icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>, content: <p className="text-text-primary">설정 컨텐츠</p> },
  { value: 'help', label: '도움말', content: <p className="text-text-primary">도움말 컨텐츠 (아이콘 없음)</p> },
];

// 기본 스토리 — Default 1개에서 control 패널로 모든 옵션 제어
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
    mode: Mode.BASE,
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
        <p className="text-sm text-text-tertiary mb-2">가용폭을 넘기면 좌우 화살표 표시 (Figma: overflow)</p>
        <Tab items={manyItems} value={value} onChange={setValue} />
      </div>
    );
  },
};

// 비활성화 상태
export const Disabled: Story = {
  render: () => {
    const [disabledValue, setDisabledValue] = useState('home');
    const [itemDisabledValue, setItemDisabledValue] = useState('active');
    return (
      <div className="flex flex-col gap-8">
        <div>
          <p className="text-sm text-text-tertiary mb-2">전체 비활성화</p>
          <Tab items={defaultItems} value={disabledValue} onChange={setDisabledValue} disabled />
        </div>
        <div>
          <p className="text-sm text-text-tertiary mb-2">개별 아이템 비활성화</p>
          <Tab items={itemsWithDisabled} value={itemDisabledValue} onChange={setItemDisabledValue} />
        </div>
      </div>
    );
  },
};

// 아이콘 포함 (V2 신규 — Figma: showIcon + icon)
export const WithIcons: Story = {
  render: () => {
    const [value, setValue] = useState('home');
    return (
      <Tab items={iconItems} value={value} onChange={setValue} widthMode="content" />
    );
  },
};

// 1200px 최대가용폭 오버플로우 (스펙: 최대가용폭 1200px 초과 시 화살표 스크롤)
const overflowItems: TabItem[] = [
  { value: 'dashboard', label: '대시보드', content: <p className="text-text-primary">대시보드 컨텐츠</p> },
  { value: 'products', label: '상품관리', content: <p className="text-text-primary">상품관리 컨텐츠</p> },
  { value: 'orders', label: '주문내역', content: <p className="text-text-primary">주문내역 컨텐츠</p> },
  { value: 'customers', label: '고객관리', content: <p className="text-text-primary">고객관리 컨텐츠</p> },
  { value: 'analytics', label: '통계분석', content: <p className="text-text-primary">통계분석 컨텐츠</p> },
  { value: 'inventory', label: '재고관리', content: <p className="text-text-primary">재고관리 컨텐츠</p> },
  { value: 'shipping', label: '배송관리', content: <p className="text-text-primary">배송관리 컨텐츠</p> },
  { value: 'returns', label: '반품/교환', content: <p className="text-text-primary">반품/교환 컨텐츠</p> },
  { value: 'promotions', label: '프로모션', content: <p className="text-text-primary">프로모션 컨텐츠</p> },
  { value: 'reviews', label: '리뷰관리', content: <p className="text-text-primary">리뷰관리 컨텐츠</p> },
  { value: 'suppliers', label: '공급업체', content: <p className="text-text-primary">공급업체 컨텐츠</p> },
  { value: 'reports', label: '보고서', content: <p className="text-text-primary">보고서 컨텐츠</p> },
  { value: 'settings', label: '설정', content: <p className="text-text-primary">설정 컨텐츠</p> },
  { value: 'help', label: '도움말', content: <p className="text-text-primary">도움말 컨텐츠</p> },
  { value: 'notifications', label: '알림설정', content: <p className="text-text-primary">알림설정 컨텐츠</p> },
];

export const MaxWidthOverflow: Story = {
  render: () => {
    const [value, setValue] = useState('dashboard');
    return (
      <div className="w-[1200px]">
        <p className="text-sm text-text-tertiary mb-2">1200px 컨테이너 — 탭이 최대가용폭을 초과하여 화살표 스크롤 활성화</p>
        <Tab items={overflowItems} value={value} onChange={setValue} />
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
