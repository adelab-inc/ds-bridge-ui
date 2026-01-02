import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { Select } from '../components/Select';

const meta: Meta<typeof Select> = {
  title: 'UI/Select',
  component: Select,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['md', 'sm'],
      description: 'Select의 크기를 선택합니다.',
    },
    error: {
      control: 'boolean',
      description: '에러 상태를 설정합니다.',
    },
    disabled: {
      control: 'boolean',
      description: 'Select를 비활성화합니다.',
    },
    label: {
      control: 'text',
      description: 'Select의 라벨을 설정합니다.',
    },
    helperText: {
      control: 'text',
      description: 'Select의 도움말 텍스트를 설정합니다.',
    },
    placeholder: {
      control: 'text',
      description: 'Select의 placeholder 텍스트를 설정합니다.',
    },
    defaultValue: {
      control: 'text',
      description: '기본 선택값을 설정합니다.',
    },
    value: {
      control: 'text',
      description: '제어 컴포넌트 모드에서 현재 선택값을 설정합니다.',
    },
    options: {
      control: 'object',
      description: 'Select의 옵션 목록입니다.',
    },
    onChange: {
      action: 'changed',
      description: '선택값이 변경될 때 호출되는 콜백 함수입니다. (value: string) => void',
    },
  },
  args: {
    id: 'select-story',
    size: 'md',
    error: false,
    disabled: false,
    label: '선택 항목',
    helperText: '항목을 선택해주세요',
    placeholder: '선택하세요',
    options: [
      { value: 'option1', label: '옵션 1' },
      { value: 'option2', label: '옵션 2' },
      { value: 'option3', label: '옵션 3' },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 기본 Select 컴포넌트입니다.
 * Menu 컴포넌트를 사용하여 커스텀 스타일링이 적용된 드롭다운을 제공합니다.
 *
 * Controls 패널에서 다음을 제어할 수 있습니다:
 * - size: 크기 (md, sm)
 * - error: 에러 상태
 * - disabled: 비활성화 상태
 * - label: 라벨 텍스트
 * - helperText: 도움말 텍스트
 * - placeholder: placeholder 텍스트
 * - defaultValue: 기본 선택값
 * - options: 옵션 목록 (각 옵션에 disabled 속성으로 개별 비활성화 가능)
 *
 * 제어 컴포넌트로 사용하려면:
 * value와 onChange props를 사용하여 외부 상태와 연결합니다.
 */
export const Default: Story = {};

/**
 * 일부 옵션이 비활성화된 예시입니다.
 * 품절 상품이나 선택 불가능한 항목을 표시할 때 유용합니다.
 */
export const DisabledOptions: Story = {
  args: {
    label: '과일 선택',
    helperText: '일부 품목은 품절되었습니다',
    options: [
      { value: 'apple', label: '사과' },
      { value: 'banana', label: '바나나 (품절)', disabled: true },
      { value: 'orange', label: '오렌지' },
      { value: 'grape', label: '포도 (품절)', disabled: true },
      { value: 'melon', label: '멜론' },
    ],
  },
};

/**
 * options가 빈 배열일 때 "값이 없습니다" 메시지가 드롭다운에 표시됩니다.
 * Select는 내부적으로 Menu 컴포넌트의 emptyText 기능을 사용합니다.
 */
export const EmptyOptions: Story = {
  args: {
    label: '카테고리 선택',
    helperText: '현재 사용 가능한 카테고리가 없습니다',
    options: [],
  },
};
