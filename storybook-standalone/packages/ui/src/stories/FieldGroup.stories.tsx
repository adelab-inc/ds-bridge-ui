import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { FieldGroup } from '../components/FieldGroup';
import { Field } from '../components/Field';
import { Select, type SelectOption } from '../components/Select';

/**
 * FieldGroup 내부 Field/Select는 label·helptext 없이 사용하므로
 * show* discriminated union을 우회하여 실제 사용 props만 허용하는 타입으로 캐스팅
 */
const SimpleField = Field as unknown as React.ComponentType<{
  placeholder?: string;
  className?: string;
  size?: 'md' | 'sm';
  maxLength?: number;
}>;
const SimpleSelect = Select as unknown as React.ComponentType<{
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  size?: 'md' | 'sm';
}>;

const phoneOptions = [
  { value: '010', label: '010' },
  { value: '011', label: '011' },
  { value: '016', label: '016' },
  { value: '017', label: '017' },
  { value: '018', label: '018' },
  { value: '019', label: '019' },
];

const meta: Meta<typeof FieldGroup> = {
  title: 'UI/FieldGroup',
  component: FieldGroup,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component: [
          '## 코드 전용 컴포넌트 (Figma 정의 없음)',
          '',
          'FieldGroup은 **하나의 라벨 아래 여러 입력 필드를 묶기 위한 레이아웃 컨테이너**입니다.',
          'Figma에는 별도 컴포넌트로 정의되어 있지 않으며, 디자이너가 Field/Select를 직접 배치하여 표현하는 패턴을 코드에서 일관되게 재현합니다.',
          '',
          '### 사용 예시',
          '',
          '- 휴대폰 번호: 라벨 1개 + Select(국번) + Field(중간) + Field(끝)',
          '- 주소: 라벨 1개 + Field(우편번호) + Button(검색)',
          '',
          '### Props',
          '',
          '| Prop | 타입 | 설명 |',
          '|---|---|---|',
          '| `size` | `md` \\| `sm` | 라벨, 도움말 텍스트 크기 |',
          '| `mode` | `base` \\| `compact` | 간격 밀도. `SpacingModeProvider`로 일괄 제어 가능 |',
          '| `label` | `string` | 그룹 라벨 |',
          '| `required` | `boolean` | 필수 입력 표시 (asterisk *) |',
          '| `helperText` | `string` | 도움말 텍스트 |',
          '| `autoFocusNext` | `boolean` | maxLength 도달 시 다음 필드로 자동 포커스 이동 |',
          '| `children` | `ReactNode` | Field, Select, Button 등 자식 컴포넌트 |',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['md', 'sm'],
      description: 'FieldGroup 크기 (label, helperText에 적용)',
    },
    mode: {
      control: { type: 'select' },
      options: ['base', 'compact'],
      description: 'Spacing density mode',
    },
    required: {
      control: { type: 'boolean' },
      description: '필수 입력 표시 (asterisk *)',
    },
    label: {
      control: { type: 'text' },
      description: '그룹 레이블 텍스트',
    },
    helperText: {
      control: { type: 'text' },
      description: '도움말 텍스트',
    },
    autoFocusNext: {
      control: { type: 'boolean' },
      description: 'maxLength 입력 완료 시 다음 필드로 자동 포커스 이동',
    },
  },
};

export default meta;
type Story = StoryObj<typeof FieldGroup>;

// 기본 FieldGroup - 휴대폰 번호
export const Default: Story = {
  name: '기본 - 휴대폰 번호',
  args: {
    label: '휴대폰 번호',
    helperText: '연락 가능한 번호를 입력하세요.',
    size: 'md',
    mode: 'base',
    required: false,
  },
  render: (args) => (
    <FieldGroup {...args}>
      <SimpleSelect options={phoneOptions} placeholder="선택" className="w-[100px]" size={args.size} />
      <SimpleField placeholder="0000" className="flex-1" size={args.size} />
      <SimpleField placeholder="0000" className="flex-1" size={args.size} />
    </FieldGroup>
  ),
};

// autoFocusNext - maxLength 입력 완료 시 다음 필드로 자동 포커스 이동
export const AutoFocusNext: Story = {
  name: 'Auto Focus Next - 자동 포커스 이동',
  args: {
    label: '휴대폰 번호',
    helperText: '각 필드 입력 완료 시 다음 필드로 자동 이동합니다.',
    size: 'md',
    mode: 'base',
    required: false,
    autoFocusNext: true,
  },
  render: (args) => (
    <FieldGroup {...args}>
      <SimpleField placeholder="010" maxLength={3} className="w-[80px]" size={args.size} />
      <SimpleField placeholder="0000" maxLength={4} className="flex-1" size={args.size} />
      <SimpleField placeholder="0000" maxLength={4} className="flex-1" size={args.size} />
    </FieldGroup>
  ),
};
