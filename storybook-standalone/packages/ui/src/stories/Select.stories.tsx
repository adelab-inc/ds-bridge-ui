import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Select, type SelectProps } from '../components/Select';
import { SelectInteraction } from '../types';
import { Icon, createIcon, type IconName16, type IconName20, type IconSize } from '../components/Icon';
import { Badge } from '../components/Badge';


// ─── Icon 선택 옵션 (Field 패턴) ───

/**
 * Size별 아이콘 목록 — Select size → Icon size 매핑 (md→20, sm→16)
 */
const iconNamesBySize: Record<string, string[]> = {
  sm: ['add', 'announcement', 'blank', 'calendar', 'check', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 'close', 'delete', 'dot', 'edit', 'external', 'loading', 'minus', 'more-vert', 'reset', 'search', 'star-fill', 'star-line'] satisfies IconName16[],
  md: ['add', 'all', 'arrow-drop-down', 'arrow-drop-up', 'arrow-right', 'blank', 'calendar', 'check', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up', 'close', 'delete', 'dot', 'edit', 'error', 'external', 'filter-list', 'folder', 'folder-fill', 'format-align-center', 'format-align-left', 'format-align-right', 'format-bold', 'format-color-text', 'format-color-text-bg', 'format-italic', 'format-list-bulleted', 'format-list-numbered', 'format-underlined', 'help', 'image', 'info', 'keyboard-arrow-left', 'keyboard-arrow-right', 'keyboard-double-arrow-left', 'keyboard-double-arrow-right', 'link', 'loading', 'menu', 'minus', 'more-vert', 'person', 'post', 'redo', 'reset', 'search', 'star-fill', 'star-line', 'success', 'table', 'undo', 'video', 'warning', 'widgets'] satisfies IconName20[],
};

/** 스토리 전용 레이아웃 스타일 — Go 템플릿 엔진 충돌 방지용 변수 분리 */
const selectStyle = { padding: '4px 8px', fontSize: 13, border: '1px solid #ccc', borderRadius: 4 } as const;
const labelStyle = { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 } as const;
const rowStyle = { display: 'flex', alignItems: 'flex-start', gap: 16 } as const;
const selectContainerStyle = { width: 240 } as const;
const controlColumnStyle = { display: 'flex', flexDirection: 'column' as const, gap: 6 } as const;

/**
 * show* discriminated union을 Storybook args에서 안전하게 처리하는 렌더 래퍼
 * - showStartIcon 토글에 따라 아이콘 선택 UI 표시 (Field 패턴)
 */
type SelectStoryArgs = Partial<SelectProps> & Record<string, unknown>;

const SelectWithControls = (args: SelectStoryArgs) => {
  const sizeKey = args.size || 'md';
  const icons = iconNamesBySize[sizeKey] || iconNamesBySize.md;
  const [startIconName, setStartIconName] = React.useState(icons[0]);
  const [endIconName, setEndIconName] = React.useState('none');

  const currentStart = icons.includes(startIconName) ? startIconName : icons[0];
  const currentEnd = endIconName === 'none' ? 'none' : (icons.includes(endIconName) ? endIconName : icons[0]);
  const iconSizeMap: Record<string, IconSize> = { sm: 16, md: 20 };
  const iconSize = iconSizeMap[sizeKey];

  // show* 에 따라 discriminated union props 조합
  const labelProps = args.showLabel
    ? { showLabel: true as const, label: args.label ?? '' }
    : { showLabel: false as const };

  const helptextProps = args.showHelptext
    ? { showHelptext: true as const, helptext: args.helptext ?? '' }
    : { showHelptext: false as const };

  const startIconProps = args.showStartIcon
    ? { showStartIcon: true as const, startIcon: createIcon(currentStart, iconSize) }
    : { showStartIcon: false as const };

  return (
    <div style={rowStyle}>
      <div style={selectContainerStyle}>
        <Select
          id={args.id}
          size={args.size}
          mode={args.mode}
          interaction={args.interaction}
          required={args.required}
          placeholder={args.placeholder}
          options={args.options ?? []}
          endIcon={currentEnd !== 'none' ? createIcon(currentEnd, iconSize) : undefined}
          {...labelProps}
          {...helptextProps}
          {...startIconProps}
        />
      </div>
      <div style={controlColumnStyle}>
        {args.showStartIcon && (
          <label style={labelStyle}>
            Start:
            <select value={currentStart} onChange={(e) => setStartIconName(e.target.value)} style={selectStyle}>
              {icons.map((name: string) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        )}
        <label style={labelStyle}>
          End:
          <select value={currentEnd} onChange={(e) => setEndIconName(e.target.value)} style={selectStyle}>
            <option value="none">none (chevron-down)</option>
            {icons.map((name: string) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
};

const meta: Meta<typeof Select> = {
  title: 'UI/Select',
  component: Select,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
## Figma ↔ Code 인터페이스 매핑

| Figma 속성 | Code prop | 비고 |
|---|---|---|
| Size | size | 동일 |
| Interaction | interaction (SelectInteraction enum) | Figma enum + Disabled 통합 |
| Interaction=error | interaction="error" | enum 통합 |
| Interaction=selected | isActive (내부 상태) | isOpen·isFocused 시 자동 적용. interaction="selected"로 강제 가능 |
| Interaction=hover | CSS hover pseudo-state | 코드 prop 불필요 |
| Interaction=pressed | isMousePressed (내부 상태) | mousedown~mouseup 사이 pressed 스타일 유지. CSS active + JS 제어 |
| Focus | 내부 상태 | JS isFocusVisible 처리 (마우스 클릭 시 outline 미표시) |
| Disabled | interaction="disabled" | enum 통합 |
| Show Label | showLabel (boolean) | Figma 매칭. discriminated union |
| Show Asterisk | required (boolean) | HTML 시맨틱 우선 |
| Show Start icon | showStartIcon (boolean) | Figma 매칭. discriminated union |
| Show Heiptext | showHelptext (boolean) | Figma 매칭. discriminated union |
| Label | label (string) | showLabel={true}일 때만 |
| Helptext | helptext (string) | showHelptext={true}일 때만 |

## V1 → V2 변경 사항

| 변경 | V1 | V2 | 이유 |
|---|---|---|---|
| interaction enum 도입 | error (boolean) + disabled (boolean) | interaction (SelectInteraction) | Field 패턴 일관성. 상호 배타적 상태 |
| hasValue 제거 | hasValue: CVA boolean | — | Figma 대응 없음, 빈 클래스 |
| showLabel 추가 | label (optional) | showLabel + label (discriminated union) | Figma Show Label 매칭 |
| showHelptext 추가 | helperText (optional) | showHelptext + helptext (discriminated union) | Figma Show Heiptext 매칭 |
| helperText → helptext | helperText | helptext | Figma Helptext 매칭 |
| showStartIcon 추가 | startIcon (optional) | showStartIcon + startIcon (discriminated union) | Figma Show Start icon 매칭 |
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['md', 'sm'],
      description: 'Figma: Size',
    },
    mode: {
      control: 'select',
      options: ['base', 'compact'],
      description: 'Spacing density mode',
    },
    interaction: {
      control: 'select',
      options: Object.values(SelectInteraction),
      description: 'Figma: Interaction + Disabled',
    },
    showLabel: {
      control: 'boolean',
      description: 'Figma: Show Label',
    },
    label: {
      control: 'text',
      description: 'Figma: Label',
      if: { arg: 'showLabel', eq: true },
    },
    required: {
      control: 'boolean',
      description: 'Figma: Show Asterisk (HTML required)',
    },
    showHelptext: {
      control: 'boolean',
      description: 'Figma: Show Heiptext',
    },
    helptext: {
      control: 'text',
      description: 'Figma: Helptext',
      if: { arg: 'showHelptext', eq: true },
    },
    showStartIcon: {
      control: 'boolean',
      description: 'Figma: Show Start icon. 아이콘은 렌더 영역 옆 드롭다운에서 선택',
    },
    placeholder: {
      control: 'text',
      description: 'Select의 placeholder 텍스트를 설정합니다.',
    },
    endIcon: { table: { disable: true } },
    options: { table: { disable: true } },
    value: { table: { disable: true } },
    defaultValue: { table: { disable: true } },
    onChange: { table: { disable: true } },
    startIcon: { table: { disable: true } },
    onStartIconClick: { table: { disable: true } },
    onEndIconClick: { table: { disable: true } },
    id: { table: { disable: true } },
    labelProps: { table: { disable: true } },
    helperTextProps: { table: { disable: true } },
    selectProps: { table: { disable: true } },
    startIconProps: { table: { disable: true } },
    endIconProps: { table: { disable: true } },
    isOpen: { table: { disable: true } },
  },
  args: {
    id: 'select-story',
    size: 'md',
    mode: 'base',
    interaction: SelectInteraction.DEFAULT,
    showLabel: true,
    label: '선택 항목',
    required: false,
    showHelptext: true,
    helptext: '항목을 선택해주세요',
    showStartIcon: false,
    placeholder: '선택하세요',
    options: [
      { value: 'option1', label: '옵션 1' },
      { value: 'option2', label: '옵션 2' },
      { value: 'option3', label: '옵션 3' },
    ],
  },
};

export default meta;
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  render: (args) => <SelectWithControls {...(args as Record<string, unknown>)} />,
};

// Y축 Flip 확인용 스토리 (화면 하단에 배치)
const flipTestOptions = [
  { value: '1', label: '옵션 1' },
  { value: '2', label: '옵션 2' },
  { value: '3', label: '옵션 3' },
  { value: '4', label: '옵션 4' },
  { value: '5', label: '옵션 5' },
  { value: '6', label: '옵션 6' },
  { value: '7', label: '옵션 7' },
  { value: '8', label: '옵션 8' },
];
const flipContainerStyle = { display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between', height: '100vh', padding: 24 };
const flipItemStyle = { width: 240 };

export const FlipPositioning: Story = {
  name: 'Y축 Flip 테스트',
  render: () => (
    <div style={flipContainerStyle}>
      <div style={flipItemStyle}>
        <Select
          showLabel={true}
          label="상단 (아래로 열림)"
          showHelptext={false}
          showStartIcon={false}
          placeholder="클릭하여 확인"
          options={flipTestOptions}
        />
      </div>
      <div style={flipItemStyle}>
        <Select
          showLabel={true}
          label="하단 (위로 Flip)"
          showHelptext={false}
          showStartIcon={false}
          placeholder="클릭하여 Flip 확인"
          options={flipTestOptions}
        />
      </div>
    </div>
  ),
};

// Description 타입 옵션
const descriptionContainerStyle = { width: 300 };

export const DescriptionOptions: Story = {
  name: 'Description 옵션',
  render: () => (
    <div style={descriptionContainerStyle}>
      <Select
        showLabel={true}
        label="설정 항목"
        showHelptext={true}
        helptext="설명이 포함된 옵션입니다"
        showStartIcon={false}
        placeholder="설정을 선택하세요"
        options={[
          { value: 'auto', label: '자동', type: 'description', description: '시스템이 자동으로 결정합니다' },
          { value: 'manual', label: '수동', type: 'description', description: '사용자가 직접 설정합니다' },
          { value: 'custom', label: '사용자 정의', type: 'description', description: '고급 설정을 직접 구성합니다' },
        ]}
      />
    </div>
  ),
};

// Profile 타입 옵션
export const ProfileOptions: Story = {
  name: 'Profile 옵션',
  render: () => (
    <div style={descriptionContainerStyle}>
      <Select
        showLabel={true}
        label="담당자"
        showHelptext={false}
        showStartIcon={false}
        placeholder="담당자를 선택하세요"
        options={[
          { value: 'user1', label: '김철수', type: 'profile', avatarContent: <Icon name="person" size={24} />, description: '개발팀' },
          { value: 'user2', label: '이영희', type: 'profile', avatarContent: <Icon name="person" size={24} />, description: '디자인팀' },
          { value: 'user3', label: '박민수', type: 'profile', avatarContent: <Icon name="person" size={24} />, description: 'QA팀' },
        ]}
      />
    </div>
  ),
};

// Badge 타입 옵션
export const BadgeOptions: Story = {
  name: 'Badge 옵션',
  render: () => (
    <div style={descriptionContainerStyle}>
      <Select
        showLabel={true}
        label="API 버전"
        showHelptext={false}
        showStartIcon={false}
        placeholder="버전을 선택하세요"
        options={[
          { value: 'v3', label: 'v3.0', type: 'badge', badgeContent: <Badge type="status" status="success" label="NEW" /> },
          { value: 'v2', label: 'v2.5', type: 'badge', badgeContent: <Badge type="status" status="warning" label="BETA" /> },
          { value: 'v1', label: 'v1.0', type: 'badge', badgeContent: <Badge type="status" status="error" label="DEP" /> },
        ]}
      />
    </div>
  ),
};

// 다중 선택 (Multi-Select)
const multiSelectContainerStyle = { width: 300 };

export const MultiSelect: Story = {
  name: 'Multi Select',
  render: () => {
    const [value, setValue] = React.useState<string[]>([]);
    return (
      <div style={multiSelectContainerStyle}>
        <Select
          multiSelect
          showLabel={true}
          label="다중 선택"
          showHelptext={true}
          helptext="여러 항목을 선택할 수 있습니다"
          showStartIcon={false}
          placeholder="선택하세요"
          options={[
            { value: '1', label: '옵션 1' },
            { value: '2', label: '옵션 2' },
            { value: '3', label: '옵션 3' },
            { value: '4', label: '옵션 4' },
            { value: '5', label: '옵션 5' },
          ]}
          value={value}
          onChange={(v) => setValue(v as string[])}
        />
      </div>
    );
  },
};

// 복합 옵션 (다양한 옵션 조합)
export const WithComplexOptions: Story = {
  name: '복합 옵션',
  args: {
    showLabel: true,
    label: '메뉴 항목',
    showHelptext: true,
    helptext: '다양한 옵션 스타일을 확인하세요',
    showStartIcon: false,
    options: [
      { value: 'text-only', label: '텍스트만' },
      { value: 'long-text', label: '이것은 매우 긴 텍스트로 말줄임표가 나타나야 합니다' },
      { value: 'left-icon', label: '검색', leadingIcon: <Icon name="search" size={16} /> },
      { value: 'with-info', label: '알림', leadingIcon: <Icon name="info" size={20} /> },
      { value: 'full-option', label: '프리미엄', leadingIcon: <Icon name="widgets" size={24} /> },
      { value: 'long-with-icons', label: '이것은 아이콘이 함께 있는 매우 긴 텍스트입니다', leadingIcon: <Icon name="person" size={20} /> },
      { value: 'delete', label: '삭제', leadingIcon: <Icon name="close" size={16} />, danger: true },
      { value: 'disabled', label: '비활성화됨', leadingIcon: <Icon name="more-vert" size={16} />, disabled: true },
    ],
  },
  render: (args) => <SelectWithControls {...(args as Record<string, unknown>)} />,
};
